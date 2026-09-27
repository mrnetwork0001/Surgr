import { apiKey } from "@/lib/llm.server";

export async function GET() {
  return Response.json({
    hasKey: apiKey() !== null,
    voiceId: process.env.SURGR_VOICE_ID || "george",
  });
}
