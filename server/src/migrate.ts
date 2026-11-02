import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./db.ts";

const migrations = [
  ["001_initial", "../../db/schema.sql"],
  ["002_accounts_and_moderation", "../../db/002_accounts_and_moderation.sql"],
  ["003_project_uploads", "../../db/003_project_uploads.sql"],
  ["004_cleanup_qa", "../../db/004_cleanup_qa.sql"],
] as const;

export async function migrateDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(2147483001)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const [version, relativePath] of migrations) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
      if (applied.rowCount === 0) {
        const schemaPath = fileURLToPath(new URL(relativePath, import.meta.url));
        await client.query(await readFile(schemaPath, "utf8"));
        await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [version]);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrateDatabase().then(() => pool.end());
}
