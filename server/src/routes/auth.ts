import { Router } from "express";
import { createHash } from "node:crypto";
import { pool, withTransaction } from "../db.ts";
import { config } from "../config.ts";
import { HttpError, text } from "../http.ts";
import { hashPassword, verifyPassword } from "../security/passwords.ts";
import { clearSessionCookie, parseCookies, sessionCookie } from "../security/requests.ts";
import { createToken, hashToken } from "../security/tokens.ts";
import { requireUser } from "../middleware/auth.ts";
import { sendTransactionalEmail } from "../email.ts";

export const authRouter = Router();
const dummyHash = hashPassword("not-a-real-password-123");
const neutralLoginError = () => new HttpError(401, "Correo o contraseña incorrectos.", "invalid_credentials");

function normalizeEmail(value: unknown): string {
  const email = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Datos inválidos.");
  return email;
}

async function createAuthToken(userId: string, purpose: "verify_email" | "reset_password", lifetime: string): Promise<string> {
  const rawToken = createToken();
  await pool.query(
    `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + $4::interval)`,
    [userId, purpose, hashToken(rawToken), lifetime],
  );
  return rawToken;
}

authRouter.get("/me", requireUser, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT id, display_name, role, verification_status, email_verified_at FROM users WHERE id = $1`,
      [request.user!.id],
    );
    const user = result.rows[0];
    if (!user) throw new HttpError(401, "Sesión inválida.", "invalid_session");
    response.json({ id: user.id, displayName: user.display_name, role: user.role, verificationStatus: user.verification_status, emailVerified: Boolean(user.email_verified_at) });
  } catch (error) { next(error); }
});

authRouter.post("/register", async (request, response, next) => {
  let createdUserId: string | undefined;
  try {
    const role = request.body.role;
    if (!("client" === role || "company" === role)) throw new HttpError(400, "Tipo de cuenta inválido.");
    const email = normalizeEmail(request.body.email);
    const name = text(request.body.name, 140);
    const passwordHash = await hashPassword(text(request.body.password, 200));
    const result = await pool.query(
      `INSERT INTO users (email, display_name, role, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, role, verification_status`,
      [email, name, role, passwordHash],
    );
    createdUserId = result.rows[0].id;
    const rawToken = await createAuthToken(createdUserId!, "verify_email", "24 hours");
    await sendTransactionalEmail(email, "Confirma tu cuenta de ConstruMatch", "Confirma tu correo", "Activa tu cuenta para continuar con la validación de identidad. Este enlace vence en 24 horas.", "Confirmar mi cuenta", `${config.appOrigin}/?verify=${encodeURIComponent(rawToken)}`);
    response.status(201).json({ ...result.rows[0], emailVerificationRequired: true });
  } catch (error: any) {
    if (createdUserId) await pool.query(`DELETE FROM users WHERE id = $1`, [createdUserId]).catch(() => {});
    if (error?.code === "23505") return next(new HttpError(409, "No fue posible crear la cuenta.", "account_unavailable"));
    next(error);
  }
});

authRouter.post("/login", async (request, response, next) => {
  const email = normalizeEmail(request.body.email);
  const password = text(request.body.password, 200);
  const ip = request.ip ?? "0.0.0.0";
  const identifier = createHash("sha256").update(email).digest("hex");
  try {
    const limits = await pool.query(
      `SELECT count(*) FILTER (WHERE identifier_hash = $1 AND ip = $2 AND occurred_at > now() - interval '15 minutes') AS account_ip,
              count(*) FILTER (WHERE ip = $2 AND occurred_at > now() - interval '15 minutes') AS ip_total FROM login_failures`,
      [identifier, ip],
    );
    if (Number(limits.rows[0].account_ip) >= 5 || Number(limits.rows[0].ip_total) >= 30) throw new HttpError(429, "Demasiados intentos. Intenta nuevamente en 15 minutos.", "login_rate_limited");
    const found = await pool.query(`SELECT id, role, verification_status, password_hash, email_verified_at FROM users WHERE email = $1`, [email]);
    const user = found.rows[0];
    const passwordOk = await verifyPassword(password, user?.password_hash ?? await dummyHash);
    if (!user || !passwordOk) {
      await pool.query(`INSERT INTO login_failures (identifier_hash, ip) VALUES ($1, $2)`, [identifier, ip]);
      throw neutralLoginError();
    }
    if (!user.email_verified_at) throw new HttpError(403, "Debes confirmar tu correo antes de ingresar.", "email_verification_required");
    const rawToken = createToken();
    const maxAge = config.sessionDays * 86_400;
    await withTransaction(async client => {
      await client.query(`DELETE FROM login_failures WHERE identifier_hash = $1`, [identifier]);
      await client.query(`INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip) VALUES ($1, $2, now() + ($3 * interval '1 second'), $4, $5)`, [user.id, hashToken(rawToken), maxAge, request.get("user-agent")?.slice(0, 300) ?? null, ip]);
    });
    response.setHeader("Set-Cookie", sessionCookie(rawToken, maxAge));
    const profile = await pool.query(`SELECT display_name FROM users WHERE id = $1`, [user.id]);
    response.json({ id: user.id, displayName: profile.rows[0]?.display_name, role: user.role, verificationStatus: user.verification_status, emailVerified: true });
  } catch (error) { next(error); }
});

authRouter.post("/verify-email", async (request, response, next) => {
  try {
    const tokenHash = hashToken(text(request.body.token, 200));
    await withTransaction(async client => {
      const found = await client.query(`SELECT id, user_id FROM auth_tokens WHERE token_hash = $1 AND purpose = 'verify_email' AND used_at IS NULL AND expires_at > now() FOR UPDATE`, [tokenHash]);
      if (!found.rows[0]) throw new HttpError(400, "El enlace es inválido o ya venció.", "invalid_or_expired_token");
      await client.query(`UPDATE auth_tokens SET used_at = now() WHERE id = $1`, [found.rows[0].id]);
      await client.query(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1`, [found.rows[0].user_id]);
      await client.query(`INSERT INTO audit_log (actor_user_id, action, target_type, target_id) VALUES ($1, 'account.email_verified', 'user', $1)`, [found.rows[0].user_id]);
    });
    response.json({ verified: true });
  } catch (error) { next(error); }
});

authRouter.post("/resend-verification", async (request, response, next) => {
  try {
    const email = normalizeEmail(request.body.email);
    const found = await pool.query(`SELECT id, email_verified_at FROM users WHERE email = $1`, [email]);
    const user = found.rows[0];
    if (user && !user.email_verified_at) {
      const recent = await pool.query(`SELECT 1 FROM auth_tokens WHERE user_id = $1 AND purpose = 'verify_email' AND created_at > now() - interval '2 minutes'`, [user.id]);
      if (!recent.rowCount) {
        const rawToken = await createAuthToken(user.id, "verify_email", "24 hours");
        await sendTransactionalEmail(email, "Confirma tu cuenta de ConstruMatch", "Confirma tu correo", "Este nuevo enlace vence en 24 horas.", "Confirmar mi cuenta", `${config.appOrigin}/?verify=${encodeURIComponent(rawToken)}`);
      }
    }
    response.status(202).json({ message: "Si la cuenta requiere confirmación, enviaremos un correo." });
  } catch (error) { next(error); }
});

authRouter.post("/forgot-password", async (request, response, next) => {
  try {
    const email = normalizeEmail(request.body.email);
    const found = await pool.query(`SELECT id, email_verified_at FROM users WHERE email = $1`, [email]);
    const user = found.rows[0];
    if (user?.email_verified_at) {
      const recent = await pool.query(`SELECT 1 FROM auth_tokens WHERE user_id = $1 AND purpose = 'reset_password' AND created_at > now() - interval '2 minutes'`, [user.id]);
      if (!recent.rowCount) {
        const rawToken = await createAuthToken(user.id, "reset_password", "1 hour");
        await sendTransactionalEmail(email, "Recupera tu acceso a ConstruMatch", "Restablece tu contraseña", "El enlace es de un solo uso y vence en una hora.", "Crear nueva contraseña", `${config.appOrigin}/?reset=${encodeURIComponent(rawToken)}`);
      }
    }
    response.status(202).json({ message: "Si existe una cuenta confirmada, enviaremos las instrucciones." });
  } catch (error) { next(error); }
});

authRouter.post("/reset-password", async (request, response, next) => {
  try {
    const tokenHash = hashToken(text(request.body.token, 200));
    const nextHash = await hashPassword(text(request.body.password, 200));
    await withTransaction(async client => {
      const found = await client.query(`SELECT id, user_id FROM auth_tokens WHERE token_hash = $1 AND purpose = 'reset_password' AND used_at IS NULL AND expires_at > now() FOR UPDATE`, [tokenHash]);
      if (!found.rows[0]) throw new HttpError(400, "El enlace es inválido o ya venció.", "invalid_or_expired_token");
      await client.query(`UPDATE auth_tokens SET used_at = now() WHERE id = $1`, [found.rows[0].id]);
      await client.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [nextHash, found.rows[0].user_id]);
      await client.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [found.rows[0].user_id]);
      await client.query(`INSERT INTO audit_log (actor_user_id, action, target_type, target_id) VALUES ($1, 'account.password_reset', 'user', $1)`, [found.rows[0].user_id]);
    });
    response.status(204).end();
  } catch (error) { next(error); }
});

authRouter.post("/logout", requireUser, async (request, response, next) => {
  try {
    const token = parseCookies(request.get("cookie"))["cm_session"];
    if (token) await pool.query(`UPDATE sessions SET revoked_at = now() WHERE token_hash = $1`, [hashToken(token)]);
    response.setHeader("Set-Cookie", clearSessionCookie());
    response.status(204).end();
  } catch (error) { next(error); }
});

authRouter.post("/change-password", requireUser, async (request, response, next) => {
  try {
    const currentPassword = text(request.body.currentPassword, 200);
    const newPassword = text(request.body.newPassword, 200);
    if (currentPassword === newPassword) throw new HttpError(400, "La nueva contraseña debe ser distinta.", "password_unchanged");
    const found = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [request.user!.id]);
    if (!found.rows[0] || !await verifyPassword(currentPassword, found.rows[0].password_hash)) throw new HttpError(401, "La contraseña actual no es correcta.", "invalid_current_password");
    const nextHash = await hashPassword(newPassword);
    await withTransaction(async client => {
      await client.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [nextHash, request.user!.id]);
      await client.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [request.user!.id]);
      await client.query(`INSERT INTO audit_log (actor_user_id, action, target_type, target_id, reason) VALUES ($1, 'account.password_changed', 'user', $1, 'Cambio iniciado por el titular')`, [request.user!.id]);
    });
    response.setHeader("Set-Cookie", clearSessionCookie());
    response.status(204).end();
  } catch (error) { next(error); }
});

authRouter.post("/verification", requireUser, async (request, response, next) => {
  try {
    const legalName = text(request.body.legalName, 180);
    const documentReference = text(request.body.documentReference, 120);
    await pool.query(`INSERT INTO verification_requests (user_id, legal_name, document_reference) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET legal_name = EXCLUDED.legal_name, document_reference = EXCLUDED.document_reference, status = 'pending', submitted_at = now()`, [request.user!.id, legalName, documentReference]);
    response.status(202).json({ status: "pending" });
  } catch (error) { next(error); }
});
