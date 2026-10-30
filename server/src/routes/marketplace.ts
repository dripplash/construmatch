import { Router } from "express";
import { pool, withTransaction } from "../db.ts";
import { HttpError, positiveMoney, text } from "../http.ts";
import { requireRole, requireUser, requireVerified } from "../middleware/auth.ts";

export const marketplaceRouter = Router();

marketplaceRouter.get("/projects", async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.category, p.commune, p.budget_min, p.budget_max, p.status, p.created_at
         FROM projects p WHERE p.status = 'open' ORDER BY p.created_at DESC LIMIT 50`,
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

marketplaceRouter.post("/projects", requireUser, requireRole("client"), requireVerified, async (request, response, next) => {
  try {
    const result = await pool.query(
      `INSERT INTO projects (client_id, title, description, category, commune, budget_min, budget_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [request.user!.id, text(request.body.title, 160), text(request.body.description, 4_000), text(request.body.category, 80), text(request.body.commune, 100), positiveMoney(request.body.budgetMin), positiveMoney(request.body.budgetMax)],
    );
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

marketplaceRouter.post("/projects/:projectId/quotes", requireUser, requireRole("company"), requireVerified, async (request, response, next) => {
  try {
    const result = await pool.query(
      `INSERT INTO quotes (project_id, company_user_id, amount, duration_days, scope)
       SELECT p.id, $2, $3, $4, $5 FROM projects p WHERE p.id = $1 AND p.status = 'open'
       RETURNING *`,
      [request.params.projectId, request.user!.id, positiveMoney(request.body.amount), Number(request.body.durationDays), text(request.body.scope, 6_000)],
    );
    if (!result.rows[0]) throw new HttpError(404, "Proyecto no encontrado.", "not_found");
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

marketplaceRouter.post("/projects/:projectId/quotes/:quoteId/accept", requireUser, requireRole("client"), requireVerified, async (request, response, next) => {
  try {
    const accepted = await withTransaction(async client => {
      // Locking the project and the partial unique index together protect against double-click races.
      const projectResult = await client.query(`SELECT id, client_id, status FROM projects WHERE id = $1 FOR UPDATE`, [request.params.projectId]);
      const project = projectResult.rows[0];
      if (!project || project.client_id !== request.user!.id) throw new HttpError(404, "Proyecto no encontrado.", "not_found");
      if (project.status !== "open") throw new HttpError(409, "El proyecto ya no admite una aceptación.", "project_not_open");
      const quoteResult = await client.query(
        `UPDATE quotes SET status = 'accepted', accepted_at = now()
          WHERE id = $1 AND project_id = $2 AND status = 'submitted' RETURNING *`,
        [request.params.quoteId, project.id],
      );
      if (!quoteResult.rows[0]) throw new HttpError(404, "Cotización no encontrada.", "not_found");
      await client.query(`UPDATE quotes SET status = 'rejected' WHERE project_id = $1 AND id <> $2 AND status = 'submitted'`, [project.id, request.params.quoteId]);
      await client.query(`UPDATE projects SET status = 'contracted', contracted_at = now() WHERE id = $1`, [project.id]);
      await client.query(`INSERT INTO audit_log (actor_user_id, action, target_type, target_id) VALUES ($1, 'quote.accepted', 'project', $2)`, [request.user!.id, project.id]);
      return quoteResult.rows[0];
    });
    response.json(accepted);
  } catch (error: any) {
    if (error?.code === "23505") return next(new HttpError(409, "Ya existe una cotización aceptada.", "quote_already_accepted"));
    next(error);
  }
});

marketplaceRouter.post("/projects/:projectId/messages", requireUser, requireVerified, async (request, response, next) => {
  try {
    const result = await pool.query(
      `INSERT INTO messages (project_id, sender_user_id, body)
       SELECT p.id, $2, $3 FROM projects p
       WHERE p.id = $1 AND (p.client_id = $2 OR EXISTS (
         SELECT 1 FROM quotes q WHERE q.project_id = p.id AND q.company_user_id = $2
       )) RETURNING *`,
      [request.params.projectId, request.user!.id, text(request.body.body, 2_000)],
    );
    if (!result.rows[0]) throw new HttpError(404, "Proyecto no encontrado.", "not_found");
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});
