import { newLinkCode, telegramCall, telegramToken } from "@/lib/share.server";

/** Starts a link: the user opens the bot with this code and presses Start. */
export async function GET() {
  if (!telegramToken()) return Response.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 503 });
  try {
    const me = await telegramCall<{ username: string }>("getMe");
    const code = newLinkCode();
    return Response.json({ code, botUsername: me.username, deepLink: `https://t.me/${me.username}?start=${code}` });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Telegram unavailable" }, { status: 502 });
  }
}
