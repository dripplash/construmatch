import { Router } from "express";
import { pool, withTransaction } from "../db.ts";
import { HttpError, text } from "../http.ts";
import { requireRole, requireUser } from "../middleware/auth.ts";

export const adminRouter = Router();
adminRouter.use(requireUser, requireRole("admin"));

adminRouter.get("/verifications", async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT vr.user_id, vr.legal_name, vr.document_reference, vr.registration_reference, vr.status, vr.submitted_at,
              u.email, u.username, u.display_name, u.role
         FROM verification_requests vr
         JOIN users u ON u.id = vr.user_id
        WHERE vr.status = 'pending'
        ORDER BY vr.submitted_at ASC
        LIMIT 100`,
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

adminRouter.post("/verifications/:userId/review", async (request, response, next) => {
  try {
    const status = request.body.status;
    if (!(["verified", "rejected"] as const).includes(status)) throw new HttpError(400, "Decisión inválida.");
    const reason = text(request.body.reason, 800);
    const reviewed = await withTransaction(async client => {
      const requestResult = await client.query(
        `UPDATE verification_requests
            SET status = $1, reviewed_at = now(), reviewed_by = $2, review_reason = $3
          WHERE user_id = $4 AND status = 'pending'
          RETURNING user_id`,
        [status, request.user!.id, reason, request.params.userId],
      );
      if (!requestResult.rowCount) throw new HttpError(404, "Solicitud no encontrada.", "not_found");
      await client.query(`UPDATE users SET verification_status = $1, updated_at = now() WHERE id = $2`, [status, request.params.userId]);
      await client.query(
        `INSERT INTO audit_log(actor_user_id, action, target_type, target_id, reason)
         VALUES ($1, $2, 'user', $3, $4)`,
        [request.user!.id, `verification.${status}`, request.params.userId, reason],
      );
      return { userId: request.params.userId, status };
    });
    response.json(reviewed);
  } catch (error) { next(error); }
});

adminRouter.get("/moderation", async (_request, response, next) => {
  try {
    const [users, projects, reports] = await Promise.all([
      pool.query(`SELECT id, username, display_name, email, role, verification_status, created_at FROM users WHERE role <> 'admin' ORDER BY created_at DESC LIMIT 200`),
      pool.query(`SELECT p.id, p.title, p.status, p.created_at, u.username, u.display_name FROM projects p JOIN users u ON u.id = p.client_id ORDER BY p.created_at DESC LIMIT 200`),
      pool.query(`SELECT mr.*, u.username AS reporter_username FROM moderation_reports mr JOIN users u ON u.id = mr.reporter_user_id WHERE mr.status = 'open' ORDER BY mr.created_at ASC LIMIT 200`),
    ]);
    response.json({ users: users.rows, projects: projects.rows, reports: reports.rows });
  } catch (error) { next(error); }
});

adminRouter.post("/moderation/users/:userId", async (request, response, next) => {
  try {
    if (request.params.userId === request.user!.id) throw new HttpError(400, "No puedes moderar tu propia cuenta.");
    const action = request.body.action;
    if (!(action === "suspend" || action === "restore")) throw new HttpError(400, "Acción inválida.");
    const reason = text(request.body.reason, 800);
    const result = await withTransaction(async client => {
      const updated = action === "suspend"
        ? await client.query(`UPDATE users SET moderation_previous_status = verification_status, verification_status = 'suspended', updated_at = now() WHERE id = $1 AND role <> 'admin' AND verification_status <> 'suspended' RETURNING id, verification_status`, [request.params.userId])
        : await client.query(`UPDATE users SET verification_status = COALESCE(moderation_previous_status, 'pending'), moderation_previous_status = NULL, updated_at = now() WHERE id = $1 AND role <> 'admin' AND verification_status = 'suspended' RETURNING id, verification_status`, [request.params.userId]);
      if (!updated.rowCount) throw new HttpError(404, "Cuenta no encontrada.", "not_found");
      if (action === "suspend") await client.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [request.params.userId]);
      await client.query(`INSERT INTO audit_log(actor_user_id, action, target_type, target_id, reason) VALUES ($1, $2, 'user', $3, $4)`, [request.user!.id, `moderation.user.${action}`, request.params.userId, reason]);
      return { userId: request.params.userId, status: updated.rows[0].verification_status };
    });
    response.json(result);
  } catch (error) { next(error); }
});

adminRouter.post("/moderation/projects/:projectId", async (request, response, next) => {
  try {
    const action = request.body.action;
    if (!(action === "suspend" || action === "restore")) throw new HttpError(400, "Acción inválida.");
    const reason = text(request.body.reason, 800);
    const result = await withTransaction(async client => {
      const updated = action === "suspend"
        ? await client.query(`UPDATE projects SET moderation_previous_status = status, status = 'suspended' WHERE id = $1 AND status <> 'suspended' RETURNING id, status`, [request.params.projectId])
        : await client.query(`UPDATE projects SET status = COALESCE(moderation_previous_status, 'open'), moderation_previous_status = NULL WHERE id = $1 AND status = 'suspended' RETURNING id, status`, [request.params.projectId]);
      if (!updated.rowCount) throw new HttpError(404, "Proyecto no encontrado.", "not_found");
      await client.query(`INSERT INTO audit_log(actor_user_id, action, target_type, target_id, reason) VALUES ($1, $2, 'project', $3, $4)`, [request.user!.id, `moderation.project.${action}`, request.params.projectId, reason]);
      return { projectId: request.params.projectId, status: updated.rows[0].status };
    });
    response.json(result);
  } catch (error) { next(error); }
});

adminRouter.post("/moderation/reports/:reportId", async (request, response, next) => {
  try {
    const status = request.body.status;
    if (!(status === "resolved" || status === "dismissed")) throw new HttpError(400, "Estado inválido.");
    const reason = text(request.body.reason, 800);
    const result = await pool.query(
      `UPDATE moderation_reports SET status = $1, resolved_at = now(), resolved_by = $2, resolution_reason = $3
        WHERE id = $4 AND status = 'open' RETURNING id, status`,
      [status, request.user!.id, reason, request.params.reportId],
    );
    if (!result.rowCount) throw new HttpError(404, "Reporte no encontrado.", "not_found");
    await pool.query(`INSERT INTO audit_log(actor_user_id, action, target_type, target_id, reason) VALUES ($1, $2, 'report', $3, $4)`, [request.user!.id, `moderation.report.${status}`, request.params.reportId, reason]);
    response.json(result.rows[0]);
  } catch (error) { next(error); }
});
