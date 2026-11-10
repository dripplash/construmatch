import express from "express";
import { config } from "./config.ts";
import { pool } from "./db.ts";
import { sendError } from "./http.ts";
import { loadSession } from "./middleware/auth.ts";
import { requireSameOrigin, securityHeaders } from "./security/requests.ts";
import { authRouter } from "./routes/auth.ts";
import { marketplaceRouter } from "./routes/marketplace.ts";
import { uploadRouter } from "./routes/uploads.ts";
import { migrateDatabase } from "./migrate.ts";
import { bootstrapAdmin } from "./bootstrap.ts";
import { adminRouter } from "./routes/admin.ts";
import { profilesRouter } from "./routes/profiles.ts";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);
app.use(securityHeaders);
app.use(requireSameOrigin);
app.use(loadSession);
app.use("/api/uploads", uploadRouter);
app.use(express.json({ limit: "256kb", strict: true }));

app.get("/health", async (_request, response, next) => {
  try {
    await pool.query("SELECT 1");
    response.json({
      status: "ok",
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "local",
      features: ["provider_profiles", "secure_uploads", "project_assets"],
    });
  } catch (error) { next(error); }
});
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api", profilesRouter);
app.use("/api", marketplaceRouter);
app.use((_request, response) => response.status(404).json({ error: "not_found", message: "Recurso no encontrado." }));
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => sendError(response, error));

await migrateDatabase();
await bootstrapAdmin();
const server = app.listen(config.port, "0.0.0.0", () => console.log(`ConstruMatch API listening on ${config.port}`));

async function shutdown(): Promise<void> {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
