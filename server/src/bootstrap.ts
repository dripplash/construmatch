import { pool } from "./db.ts";
import { hashPassword } from "./security/passwords.ts";

export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const found = await pool.query("SELECT id FROM users WHERE lower(email) = $1", [email]);
  if (found.rowCount) return;
  await pool.query(
    `INSERT INTO users (email, display_name, role, password_hash, verification_status)
     VALUES ($1, 'Administración ConstruMatch', 'admin', $2, 'verified')`,
    [email, await hashPassword(password)],
  );
}
