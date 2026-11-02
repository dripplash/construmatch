import { Router } from "express";
import { pool, withTransaction } from "../db.ts";
import { HttpError, positiveMoney, text } from "../http.ts";
import { requireAnyRole, requireRole, requireUser, requireVerified } from "../middleware/auth.ts";

export const marketplaceRouter = Router();

marketplaceRouter.post("/reports", requireUser, requireVerified, async (request, response, next) => {
  try {
    const targetType = request.body.targetType;
    if (!(targetType === "user" || targetType === "project")) throw new HttpError(400, "Tipo de reporte inválido.");
    const targetId = text(request.body.targetId, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(targetId)) throw new HttpError(400, "Objetivo inválido.");
    const reason = text(request.body.reason, 1_000);
    if (reason.length < 10) throw new HttpError(400, "Describe el motivo con al menos 10 caracteres.");
    const duplicate = await pool.query(`SELECT 1 FROM moderation_reports WHERE reporter_user_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'open'`, [request.user!.id, targetType, targetId]);
    if (duplicate.rowCount) throw new HttpError(409, "Ya existe un reporte pendiente sobre este elemento.", "report_exists");
    const result = await pool.query(`INSERT INTO moderation_reports (reporter_user_id, target_type, target_id, reason) VALUES ($1, $2, $3, $4) RETURNING id, status`, [request.user!.id, targetType, targetId, reason]);
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

marketplaceRouter.get("/account/overview", requireUser, async (request, response, next) => {
  try {
    if (request.user!.role === "client") {
      const projects = await pool.query(
        `SELECT p.id, p.title, p.category, p.commune, p.budget_min, p.budget_max, p.status, p.created_at,
                count(q.id)::int AS quote_count
           FROM projects p LEFT JOIN quotes q ON q.project_id = p.id
          WHERE p.client_id = $1 GROUP BY p.id ORDER BY p.created_at DESC`,
        [request.user!.id],
      );
      return response.json({ role: "client", verificationStatus: request.user!.verificationStatus, projects: projects.rows });
    }
    if (request.user!.role === "company" || request.user!.role === "professional") {
      const quotes = await pool.query(
        `SELECT q.id, q.project_id, q.amount, q.duration_days, q.scope, q.status, q.created_at,
                p.title AS project_title, p.commune, p.status AS project_status
           FROM quotes q JOIN projects p ON p.id = q.project_id
          WHERE q.company_user_id = $1 ORDER BY q.created_at DESC`,
        [request.user!.id],
      );
      return response.json({ role: request.user!.role, verificationStatus: request.user!.verificationStatus, quotes: quotes.rows });
    }
    response.json({ role: request.user!.role, verificationStatus: request.user!.verificationStatus });
  } catch (error) { next(error); }
});

marketplaceRouter.get("/projects/:projectId/quotes", requireUser, requireRole("client"), requireVerified, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT q.id, q.amount, q.duration_days, q.scope, q.status, q.created_at,
              u.display_name AS company_name
         FROM quotes q JOIN projects p ON p.id = q.project_id JOIN users u ON u.id = q.company_user_id
        WHERE q.project_id = $1 AND p.client_id = $2 ORDER BY q.created_at ASC`,
      [request.params.projectId, request.user!.id],
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

marketplaceRouter.get("/projects/:projectId/messages", requireUser, requireVerified, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.body, m.created_at, m.sender_user_id, u.display_name AS sender_name
         FROM messages m JOIN projects p ON p.id = m.project_id JOIN users u ON u.id = m.sender_user_id
        WHERE m.project_id = $1 AND (p.client_id = $2 OR EXISTS (
          SELECT 1 FROM quotes q WHERE q.project_id = p.id AND q.company_user_id = $2 AND q.status = 'accepted'
        )) ORDER BY m.created_at ASC LIMIT 500`,
      [request.params.projectId, request.user!.id],
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

marketplaceRouter.get("/projects", async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.description, p.category, p.commune, p.budget_min, p.budget_max, p.status, p.created_at
         FROM projects p WHERE p.status = 'open' ORDER BY p.created_at DESC LIMIT 50`,
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

marketplaceRouter.get("/companies", async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT id, display_name, role, created_at FROM users
        WHERE role IN ('company', 'professional') AND verification_status = 'verified'
        ORDER BY created_at DESC LIMIT 50`,
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

marketplaceRouter.post("/projects", requireUser, requireRole("client"), requireVerified, async (request, response, next) => {
  try {
    const budgetMin = positiveMoney(request.body.budgetMin);
    const budgetMax = positiveMoney(request.body.budgetMax);
    if (budgetMax < budgetMin) throw new HttpError(400, "El presupuesto máximo no puede ser menor al mínimo.", "invalid_budget_range");
    const description = text(request.body.description, 4_000);
    const hasContactRisk = /https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?56\s?)?(?:9\s?)?\d{4}[\s-]?\d{4}/i.test(description);
    const uploadKeys = Array.isArray(request.body.uploadKeys) ? request.body.uploadKeys.slice(0, 5).filter((key: unknown) => typeof key === "string" && key.length <= 200) : [];
    const project = await withTransaction(async client => {
      const result = await client.query(
        `INSERT INTO projects (client_id, title, description, category, commune, budget_min, budget_max)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [request.user!.id, text(request.body.title, 160), description, text(request.body.category, 80), text(request.body.commune, 100), budgetMin, budgetMax],
      );
      if (uploadKeys.length) {
        const linked = await client.query(
          `INSERT INTO project_uploads (project_id, upload_id)
           SELECT $1, id FROM uploads WHERE user_id = $2 AND storage_key = ANY($3::text[])
           ON CONFLICT DO NOTHING RETURNING upload_id`,
          [result.rows[0].id, request.user!.id, uploadKeys],
        );
        if (linked.rowCount !== uploadKeys.length) throw new HttpError(400, "Uno o más archivos no son válidos.", "invalid_upload");
      }
      if (hasContactRisk) {
        await client.query(
          `INSERT INTO moderation_reports (reporter_user_id, target_type, target_id, reason)
           VALUES ($1, 'project', $2, 'Alerta automática: la descripción podría contener datos de contacto o enlaces externos.')`,
          [request.user!.id, result.rows[0].id],
        );
      }
      return result.rows[0];
    });
    response.status(201).json(project);
  } catch (error) { next(error); }
});

marketplaceRouter.post("/projects/:projectId/quotes", requireUser, requireAnyRole("company", "professional"), requireVerified, async (request, response, next) => {
  try {
    const durationDays = Number(request.body.durationDays);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) throw new HttpError(400, "Duración inválida.", "invalid_duration");
    const result = await pool.query(
      `INSERT INTO quotes (project_id, company_user_id, amount, duration_days, scope)
       SELECT p.id, $2, $3, $4, $5 FROM projects p WHERE p.id = $1 AND p.status = 'open'
       RETURNING *`,
      [request.params.projectId, request.user!.id, positiveMoney(request.body.amount), durationDays, text(request.body.scope, 6_000)],
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
         SELECT 1 FROM quotes q WHERE q.project_id = p.id AND q.company_user_id = $2 AND q.status = 'accepted'
       )) RETURNING *`,
      [request.params.projectId, request.user!.id, text(request.body.body, 2_000)],
    );
    if (!result.rows[0]) throw new HttpError(404, "Proyecto no encontrado.", "not_found");
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});
