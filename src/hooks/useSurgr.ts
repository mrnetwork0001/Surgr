"use client";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { CHECKLIST_BY_ID, itemsForPhase, phaseLabel } from "@/lib/checklist";
import { ruleClassify } from "@/lib/classifier";
import { formatDose } from "@/lib/drugs";
import { ROLE_LABEL } from "@/lib/readback";
import { createInitialState, reduce } from "@/lib/readback";
import { buildLocalReport } from "@/lib/report";
import { SIM_SPEAKERS, findScenario, type SimSpeaker } from "@/lib/scenarios";
import type { Classification, OperativeReport, Phase, Role, TranscriptTurn } from "@/lib/types";
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
/** "Surgr" as speech-to-text tends to hear it. "surgeon" is deliberately excluded. */
const WAKE_WORD = /\b(?:surgr|surger|sergr|surgur|sirgr|sergei|sergey|surgeur)\b/i;
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

  // ---- Tools the Voice Agent can call to answer "Surgr, ..." questions, from live state ----
  const answerTool = useCallback((name: string, args: Record<string, unknown>): unknown => {
    const s = stateRef.current;
    const now = Date.now();
    const describeOrder = (o: (typeof s.orders)[number]) => ({
      drug: o.drug,
      dose: formatDose(o.dose, o.unit),
      route: o.route ?? "not stated",
      status: o.status,
      ordered_by: ROLE_LABEL[o.orderedByRole],
      seconds_since_order: Math.round((now - o.orderedAt) / 1000),
      read_back: o.readBack ? { by: ROLE_LABEL[o.readBack.role], text: o.readBack.text, mismatch_on: o.readBack.reasons } : null,
    });
    switch (name) {
      case "get_open_orders": {
        const open = s.orders.filter((o) => o.status !== "confirmed").map(describeOrder);
        return { count: open.length, open, note: open.length === 0 ? "Every verbal order has been confirmed by a correct read-back." : undefined };
      }
      case "get_last_order": {
        const last = s.orders[s.orders.length - 1];
        return last ? describeOrder(last) : { note: "No verbal medication orders have been given yet." };
      }
      case "get_checklist_status": {
        const phase = (typeof args.phase === "string" ? (args.phase as Phase) : s.phase) ?? null;
        if (!phase) {
          const done = Object.values(s.checklist).filter((c) => c.done).length;
          return { current_phase: null, note: `No checklist phase is active. ${done} of 21 items have been confirmed so far.` };
        }
        const items = itemsForPhase(phase);
        return {
          phase: phaseLabel(phase),
          is_current: s.phase === phase,
          confirmed: items.filter((i) => s.checklist[i.id]?.done).map((i) => i.label),
          missing: items.filter((i) => !s.checklist[i.id]?.done).map((i) => i.label),
        };
      }
      case "get_session_summary": {
        const confirmed = s.orders.filter((o) => o.status === "confirmed").length;
        return {
          elapsed_seconds: s.sessionStartedAt ? Math.round((now - s.sessionStartedAt) / 1000) : 0,
          orders_total: s.orders.length,
          orders_confirmed: confirmed,
          closed_loop_rate_percent: s.orders.length ? Math.round((confirmed / s.orders.length) * 100) : null,
          alerts_total: s.alerts.length,
          unacknowledged_alerts: s.alerts.filter((a) => !a.acknowledged).length,
          current_phase: s.phase ? phaseLabel(s.phase) : null,
          checklist_items_confirmed: Object.values(s.checklist).filter((c) => c.done).length,
        };
      }
      case "get_recent_alerts": {
        const limit = typeof args.limit === "number" ? Math.max(1, Math.min(5, args.limit)) : 3;
        return {
          alerts: s.alerts
            .slice(-limit)
            .reverse()
            .map((a) => {
              const order = a.orderId ? s.orders.find((o) => o.id === a.orderId) : undefined;
              return { type: a.type, title: a.title, seconds_ago: Math.round((now - a.at) / 1000), resolved: order ? order.status === "confirmed" : a.acknowledged, acknowledged: a.acknowledged };
            }),
        };
      }
      case "acknowledge_alerts": {
        const pending = s.alerts.filter((a) => !a.acknowledged);
        for (const a of pending) dispatch({ type: "ack_alert", id: a.id });
        return { acknowledged: pending.length };
      }
      default:
        return { error: `unknown tool ${name}`, known_items: Object.keys(CHECKLIST_BY_ID).length };
    }
  }, []);

  const voice = useVoiceAgent({ enabled: voiceEnabled, hasKey: !!hasKey, tools: answerTool });
  const { speak, warmUp, feedAudio, setListening, noteQuestion } = voice;
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

  const wakeTriggered = useRef(new Set<string>());
  const handleTurn = useCallback(
    (turn: TranscriptTurn) => {
      dispatch({ type: "turn", turn });
      // A question addressed to Surgr is surfaced on the card and kept out of the safety pipeline; the agent hears it directly.
      if (turn.source === "live" && WAKE_WORD.test(turn.text)) {
        if (!wakeTriggered.current.has(turn.id)) {
          wakeTriggered.current.add(turn.id);
          noteQuestion(turn.text);
        }
        if (turn.isFinal) {
          dispatch({ type: "classified", turnId: turn.id, classification: { kind: "other", confidence: 1, by: "rules", summary: "Question to Surgr" }, now: Date.now() });
        }
        return;
      }
      if (turn.isFinal && turn.text.trim()) void classify(turn);
    },
    [classify, noteQuestion],
  );

  const sessionStart = useCallback(() => dispatch({ type: "session_start", now: Date.now() }), []);
  const stt = useStreaming({ onTurn: handleTurn, onSessionStart: sessionStart, onAudio: feedAudio });

  // The agent listens to the room for the whole live session and stops with it.
  useEffect(() => {
    setListening(stt.status === "listening" && voiceEnabled && !!hasKey);
  }, [stt.status, voiceEnabled, hasKey, setListening]);

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
    ask: voice.ask,
    askExchange: voice.exchange,
    suppressedReplies: voice.suppressedReplies,
    startAsk: voice.startAsk,
    stopAsk: voice.stopAsk,
    clearAsk: voice.clearExchange,
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
