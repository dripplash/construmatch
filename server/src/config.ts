function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const config = Object.freeze({
  environment: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  appOrigin: required("APP_ORIGIN"),
  databaseUrl: required("DATABASE_URL"),
  databaseSsl: process.env.DATABASE_SSL ?? "require",
  sessionDays: Number(process.env.SESSION_DAYS ?? 7),
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "ConstruMatch <onboarding@resend.dev>",
});

export const isProduction = config.environment === "production";
