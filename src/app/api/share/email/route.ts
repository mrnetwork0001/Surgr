import { emailFrom, resendKey } from "@/lib/share.server";

/** Emails the report PDF via Resend (multipart: to, subject, text, file). */
export async function POST(req: Request) {
  const key = resendKey();
  if (!key) return Response.json({ error: "RESEND_API_KEY is not configured" }, { status: 503 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "multipart form expected" }, { status: 400 });
  }
  const to = String(form.get("to") ?? "").trim();
  const file = form.get("file");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return Response.json({ error: "a valid recipient address is required" }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: "file is required" }, { status: 400 });
  if (file.size > 4_000_000) return Response.json({ error: "file too large" }, { status: 413 });
  const content = Buffer.from(await file.arrayBuffer()).toString("base64");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: emailFrom(),
      to: [to],
      subject: String(form.get("subject") ?? "Surgr operative communication record").slice(0, 200),
      text: String(form.get("text") ?? "Attached: the Surgr operative communication record.").slice(0, 5000),
      attachments: [{ filename: file.name || "surgr-report.pdf", content }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return Response.json({ error: `Email provider ${res.status}: ${body.slice(0, 200)}` }, { status: 502 });
  }
  return Response.json({ ok: true });
}
