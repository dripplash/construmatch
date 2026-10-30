import type { Response } from "express";

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "request_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendError(response: Response, error: unknown): void {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.code, message: error.message });
    return;
  }
  console.error(error);
  response.status(500).json({ error: "internal_error", message: "No fue posible completar la solicitud." });
}

export function text(value: unknown, maxLength: number): string {
  if (typeof value !== "string") throw new HttpError(400, "Datos inválidos.");
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new HttpError(400, "Datos inválidos.");
  return normalized;
}

export function positiveMoney(value: unknown): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new HttpError(400, "Monto inválido.");
  return amount;
}
