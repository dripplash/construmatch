import { Router } from "express";
import { pool, withTransaction } from "../db.ts";
import { HttpError, text } from "../http.ts";
import { requireAnyRole, requireUser } from "../middleware/auth.ts";

export const profilesRouter = Router();
const providerRoles = ["company", "professional"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, "Datos de perfil inválidos.", "invalid_profile");
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) throw new HttpError(400, "Datos de perfil demasiado extensos.", "invalid_profile");
  return normalized;
}

function publicEmail(value: unknown): string {
  const email = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Correo público inválido.", "invalid_public_email");
  return email;
}

function phone(value: unknown): string {
  const normalized = text(value, 24);
  if (!/^\+?[0-9][0-9\s()-]{7,22}$/.test(normalized)) throw new HttpError(400, "Número de teléfono inválido.", "invalid_phone");
  return normalized;
}

function website(value: unknown): string | null {
  const normalized = optionalText(value, 300);
  if (!normalized) return null;
  let parsed: URL;
  try { parsed = new URL(normalized); } catch { throw new HttpError(400, "Sitio web inválido.", "invalid_website"); }
  if (parsed.protocol !== "https:") throw new HttpError(400, "El sitio web debe usar HTTPS.", "invalid_website");
  return parsed.toString();
}

function ensureUuid(value: string): void {
  if (!uuidPattern.test(value)) throw new HttpError(404, "Perfil no encontrado.", "not_found");
}

profilesRouter.get("/providers/:userId", async (request, response, next) => {
  try {
    ensureUuid(request.params.userId);
    const result = await pool.query(
      `SELECT u.id, u.display_name, u.role, p.commune, p.specialties, p.description, p.website,
              CASE WHEN p.show_contact THEN p.phone END AS phone,
              CASE WHEN p.show_contact THEN p.public_email END AS public_email,
              p.show_contact,
              CASE WHEN p.logo_upload_id IS NOT NULL THEN '/api/providers/' || u.id || '/logo' END AS logo_url
         FROM users u
         LEFT JOIN provider_profiles p ON p.user_id = u.id
        WHERE u.id = $1 AND u.role = ANY($2::account_role[])
          AND (u.verification_status = 'verified' OR u.id = $3)`,
      [request.params.userId, providerRoles, request.user?.id ?? null],
    );
    if (!result.rows[0]) throw new HttpError(404, "Perfil no encontrado.", "not_found");
    response.json(result.rows[0]);
  } catch (error) { next(error); }
});

profilesRouter.get("/providers/:userId/logo", async (request, response, next) => {
  try {
    ensureUuid(request.params.userId);
    const result = await pool.query(
      `SELECT up.mime_type, up.data, up.checksum
         FROM users u
         JOIN provider_profiles p ON p.user_id = u.id
         JOIN uploads up ON up.id = p.logo_upload_id
        WHERE u.id = $1 AND u.role = ANY($2::account_role[])
          AND (u.verification_status = 'verified' OR u.id = $3)`,
      [request.params.userId, providerRoles, request.user?.id ?? null],
    );
    const logo = result.rows[0];
    if (!logo) throw new HttpError(404, "Logo no encontrado.", "not_found");
    const etag = `"${logo.checksum}"`;
    if (request.get("if-none-match") === etag) return response.status(304).end();
    response.setHeader("Content-Type", logo.mime_type);
    response.setHeader("Content-Length", logo.data.length);
    response.setHeader("Cache-Control", "public, max-age=300");
    response.setHeader("ETag", etag);
    response.send(logo.data);
  } catch (error) { next(error); }
});

profilesRouter.get("/account/profile", requireUser, requireAnyRole(...providerRoles), async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.display_name, u.role, p.phone, p.public_email, p.commune, p.specialties,
              p.description, p.website, p.logo_upload_id, p.show_contact,
              CASE WHEN p.logo_upload_id IS NOT NULL THEN '/api/providers/' || u.id || '/logo' END AS logo_url
         FROM users u
         LEFT JOIN provider_profiles p ON p.user_id = u.id
        WHERE u.id = $1`,
      [request.user!.id],
    );
    response.json(result.rows[0]);
  } catch (error) { next(error); }
});

profilesRouter.put("/account/profile", requireUser, requireAnyRole(...providerRoles), async (request, response, next) => {
  try {
    const displayName = text(request.body.displayName, 140);
    const normalizedPhone = phone(request.body.phone);
    const normalizedEmail = publicEmail(request.body.publicEmail);
    const commune = text(request.body.commune, 100);
    const specialties = text(request.body.specialties, 500);
    const description = text(request.body.description, 1_200);
    const normalizedWebsite = website(request.body.website);
    if (typeof request.body.showContact !== "boolean") throw new HttpError(400, "Visibilidad de contacto inválida.", "invalid_profile");
    const showContact = request.body.showContact;
    const logoUploadId = request.body.logoUploadId === null || request.body.logoUploadId === undefined || request.body.logoUploadId === ""
      ? null
      : String(request.body.logoUploadId);
    if (logoUploadId && !uuidPattern.test(logoUploadId)) throw new HttpError(400, "Logo inválido.", "invalid_logo");

    const updated = await withTransaction(async client => {
      if (logoUploadId) {
        const upload = await client.query(
          `SELECT 1 FROM uploads WHERE id = $1 AND user_id = $2 AND mime_type IN ('image/jpeg', 'image/png', 'image/webp')`,
          [logoUploadId, request.user!.id],
        );
        if (!upload.rowCount) throw new HttpError(400, "El logo no pertenece a esta cuenta.", "invalid_logo");
      }
      await client.query(`UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2`, [displayName, request.user!.id]);
      const result = await client.query(
        `INSERT INTO provider_profiles (user_id, phone, public_email, commune, specialties, description, website, logo_upload_id, show_contact, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, public_email = EXCLUDED.public_email,
           commune = EXCLUDED.commune, specialties = EXCLUDED.specialties, description = EXCLUDED.description,
           website = EXCLUDED.website, logo_upload_id = COALESCE(EXCLUDED.logo_upload_id, provider_profiles.logo_upload_id),
           show_contact = EXCLUDED.show_contact, updated_at = now()
         RETURNING *`,
        [request.user!.id, normalizedPhone, normalizedEmail, commune, specialties, description, normalizedWebsite, logoUploadId, showContact],
      );
      return result.rows[0];
    });
    response.json({
      ...updated,
      display_name: displayName,
      logo_url: updated.logo_upload_id ? `/api/providers/${request.user!.id}/logo` : null,
    });
  } catch (error) { next(error); }
});
