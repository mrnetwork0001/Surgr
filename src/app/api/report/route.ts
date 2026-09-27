import { GatewayError, REPORT_MODEL, apiKey, structuredCompletion } from "@/lib/llm.server";
import { formatMs } from "@/lib/report";
import type { OperativeReport } from "@/lib/types";

/** The narrative call can take up to 25 s; raise Vercel's default 10 s function limit. */
export const maxDuration = 30;

interface ReportRequest {
  report: OperativeReport;
  transcript: { id: string; atMs: number; role: string; text: string }[];
}

interface LlmEnrichment {
  procedure_summary: string;
  communication_notes: string;
  medication_notes: { order_id: string; note: string }[];
  recommendations: string[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    procedure_summary: { type: "string", description: "2-3 sentence clinical summary of the procedure and team communication." },
    communication_notes: { type: "string", description: "One paragraph assessing closed-loop communication quality." },
    medication_notes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { order_id: { type: "string" }, note: { type: "string" } },
        required: ["order_id", "note"],
      },
    },
    recommendations: { type: "array", items: { type: "string" } },
  },
  required: ["procedure_summary", "communication_notes", "medication_notes", "recommendations"],
};

const SYSTEM_PROMPT = `You are Surgr, writing the narrative sections of an audit-ready operating room communication record.
You are given the verbatim timestamped transcript and the structured facts Surgr extracted (medication orders, read-back outcomes, WHO checklist status, safety alerts).
Rules:
- Never invent facts. Only describe what the transcript and structured data show.
- Refer to times as mm:ss. Reference medications by their order_id when writing medication_notes.
- Be concise and clinical. Recommendations must be specific and actionable, at most five.
Return only the JSON object.`;

export async function POST(req: Request) {
  let body: ReportRequest;
  try {
    body = (await req.json()) as ReportRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.report) return Response.json({ error: "report is required" }, { status: 400 });
  if (!apiKey()) return Response.json({ report: body.report, generatedBy: "local" });

  const transcript = body.transcript.map((t) => `[${formatMs(t.atMs)}] ${t.role}: ${t.text}`).join("\n");
  const facts = JSON.stringify(
    {
      checklist: body.report.checklist,
      medications: body.report.medications,
      safety_events: body.report.safety_events,
      communication_quality: body.report.communication_quality,
    },
    null,
    1,
  );

  try {
    const { data: out, model } = await structuredCompletion<LlmEnrichment>({
      model: REPORT_MODEL,
      schemaName: "operative_narrative",
      schema: SCHEMA,
      maxTokens: 1200,
      timeoutMs: 25000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `TRANSCRIPT\n${transcript || "(no final transcript)"}\n\nSTRUCTURED FACTS\n${facts}` },
      ],
    });
    const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const notes = new Map(
      (Array.isArray(out.medication_notes) ? out.medication_notes : [])
        .filter((n) => n && typeof n.order_id === "string" && str(n.note))
        .map((n) => [n.order_id, n.note.trim()] as const),
    );
    const recs = Array.isArray(out.recommendations) ? out.recommendations.map(str).filter((r): r is string => !!r) : [];
    const merged: OperativeReport = {
      ...body.report,
      generated_by: model,
      procedure_summary: str(out.procedure_summary) ?? body.report.procedure_summary,
      medications: body.report.medications.map((m) => ({ ...m, note: notes.get(m.order_id) ?? m.note })),
      communication_quality: { ...body.report.communication_quality, notes: str(out.communication_notes) ?? body.report.communication_quality.notes },
      recommendations: recs.length ? recs.slice(0, 5) : body.report.recommendations,
    };
    return Response.json({ report: merged, generatedBy: model });
  } catch (e) {
    if (e instanceof GatewayError && e.status === 429) {
      return Response.json({
        report: body.report,
        generatedBy: "local",
        warning: `LLM Gateway rate limit reached (2 requests per minute on this account). Narrative sections use Surgr's local summary; retry in ${Math.max(1, e.retryAfterSec)} s.`,
        retryAfterSec: Math.max(1, e.retryAfterSec),
      });
    }
    const message = e instanceof Error ? e.message : "report generation failed";
    return Response.json({ report: body.report, generatedBy: "local", warning: message });
  }
}
