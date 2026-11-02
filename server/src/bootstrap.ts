import { pool } from "./db.ts";
import { hashPassword } from "./security/passwords.ts";

export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase() || "estructura.control";
  if (!email || !password) return;
  const found = await pool.query("SELECT id FROM users WHERE lower(email) = $1", [email]);
  if (found.rows[0]) {
    await pool.query("UPDATE users SET username = $1 WHERE id = $2", [username, found.rows[0].id]);
    return;
  }
  await pool.query(
    `INSERT INTO users (email, username, display_name, role, password_hash, verification_status)
     VALUES ($1, $2, 'Administración ConstruMatch', 'admin', $3, 'verified')`,
    [email, username, await hashPassword(password)],
  );
}
