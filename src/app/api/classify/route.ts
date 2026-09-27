import { CHECKLIST } from "@/lib/checklist";
import { canonicalDrug, extractRoute, normalizeUnit } from "@/lib/drugs";
import { CLASSIFY_MODEL, GatewayError, apiKey, structuredCompletion } from "@/lib/llm.server";
import type { Classification, ClassificationKind, Phase } from "@/lib/types";

interface ClassifyRequest {
  text: string;
  speakerLabel: string;
  role: string;
  phase: Phase | null;
  openOrders: { drug: string; dose?: number; unit?: string; route?: string; by: string; status: string }[];
  recentTurns: { role: string; text: string }[];
}

interface LlmClassification {
  kind: ClassificationKind;
  drug: string | null;
  dose: number | null;
  unit: string | null;
  route: string | null;
  read_back_explicit: boolean;
  checklist_item_ids: string[];
  phase_start: Phase | null;
  phase_end: Phase | null;
  confidence: number;
  summary: string;
}

const KINDS: ClassificationKind[] = ["drug_order", "read_back", "drug_mention", "checklist_item", "other"];
const PHASES: Phase[] = ["sign_in", "time_out", "sign_out"];
const ROUTES = ["IV", "IM", "PO", "SC", "epidural", "intrathecal", "topical", "inhaled", "SL", "PR"];
const ITEM_IDS = new Set(CHECKLIST.map((c) => c.id));

/** Small models driven by a prompt-embedded schema drift on enums; coerce everything back into range. */
function sanitize(out: Record<string, unknown>): LlmClassification {
  const norm = (v: unknown) => (typeof v === "string" ? v.toLowerCase().trim().replace(/[\s-]+/g, "_") : "");
  const kindRaw = norm(out.kind);
  const kind = (KINDS as string[]).includes(kindRaw) ? (kindRaw as ClassificationKind) : "other";
  const phase = (v: unknown): Phase | null => ((PHASES as string[]).includes(norm(v)) ? (norm(v) as Phase) : null);
  const routeRaw = typeof out.route === "string" ? out.route.trim().toLowerCase() : "";
  const route = ROUTES.find((r) => r.toLowerCase() === routeRaw) ?? null;
  const doseRaw = out.dose;
  const dose =
    typeof doseRaw === "number" && Number.isFinite(doseRaw)
      ? doseRaw
      : typeof doseRaw === "string" && doseRaw.trim() !== "" && Number.isFinite(Number(doseRaw))
        ? Number(doseRaw)
        : null;
  const ids = Array.isArray(out.checklist_item_ids)
    ? out.checklist_item_ids.filter((id): id is string => typeof id === "string" && ITEM_IDS.has(id))
    : [];
  const confidence = typeof out.confidence === "number" ? out.confidence : Number(out.confidence);
  return {
    kind,
    drug: typeof out.drug === "string" && out.drug.trim() ? canonicalDrug(out.drug) : null,
    dose,
    unit: normalizeUnit(typeof out.unit === "string" ? out.unit : null) ?? null,
    route,
    read_back_explicit: out.read_back_explicit === true,
    checklist_item_ids: ids,
    phase_start: phase(out.phase_start),
    phase_end: phase(out.phase_end),
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.7,
    summary: typeof out.summary === "string" ? out.summary : "",
  };
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: KINDS },
    drug: { type: ["string", "null"], description: "Generic drug name in lowercase, or null." },
    dose: { type: ["number", "null"] },
    unit: { type: ["string", "null"], enum: ["mg", "mcg", "g", "units", "mL", "mEq", "mg/kg", "mcg/kg", null] },
    route: { type: ["string", "null"], enum: [...ROUTES, null] },
    read_back_explicit: { type: "boolean" },
    checklist_item_ids: { type: "array", items: { type: "string", enum: CHECKLIST.map((c) => c.id) } },
    phase_start: { type: ["string", "null"], enum: [...PHASES, null] },
    phase_end: { type: ["string", "null"], enum: [...PHASES, null] },
    confidence: { type: "number" },
    summary: { type: "string" },
  },
  required: ["kind", "drug", "dose", "unit", "route", "read_back_explicit", "checklist_item_ids", "phase_start", "phase_end", "confidence", "summary"],
};

const SYSTEM_PROMPT = `You are Surgr, a surgical safety copilot listening to an operating room. Classify ONE spoken utterance.

Kinds:
- drug_order: a clinician orders or requests that a medication be given now ("give 50 mg propofol", "let's push fentanyl").
- read_back: someone repeats or confirms a medication order back, or states they are giving it now ("50 propofol, confirmed", "pushing 100 mics fentanyl", "cefazolin is in").
- drug_mention: a medication is mentioned but neither ordered nor read back (history, past administration, discussion).
- checklist_item: the utterance completes one or more WHO Surgical Safety Checklist items (ids below).
- other: anything else.

Extract dose as a number (convert number words; "mics" means mcg). Units: mg, mcg, g, units, mL, mEq, mg/kg, mcg/kg. Routes: IV, IM, PO, SC, epidural, intrathecal, topical, inhaled, SL, PR. Set route to null unless the route is actually spoken.
read_back_explicit is true only when a confirmation word is used (confirmed, copy, read back, roger, correction).
IMPORTANT: when an open medication order is listed in the context and a DIFFERENT speaker repeats its dose or says it is going in ("hundred mics going in", "got it, fifty"), that is a read_back of the open order, never a new drug_order. Fill drug from the open order when the speaker omits it.
phase_start: the utterance begins a checklist phase (sign_in = before induction, time_out = before incision, sign_out = before leaving OR). phase_end: it marks the phase's natural end (induction started, incision/knife requested, patient leaving to recovery).

Checklist item ids:
${CHECKLIST.map((c) => `- ${c.id} (${c.phase}): ${c.label}`).join("\n")}

Return only the JSON object.`;

export async function POST(req: Request) {
  if (!apiKey()) return Response.json({ error: "ASSEMBLYAI_API_KEY is not configured" }, { status: 503 });
  let body: ClassifyRequest;
  try {
    body = (await req.json()) as ClassifyRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.text?.trim()) return Response.json({ error: "text is required" }, { status: 400 });

  const openOrders = Array.isArray(body.openOrders) ? body.openOrders : [];
  const recentTurns = Array.isArray(body.recentTurns) ? body.recentTurns : [];
  const context = [
    `Current checklist phase: ${body.phase ?? "none"}.`,
    openOrders.length
      ? `Open medication orders awaiting read-back: ${openOrders.map((o) => `${o.dose ?? "?"} ${o.unit ?? ""} ${o.drug}${o.route ? ` ${o.route}` : ""} (ordered by ${o.by}, ${o.status})`).join("; ")}.`
      : "No open medication orders.",
    recentTurns.length ? `Recent utterances:\n${recentTurns.map((t) => `${t.role}: ${t.text}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { data: raw, model } = await structuredCompletion<Record<string, unknown>>({
      model: CLASSIFY_MODEL,
      schemaName: "or_utterance",
      schema: SCHEMA,
      maxTokens: 300,
      timeoutMs: 6000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${context}\n\nSpeaker ${body.speakerLabel} (${body.role}) said: "${body.text.trim()}"` },
      ],
    });
    const out = sanitize(raw);
    // Small models like to add "IV" on their own; only keep a route the speaker actually said.
    if (out.route && !extractRoute(body.text.toLowerCase())) out.route = null;
    const result: Classification = {
      kind: out.kind,
      drug: out.drug ?? undefined,
      dose: out.dose ?? undefined,
      unit: out.unit ?? undefined,
      route: out.route ?? undefined,
      readBackExplicit: out.kind === "read_back" ? out.read_back_explicit : undefined,
      checklistItemIds: out.checklist_item_ids.length ? out.checklist_item_ids : undefined,
      phaseStart: out.phase_start ?? undefined,
      phaseEnd: out.phase_end ?? undefined,
      confidence: out.confidence,
      by: "llm",
      summary: out.summary,
    };
    return Response.json(result, { headers: { "x-surgr-model": model } });
  } catch (e) {
    if (e instanceof GatewayError && e.status === 429) {
      return Response.json(
        { error: "LLM Gateway rate limit reached", retryAfterSec: e.retryAfterSec },
        { status: 429, headers: { "retry-after": String(Math.max(1, e.retryAfterSec)) } },
      );
    }
    const message = e instanceof Error ? e.message : "classification failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
