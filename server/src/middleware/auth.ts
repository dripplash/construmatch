import type { NextFunction, Request, Response } from "express";
import { pool } from "../db.ts";
import { HttpError } from "../http.ts";
import { parseCookies } from "../security/requests.ts";
import { hashToken } from "../security/tokens.ts";

declare global {
  namespace Express {
    interface Request { user?: { id: string; role: "client" | "company" | "admin"; verificationStatus: string } }
  }
}

export async function loadSession(request: Request, _response: Response, next: NextFunction): Promise<void> {
  try {
    const token = parseCookies(request.get("cookie"))["cm_session"];
    if (!token) return next();
    const result = await pool.query(
      `SELECT u.id, u.role, u.verification_status
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
      [hashToken(token)],
    );
    const row = result.rows[0];
    if (row) request.user = { id: row.id, role: row.role, verificationStatus: row.verification_status };
    next();
  } catch (error) { next(error); }
}

export function requireUser(request: Request, _response: Response, next: NextFunction): void {
  if (!request.user) return next(new HttpError(401, "Debes iniciar sesión.", "authentication_required"));
  next();
}

export function requireRole(role: "client" | "company" | "admin") {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (request.user?.role !== role) return next(new HttpError(403, "Esta cuenta no tiene el rol requerido.", "role_required"));
    next();
  };
}

export function requireVerified(request: Request, _response: Response, next: NextFunction): void {
  if (request.user?.verificationStatus !== "verified") return next(new HttpError(403, "La cuenta debe estar validada.", "verification_required"));
  next();
}
