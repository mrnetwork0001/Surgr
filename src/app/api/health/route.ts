import { apiKey } from "@/lib/llm.server";
import { resendKey, telegramToken } from "@/lib/share.server";

export async function GET() {
  return Response.json({
    hasKey: apiKey() !== null,
    voiceId: process.env.SURGR_VOICE_ID || "george",
    telegram: telegramToken() !== null,
    email: resendKey() !== null,
  });
}
