import { signChat, telegramCall, telegramToken } from "@/lib/share.server";

interface Update {
  update_id: number;
  message?: { text?: string; chat: { id: number; first_name?: string; username?: string } };
}

/** Stateless check: scans the bot's recent updates for "/start <code>". */
export async function GET(req: Request) {
  if (!telegramToken()) return Response.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 503 });
  const code = new URL(req.url).searchParams.get("code")?.trim();
  if (!code) return Response.json({ error: "code is required" }, { status: 400 });
  try {
    const updates = await telegramCall<Update[]>(`getUpdates?offset=-100&allowed_updates=${encodeURIComponent('["message"]')}`);
    const hit = [...updates].reverse().find((u) => u.message?.text?.trim() === `/start ${code}`);
    if (!hit?.message) return Response.json({ linked: false });
    const chat = hit.message.chat;
    return Response.json({ linked: true, chat: signChat(chat.id), name: chat.first_name ?? chat.username ?? "Telegram" });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Telegram unavailable" }, { status: 502 });
  }
}
