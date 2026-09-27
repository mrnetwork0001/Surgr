import { apiKey } from "@/lib/llm.server";

/** Mints a short-lived AssemblyAI streaming token so the browser never sees the API key. */
export async function GET() {
  const key = apiKey();
  if (!key) return Response.json({ error: "ASSEMBLYAI_API_KEY is not configured in .env.local" }, { status: 503 });
  const url = new URL("https://streaming.assemblyai.com/v3/token");
  url.searchParams.set("expires_in_seconds", "120");
  url.searchParams.set("max_session_duration_seconds", "7200");
  const res = await fetch(url, { headers: { Authorization: key }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return Response.json({ error: `AssemblyAI token request failed (${res.status}): ${body.slice(0, 200)}` }, { status: 502 });
  }
  const data = (await res.json()) as { token: string; expires_in_seconds: number };
  return Response.json({ token: data.token, expiresInSeconds: data.expires_in_seconds });
}
