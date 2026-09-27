import { telegramCall, telegramToken, verifyChat } from "@/lib/share.server";

/** Sends the report PDF (multipart: chat, caption, file) to a linked chat. */
export async function POST(req: Request) {
  if (!telegramToken()) return Response.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 503 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "multipart form expected" }, { status: 400 });
  }
  const chatId = verifyChat(String(form.get("chat") ?? ""));
  const file = form.get("file");
  if (!chatId) return Response.json({ error: "Telegram is not linked" }, { status: 401 });
  if (!(file instanceof File)) return Response.json({ error: "file is required" }, { status: 400 });
  if (file.size > 4_000_000) return Response.json({ error: "file too large" }, { status: 413 });
  try {
    const out = new FormData();
    out.set("chat_id", chatId);
    out.set("caption", String(form.get("caption") ?? "Surgr operative communication record").slice(0, 1000));
    out.set("document", file, file.name || "surgr-report.pdf");
    await telegramCall("sendDocument", out);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Telegram send failed" }, { status: 502 });
  }
}
