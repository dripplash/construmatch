import { Router, raw } from "express";
import { createHash, randomUUID } from "node:crypto";
import { pool } from "../db.ts";
import { HttpError } from "../http.ts";
import { requireUser, requireVerified } from "../middleware/auth.ts";
import { matchesUploadContent } from "../security/uploads.ts";

export const uploadRouter = Router();
const allowed = new Map<string, number>([
  ["image/jpeg", 5 * 1024 * 1024],
  ["image/png", 5 * 1024 * 1024],
  ["image/webp", 5 * 1024 * 1024],
  ["application/pdf", 15 * 1024 * 1024],
  ["model/gltf-binary", 15 * 1024 * 1024],
]);

function safeFileName(value: string | undefined, mime: string): string {
  const extensions: Record<string, string> = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf","model/gltf-binary":"glb"};
  let decoded = "";
  try { decoded = decodeURIComponent(value ?? ""); } catch { decoded = ""; }
  const cleaned = decoded.replace(/[^\p{L}\p{N}._ -]/gu, "").trim().slice(0, 180);
  return cleaned || `archivo.${extensions[mime]}`;
}

uploadRouter.post("/", requireUser, requireVerified, raw({ type: [...allowed.keys()], limit: "15mb" }), async (request, response, next) => {
  try {
    const mime = request.get("content-type")?.split(";")[0] ?? "";
    const body = request.body as Buffer;
    const maximum = allowed.get(mime);
    if (!maximum || !Buffer.isBuffer(body) || body.length < 1 || body.length > maximum || !matchesUploadContent(body, mime)) {
      throw new HttpError(415, "El contenido del archivo no coincide con un formato permitido.", "invalid_upload");
    }
    const originalName = safeFileName(request.get("x-file-name"), mime);
    const storageKey = `${request.user!.id}/${randomUUID()}`;
    const checksum = createHash("sha256").update(body).digest("hex");
    const inserted = await pool.query(`INSERT INTO uploads (user_id, storage_key, mime_type, size_bytes, checksum, data, original_name) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [request.user!.id, storageKey, mime, body.length, checksum, body, originalName]);
    response.status(201).json({ id: inserted.rows[0].id, key: storageKey, name: originalName, mime, size: body.length, checksum });
  } catch (error) { next(error); }
});
