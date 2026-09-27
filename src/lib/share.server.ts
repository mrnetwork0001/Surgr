import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const telegramToken = () => process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
export const resendKey = () => process.env.RESEND_API_KEY?.trim() || null;
export const emailFrom = () => process.env.SURGR_EMAIL_FROM?.trim() || "Surgr <onboarding@resend.dev>";

const tg = (method: string) => `https://api.telegram.org/bot${telegramToken()}/${method}`;

export async function telegramCall<T>(method: string, body?: BodyInit, headers?: HeadersInit): Promise<T> {
  const res = await fetch(tg(method), { method: body ? "POST" : "GET", body, headers, cache: "no-store" });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(data.description ?? `Telegram ${method} failed`);
  return data.result as T;
}

export function newLinkCode(): string {
  return randomBytes(9).toString("base64url");
}

/** Opaque, signed handle for a chat id so the raw id never round-trips unsigned. */
export function signChat(chatId: number | string): string {
  const id = String(chatId);
  const sig = createHmac("sha256", telegramToken() ?? "").update(id).digest("base64url").slice(0, 24);
  return `${id}.${sig}`;
}

export function verifyChat(handle: string): string | null {
  const [id, sig] = handle.split(".");
  if (!id || !sig) return null;
  const expect = createHmac("sha256", telegramToken() ?? "").update(id).digest("base64url").slice(0, 24);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
