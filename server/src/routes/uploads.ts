import { Router, raw } from "express";
import { createHash, randomUUID } from "node:crypto";
import { pool } from "../db.ts";
import { HttpError } from "../http.ts";
import { requireUser, requireVerified } from "../middleware/auth.ts";

export const uploadRouter = Router();
const allowed = new Map([
  ["image/jpeg", [[0xff, 0xd8, 0xff]]],
  ["image/png", [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]],
  ["image/webp", [[0x52, 0x49, 0x46, 0x46]]],
]);

function matchesMagic(buffer: Buffer, mime: string): boolean {
  if (mime === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return (allowed.get(mime) ?? []).some(signature => signature.every((value, index) => buffer[index] === value));
}

uploadRouter.post("/", requireUser, requireVerified, raw({ type: [...allowed.keys()], limit: "5mb" }), async (request, response, next) => {
  try {
    const mime = request.get("content-type")?.split(";")[0] ?? "";
    const body = request.body as Buffer;
    if (!Buffer.isBuffer(body) || !matchesMagic(body, mime)) throw new HttpError(415, "Formato de imagen no permitido.", "invalid_image");
    const storageKey = `${request.user!.id}/${randomUUID()}`;
    const checksum = createHash("sha256").update(body).digest("hex");
    const inserted = await pool.query(`INSERT INTO uploads (user_id, storage_key, mime_type, size_bytes, checksum, data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [request.user!.id, storageKey, mime, body.length, checksum, body]);
    response.status(201).json({ id: inserted.rows[0].id, key: storageKey, mime, size: body.length, checksum });
  } catch (error) { next(error); }
});
