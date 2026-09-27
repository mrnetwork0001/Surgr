import "server-only";

const GATEWAY_URL = "https://llm-gateway.assemblyai.com/v1/chat/completions";

/**
 * Model access on the LLM Gateway is per account. Claude models are preferred when the
 * account has them; otherwise Surgr falls back to the gateway's always-available Qwen model.
 * Models that reject `response_format` are driven with the JSON schema embedded in the prompt.
 */
export const CLASSIFY_MODEL = process.env.SURGR_CLASSIFY_MODEL || "claude-haiku-4-5-20251001";
export const REPORT_MODEL = process.env.SURGR_REPORT_MODEL || "claude-sonnet-4-6";
export const FALLBACK_MODEL = process.env.SURGR_FALLBACK_MODEL || "qwen3.5-4b-32k-fast";

type Mode = "schema" | "prompt";

/** Learned per-model capabilities, kept for the life of the server instance. */
const rejectedModels = new Set<string>();
const modelMode = new Map<string, Mode>();

/** Rate-limit budget reported by the gateway's x-ratelimit-* headers (per server instance). */
const budget: { limit: number | null; remaining: number | null; resetAt: number | null } = { limit: null, remaining: null, resetAt: null };

export class GatewayError extends Error {
  status: number;
  retryAfterSec: number;
  constructor(message: string, status: number, retryAfterSec = 0) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

function readBudget(res: Response) {
  const lim = res.headers.get("x-ratelimit-limit");
  const rem = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("retry-after") ?? res.headers.get("x-ratelimit-reset");
  if (lim !== null && lim !== "") budget.limit = Number(lim);
  if (rem !== null && rem !== "") budget.remaining = Number(rem);
  if (reset !== null && reset !== "") budget.resetAt = Date.now() + Number(reset) * 1000;
}

export function gatewayRetryAfterSec(): number {
  if (budget.resetAt === null) return 0;
  return Math.max(0, Math.ceil((budget.resetAt - Date.now()) / 1000));
}

/** True when the last gateway response said the budget is spent and the window has not reset. */
export function gatewayExhausted(): boolean {
  return budget.remaining !== null && budget.remaining <= 0 && budget.resetAt !== null && Date.now() < budget.resetAt;
}

export function gatewayBudget() {
  return { limit: budget.limit, remaining: budget.remaining, retryAfterSec: gatewayRetryAfterSec() };
}

export function apiKey(): string | null {
  const k = process.env.ASSEMBLYAI_API_KEY?.trim();
  return k ? k : null;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface StructuredCall {
  model: string;
  messages: ChatMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  mode: Mode;
}

function isAccessError(message: string): boolean {
  return /does not have access|is not supported|not found|unknown model/i.test(message);
}

function isNoSchemaError(message: string): boolean {
  return /does not support response_format|response_format/i.test(message);
}

/** Pulls the first JSON object out of a free-text reply (fences, <think> blocks, prose). */
export function extractJson(text: string): string {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("LLM Gateway reply contained no JSON object");
  return t.slice(start, end + 1);
}

function withSchemaInstruction(messages: ChatMessage[], schema: Record<string, unknown>): ChatMessage[] {
  const instruction = `\n\nOUTPUT FORMAT: respond with ONLY one JSON object that conforms to this JSON Schema. No prose, no markdown fences, no explanation, no thinking.\n${JSON.stringify(schema)}`;
  const [first, ...rest] = messages;
  if (first?.role === "system") return [{ ...first, content: first.content + instruction }, ...rest];
  return [{ role: "system", content: instruction.trim() }, ...messages];
}

async function callGateway<T>(key: string, model: string, call: StructuredCall, mode: Mode): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call.timeoutMs ?? 8000);
  try {
    const body: Record<string, unknown> = {
      model,
      messages: mode === "schema" ? call.messages : withSchemaInstruction(call.messages, call.schema),
      max_tokens: call.maxTokens ?? 600,
      temperature: 0,
    };
    if (mode === "schema") {
      body.response_format = { type: "json_schema", json_schema: { name: call.schemaName, schema: call.schema, strict: true } };
      body.post_processing_steps = [{ type: "json-repair" }];
    }
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { authorization: key, "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    readBudget(res);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GatewayError(`LLM Gateway ${res.status}: ${text.slice(0, 300)}`, res.status, res.status === 429 ? gatewayRetryAfterSec() : 0);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM Gateway returned no content");
    return JSON.parse(mode === "schema" ? content : extractJson(content)) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls the AssemblyAI LLM Gateway for a JSON object matching `schema`.
 * Tries native structured outputs first, then prompt-embedded schema, then FALLBACK_MODEL.
 */
export async function structuredCompletion<T>(call: StructuredCall): Promise<StructuredResult<T>> {
  const key = apiKey();
  if (!key) throw new Error("ASSEMBLYAI_API_KEY is not configured");
  if (gatewayExhausted()) {
    throw new GatewayError(`LLM Gateway 429: budget exhausted, resets in ${gatewayRetryAfterSec()} s`, 429, gatewayRetryAfterSec());
  }
  const candidates = [call.model, FALLBACK_MODEL].filter((m, i, arr) => arr.indexOf(m) === i);
  let lastError: Error | null = null;
  for (const model of candidates) {
    const isLast = model === candidates[candidates.length - 1];
    if (rejectedModels.has(model) && !isLast) continue;
    let mode: Mode = modelMode.get(model) ?? "schema";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await callGateway<T>(key, model, call, mode);
        modelMode.set(model, mode);
        return { data, model, mode };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        lastError = err;
        if (mode === "schema" && isNoSchemaError(err.message)) {
          mode = "prompt";
          modelMode.set(model, "prompt");
          continue;
        }
        if (isAccessError(err.message)) {
          rejectedModels.add(model);
          break;
        }
        throw err;
      }
    }
  }
  throw lastError ?? new Error("LLM Gateway call failed");
}
