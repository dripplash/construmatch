import { Router } from "express";
import { pool, withTransaction } from "../db.ts";
import { HttpError, text } from "../http.ts";
import { requireRole, requireUser } from "../middleware/auth.ts";
import { sendTransactionalEmail } from "../email.ts";
import { config } from "../config.ts";

export const adminRouter = Router();
adminRouter.use(requireUser, requireRole("admin"));

adminRouter.get("/verifications", async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT vr.user_id, vr.legal_name, vr.document_reference, vr.status, vr.submitted_at,
              u.email, u.display_name, u.role
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
      const profile = await client.query(`SELECT email, display_name FROM users WHERE id = $1`, [request.params.userId]);
      return { userId: request.params.userId, status, email: profile.rows[0]?.email, displayName: profile.rows[0]?.display_name };
    });
    let notificationSent = false;
    if (reviewed.email) {
      try {
        await sendTransactionalEmail(
          reviewed.email,
          status === "verified" ? "Tu cuenta de ConstruMatch fue validada" : "Actualización de tu validación en ConstruMatch",
          status === "verified" ? "Tu ticket está activo" : "Tu solicitud necesita correcciones",
          status === "verified" ? "Ya puedes utilizar las funciones habilitadas para tu tipo de cuenta." : `La solicitud fue rechazada por el siguiente motivo: ${reason}`,
          "Abrir ConstruMatch",
          `${config.appOrigin}/dashboard.html`,
        );
        notificationSent = true;
      } catch (error) { console.error("Verification notification failed", error); }
    }
    response.json({ userId: reviewed.userId, status, notificationSent });
  } catch (error) { next(error); }
});
