import type { NextFunction, Request, Response } from "express";
import { config, isProduction } from "../config.ts";
import { HttpError } from "../http.ts";

export function securityHeaders(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  if (isProduction) response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

export function requireSameOrigin(request: Request, _response: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
  const origin = request.get("origin");
  if (origin !== config.appOrigin) return next(new HttpError(403, "Origen no autorizado.", "origin_rejected"));
  next();
}

export function parseCookies(header = ""): Record<string, string> {
  return Object.fromEntries(header.split(";").map(part => part.trim().split("=")).filter(pair => pair.length === 2).map(([key, value]) => [key, decodeURIComponent(value)]));
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return [`cm_session=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", isProduction ? "Secure" : "", `Max-Age=${maxAgeSeconds}`].filter(Boolean).join("; ");
}

export const clearSessionCookie = (): string => sessionCookie("", 0);
