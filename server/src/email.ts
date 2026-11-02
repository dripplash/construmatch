import { config } from "./config.ts";
import { HttpError } from "./http.ts";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function sendTransactionalEmail(to: string, subject: string, heading: string, copy: string, actionLabel: string, actionUrl: string): Promise<void> {
  if (!config.resendApiKey) throw new HttpError(503, "El servicio de correo aún no está configurado.", "email_unavailable");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [to],
      subject,
      html: `<!doctype html><html><body style="margin:0;background:#f2efe7;color:#102c26;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:42px 24px"><p style="font-weight:700">ConstruMatch</p><div style="background:#fff;border:1px solid #cbd2cc;padding:34px"><h1 style="font-family:Georgia,serif;font-weight:400">${escapeHtml(heading)}</h1><p style="line-height:1.6;color:#586760">${escapeHtml(copy)}</p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#123d34;color:#fff;text-decoration:none;padding:14px 20px;margin:12px 0">${escapeHtml(actionLabel)}</a><p style="font-size:12px;color:#75817c">Si no solicitaste esto, ignora el mensaje. Nunca te pediremos tu contraseña por correo.</p></div></div></body></html>`,
    }),
  });
  if (!response.ok) {
    console.error("Email provider rejected request", response.status, await response.text());
    throw new HttpError(503, "No pudimos enviar el correo. Intenta nuevamente.", "email_delivery_failed");
  }
}
