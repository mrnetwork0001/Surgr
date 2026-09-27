import { apiKey } from "@/lib/llm.server";

/** Mints a one-time Voice Agent session token for the browser. */
export async function GET() {
  const key = apiKey();
  if (!key) return Response.json({ error: "ASSEMBLYAI_API_KEY is not configured in .env.local" }, { status: 503 });
  const url = new URL("https://agents.assemblyai.com/v1/token");
  url.searchParams.set("expires_in_seconds", "300");
  url.searchParams.set("max_session_duration_seconds", "7200");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return Response.json({ error: `Voice Agent token request failed (${res.status}): ${body.slice(0, 200)}` }, { status: 502 });
  }
  const data = (await res.json()) as { token: string };
  return Response.json({ token: data.token, voiceId: process.env.SURGR_VOICE_ID || "george" });
}
