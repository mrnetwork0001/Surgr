"use client";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ruleClassify } from "@/lib/classifier";
import { createInitialState, reduce } from "@/lib/readback";
import { buildLocalReport } from "@/lib/report";
import { SIM_SPEAKERS, findScenario, type SimSpeaker } from "@/lib/scenarios";
import type { Classification, OperativeReport, Role, TranscriptTurn } from "@/lib/types";
import { useStreaming } from "./useStreaming";
import { useVoiceAgent } from "./useVoiceAgent";

export interface SimStatus {
  scenarioId: string | null;
  lineIndex: number;
  playing: boolean;
}

export interface ReportResult {
  report: OperativeReport;
  generatedBy: string;
  warning?: string;
  retryAfterSec?: number;
}

const SIM_TURN_BASE = 100_000;
/** After a gateway 429 without a retry-after hint, skip LLM calls for this long. */
const LLM_BACKOFF_MS = 30_000;

function sameDrug(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

const DOSE_LIKE = /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|milligrams?|micrograms?|mics?|mikes?|grams?|units?|ml|cc)\b/i;
const CUE_LIKE = /\b(?:confirm|copy|roger|read back|got it|going in|is in|pushing|giving|administering|on board|give|push|administer|bolus|start)\b/i;

/**
 * The gateway budget on hackathon accounts is tiny (2 requests/min), so the LLM is only
 * consulted when the rule classifier saw something drug-related it could not resolve.
 */
function worthLLM(rules: Classification, text: string, hasOpenOrders: boolean): boolean {
  if (rules.kind === "drug_mention") return true;
  if (rules.kind === "drug_order" || rules.kind === "read_back") return rules.confidence < 0.8;
  if (rules.kind !== "other") return false;
  if (DOSE_LIKE.test(text)) return true;
  return hasOpenOrders && CUE_LIKE.test(text);
}

export function useSurgr() {
  const [state, dispatch] = useReducer(reduce, undefined, createInitialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [caps, setCaps] = useState<{ telegram: boolean; email: boolean }>({ telegram: false, email: false });
  const [llmEnabled, setLlmEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [llmInFlight, setLlmInFlight] = useState(0);
  const [llmModel, setLlmModel] = useState<string | null>(null);
  const [llmRateLimited, setLlmRateLimited] = useState(false);
  const llmBackoffUntil = useRef(0);
  const [sim, setSim] = useState<SimStatus>({ scenarioId: null, lineIndex: -1, playing: false });
  const [simSpeed, setSimSpeed] = useState(1);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [highlightTurnId, setHighlightTurnId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { hasKey?: boolean; telegram?: boolean; email?: boolean }) => {
        if (cancelled) return;
        setHasKey(!!d.hasKey);
        setCaps({ telegram: !!d.telegram, email: !!d.email });
      })
      .catch(() => {
        if (!cancelled) setHasKey(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => dispatch({ type: "tick", now: Date.now() }), 250);
    return () => window.clearInterval(t);
  }, []);

  const voice = useVoiceAgent({ enabled: voiceEnabled, hasKey: !!hasKey });
  const { speak, warmUp } = voice;
  const speakText = useCallback(
    (text: string) => {
      warmUp();
      speak(text);
    },
    [speak, warmUp],
  );

  // ---- Classification pipeline: rules first (instant), LLM Gateway for ambiguous turns ----
  const classify = useCallback(
    async (turn: TranscriptTurn) => {
      const rules = ruleClassify(turn.text);
      dispatch({ type: "classified", turnId: turn.id, classification: rules, now: Date.now() });
      if (!(llmEnabled && hasKey)) return;
      const s = stateRef.current;
      const hasOpenOrders = s.orders.some((o) => o.status !== "confirmed");
      if (!worthLLM(rules, turn.text, hasOpenOrders)) return;
      if (Date.now() < llmBackoffUntil.current) return;
      const roleOf = (label: string) => s.speakerRoles[label] ?? "unknown";
      const body = {
        text: turn.text,
        speakerLabel: turn.speakerLabel,
        role: roleOf(turn.speakerLabel),
        phase: s.phase,
        openOrders: s.orders
          .filter((o) => o.status === "pending" || o.status === "mismatch")
          .map((o) => ({ drug: o.drug, dose: o.dose, unit: o.unit, route: o.route, by: o.orderedByRole, status: o.status })),
        recentTurns: s.turns
          .filter((t) => t.isFinal && t.id !== turn.id)
          .slice(-6)
          .map((t) => ({ role: roleOf(t.speakerLabel), text: t.text })),
      };
      setLlmInFlight((n) => n + 1);
      try {
        const res = await fetch("/api/classify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 429) {
          const hinted = Number(res.headers.get("retry-after"));
          const backoff = Number.isFinite(hinted) && hinted > 0 ? Math.min(90_000, hinted * 1000 + 500) : LLM_BACKOFF_MS;
          llmBackoffUntil.current = Date.now() + backoff;
          setLlmRateLimited(true);
          window.setTimeout(() => setLlmRateLimited(false), backoff);
          return;
        }
        if (!res.ok) return;
        const usedModel = res.headers.get("x-surgr-model");
        if (usedModel) setLlmModel(usedModel);
        let llm = (await res.json()) as Classification;
        const latest = stateRef.current;
        const current = latest.turns.find((t) => t.id === turn.id);
        if (current?.classification?.applied) return;
        // Guard against the model inventing a new order when the speaker is answering an open one.
        if (llm.kind === "drug_order" && llm.drug) {
          const open = latest.orders.find((o) => o.status !== "confirmed" && sameDrug(o.drug, llm.drug) && o.orderedBy !== turn.speakerLabel);
          if (open) llm = { ...llm, kind: "read_back" };
        }
        const actionable = llm.kind !== "other" || (llm.checklistItemIds?.length ?? 0) > 0 || llm.phaseStart || llm.phaseEnd;
        if (!actionable) return;
        dispatch({ type: "classified", turnId: turn.id, classification: { ...llm, by: "llm" }, now: Date.now() });
      } catch {
        /* rules result already applied */
      } finally {
        setLlmInFlight((n) => Math.max(0, n - 1));
      }
    },
    [llmEnabled, hasKey],
  );

  const handleTurn = useCallback(
    (turn: TranscriptTurn) => {
      dispatch({ type: "turn", turn });
      if (turn.isFinal && turn.text.trim()) void classify(turn);
    },
    [classify],
  );

  const sessionStart = useCallback(() => dispatch({ type: "session_start", now: Date.now() }), []);
  const stt = useStreaming({ onTurn: handleTurn, onSessionStart: sessionStart });

  // ---- Voice alerts ----
  const spokenRef = useRef(new Set<string>());
  useEffect(() => {
    for (const a of state.alerts) {
      if (spokenRef.current.has(a.id)) continue;
      spokenRef.current.add(a.id);
      speak(a.spokenText);
    }
  }, [state.alerts, speak]);

  // ---- Simulator ----
  const simTimers = useRef<number[]>([]);
  const simCounter = useRef(0);

  const clearSimTimers = useCallback(() => {
    for (const t of simTimers.current) window.clearTimeout(t);
    simTimers.current = [];
  }, []);

  const injectLine = useCallback(
    (speaker: SimSpeaker, text: string) => {
      const now = Date.now();
      const s = stateRef.current;
      const base = s.sessionStartedAt ?? now;
      if (!s.sessionStartedAt) dispatch({ type: "session_start", now });
      const sp = SIM_SPEAKERS[speaker];
      if (!s.speakerRoles[sp.label]) dispatch({ type: "assign_role", label: sp.label, role: sp.role });

      const order = SIM_TURN_BASE + simCounter.current++;
      const id = `sim-${order}`;
      const tokens = text.split(/\s+/).filter(Boolean);
      const durationMs = Math.max(600, tokens.length * 320);
      const startMs = now - base;
      const partial: TranscriptTurn = {
        id,
        turnOrder: order,
        source: "sim",
        text: tokens.slice(0, Math.ceil(tokens.length / 2)).join(" "),
        isFinal: false,
        speakerLabel: sp.label,
        speakerConfidence: 0.95,
        words: [],
        startMs,
        endMs: startMs,
        receivedAt: now,
      };
      dispatch({ type: "turn", turn: partial });
      const timer = window.setTimeout(() => {
        const per = durationMs / tokens.length;
        const words = tokens.map((w, i) => ({
          text: w,
          start: Math.round(startMs + i * per),
          end: Math.round(startMs + (i + 1) * per),
          confidence: 0.97,
          speaker: sp.label,
        }));
        handleTurn({ ...partial, text, isFinal: true, words, endMs: startMs + durationMs, receivedAt: Date.now() });
      }, 450);
      simTimers.current.push(timer);
    },
    [handleTurn],
  );

  const stopScenario = useCallback(() => {
    clearSimTimers();
    setSim((s) => ({ ...s, playing: false }));
  }, [clearSimTimers]);

  const playScenario = useCallback(
    (id: string) => {
      const sc = findScenario(id);
      if (!sc) return;
      clearSimTimers();
      warmUp();
      for (const sp of Object.values(SIM_SPEAKERS)) {
        if (!stateRef.current.speakerRoles[sp.label]) dispatch({ type: "assign_role", label: sp.label, role: sp.role });
      }
      setSim({ scenarioId: id, lineIndex: -1, playing: true });
      let at = 0;
      sc.lines.forEach((line, idx) => {
        at += line.delayMs / simSpeed;
        const timer = window.setTimeout(() => {
          setSim((s) => ({ ...s, lineIndex: idx, playing: idx < sc.lines.length - 1 }));
          injectLine(line.speaker, line.text);
        }, at);
        simTimers.current.push(timer);
      });
    },
    [clearSimTimers, injectLine, simSpeed, warmUp],
  );

  useEffect(() => clearSimTimers, [clearSimTimers]);

  // ---- Session controls ----
  const startLive = useCallback(() => {
    warmUp();
    void stt.start();
  }, [stt, warmUp]);

  const stopLive = useCallback(() => stt.stop(), [stt]);

  const reset = useCallback(() => {
    clearSimTimers();
    stt.stop();
    simCounter.current = 0;
    spokenRef.current.clear();
    setSim({ scenarioId: null, lineIndex: -1, playing: false });
    setReport(null);
    setHighlightTurnId(null);
    dispatch({ type: "reset" });
  }, [clearSimTimers, stt]);

  const assignRole = useCallback((label: string, role: Role) => dispatch({ type: "assign_role", label, role }), []);
  const setSoloMode = useCallback((value: boolean) => dispatch({ type: "set_solo", value }), []);
  const ackAlert = useCallback((id: string) => dispatch({ type: "ack_alert", id }), []);
  const ackAllAlerts = useCallback(() => {
    for (const a of stateRef.current.alerts) if (!a.acknowledged) dispatch({ type: "ack_alert", id: a.id });
  }, []);

  // ---- Report ----
  const generateReport = useCallback(async () => {
    const s = stateRef.current;
    const local = buildLocalReport(s);
    setReportLoading(true);
    try {
      if (llmEnabled && hasKey) {
        const roleOf = (label: string) => s.speakerRoles[label] ?? "unknown";
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            report: local,
            transcript: s.turns.filter((t) => t.isFinal).map((t) => ({ id: t.id, atMs: t.startMs, role: roleOf(t.speakerLabel), text: t.text })),
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as ReportResult;
          if (data.retryAfterSec) {
            const backoff = Math.min(90_000, data.retryAfterSec * 1000 + 500);
            llmBackoffUntil.current = Math.max(llmBackoffUntil.current, Date.now() + backoff);
          }
          setReport(data);
          return;
        }
      }
      setReport({ report: local, generatedBy: "local" });
    } catch (e) {
      setReport({ report: local, generatedBy: "local", warning: e instanceof Error ? e.message : String(e) });
    } finally {
      setReportLoading(false);
    }
  }, [llmEnabled, hasKey]);

  const closeReport = useCallback(() => setReport(null), []);

  const jumpToTurn = useCallback((turnId: string) => {
    setReport(null);
    setHighlightTurnId(turnId);
    window.setTimeout(() => {
      document.getElementById(`turn-${turnId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
  }, []);

  const speakerLabels = useMemo(() => {
    const seen = new Set<string>();
    for (const t of state.turns) if (t.speakerLabel && t.speakerLabel !== "PENDING") seen.add(t.speakerLabel);
    for (const l of Object.keys(state.speakerRoles)) seen.add(l);
    return Array.from(seen).sort();
  }, [state.turns, state.speakerRoles]);

  const unacknowledged = useMemo(() => state.alerts.filter((a) => !a.acknowledged), [state.alerts]);

  return {
    state,
    hasKey,
    llmEnabled,
    setLlmEnabled,
    llmInFlight,
    llmModel,
    llmRateLimited,
    voiceEnabled,
    setVoiceEnabled,
    voice,
    caps,
    speakText,
    stopSpeaking: voice.stop,
    stt,
    startLive,
    stopLive,
    reset,
    assignRole,
    soloMode: state.soloMode,
    setSoloMode,
    ackAlert,
    ackAllAlerts,
    unacknowledged,
    speakerLabels,
    sim,
    simSpeed,
    setSimSpeed,
    playScenario,
    stopScenario,
    injectLine,
    report,
    reportLoading,
    generateReport,
    closeReport,
    jumpToTurn,
    highlightTurnId,
  };
}

export type Surgr = ReturnType<typeof useSurgr>;
