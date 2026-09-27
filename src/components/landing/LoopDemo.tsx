"use client";
import { useEffect, useState } from "react";
import { ruleClassify } from "@/lib/classifier";
import { createInitialState, reduce } from "@/lib/readback";
import type { SurgrState, TranscriptTurn } from "@/lib/types";

const LINES = [
  { speaker: "S1", text: "Push 100 micrograms of fentanyl.", at: 900 },
  { speaker: "S2", text: "Pushing 10 micrograms fentanyl.", at: 3800 },
  { speaker: "S2", text: "Correction. 100 micrograms fentanyl, confirmed.", at: 9200 },
] as const;
const LOOP_MS = 14_500;

function seed(): SurgrState {
  let s = createInitialState();
  s = reduce(s, { type: "assign_role", label: "S1", role: "surgeon" });
  s = reduce(s, { type: "assign_role", label: "S2", role: "anesthesiologist" });
  return s;
}

const ROLE_COLOR: Record<string, string> = {
  surgeon: "border-l-sky-400 text-sky-300",
  anesthesiologist: "border-l-violet-400 text-violet-300",
};

/**
 * Runs the cockpit's own rule classifier and read-back state machine on a scripted
 * three-line exchange, so the loop visitors watch close is the real engine.
 */
export default function LoopDemo() {
  const [state, setState] = useState<SurgrState>(seed);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setState(seed()), 0));
    LINES.forEach((line, i) => {
      timers.push(
        window.setTimeout(() => {
          const now = Date.now();
          const turn: TranscriptTurn = {
            id: `demo-${cycle}-${i}`,
            turnOrder: i,
            source: "sim",
            text: line.text,
            isFinal: true,
            speakerLabel: line.speaker,
            words: [],
            startMs: line.at,
            endMs: line.at + 1200,
            receivedAt: now,
          };
          setState((prev) => {
            let s = reduce(prev, { type: "session_start", now: now - line.at });
            s = reduce(s, { type: "turn", turn });
            return reduce(s, { type: "classified", turnId: turn.id, classification: ruleClassify(line.text), now });
          });
        }, line.at),
      );
    });
    timers.push(window.setTimeout(() => setCycle((c) => c + 1), LOOP_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [cycle]);

  const order = state.orders[0];
  const alert = state.alerts[state.alerts.length - 1];
  const resolved = order?.status === "confirmed";
  const statusText =
    order?.status === "pending" ? "awaiting read-back" : order?.status === "mismatch" ? "dose mismatch" : order?.status === "confirmed" ? "closed loop" : "no read-back";
  const statusColor = order?.status === "confirmed" ? "text-emerald-300" : order?.status === "pending" ? "text-amber-300" : "text-red-400";

  return (
    <div className="liquid-glass flex min-h-[420px] flex-col gap-4 rounded-[1.25rem] p-5" aria-label="Live demonstration of Surgr's read-back verification">
      <div className="flex items-center justify-between font-body text-[11px] uppercase tracking-[0.12em] text-white/60">
        <span className="flex items-center gap-2 text-white/90">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" /> Live engine
        </span>
        <span className="hidden sm:block">same code as the cockpit</span>
      </div>

      <div className="flex min-h-[150px] flex-col gap-2">
        {state.turns.length === 0 && <div className="py-8 text-center font-body text-sm text-white/50">Listening to the room…</div>}
        {state.turns.map((t) => {
          const role = state.speakerRoles[t.speakerLabel] ?? "unknown";
          const kind = t.classification?.kind;
          return (
            <div key={t.id} className={`rounded-r-xl border-l-[3px] bg-white/[0.03] px-3 py-2 ${ROLE_COLOR[role] ?? "border-l-white/30"}`}>
              <div className="flex items-center gap-2 font-body text-[11px] font-semibold uppercase tracking-[0.08em]">
                {role === "surgeon" ? "Surgeon" : "Anesthesiologist"}
                {kind === "drug_order" && <span className="rounded-full border border-amber-400/50 px-2 py-px text-[10px] text-amber-300">order</span>}
                {kind === "read_back" && <span className="rounded-full border border-emerald-400/50 px-2 py-px text-[10px] text-emerald-300">read-back</span>}
              </div>
              <div className="font-body text-sm text-white">{t.text}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${order?.status === "mismatch" ? "shadow-[inset_0_0_0_1px_rgba(239,68,68,0.35)]" : ""}`}>
          {order ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading text-2xl italic capitalize text-white">
                  <span className="font-mono text-base not-italic text-teal-300">100 mcg</span> {order.drug}
                </span>
                <span className={`font-body text-[11px] font-semibold uppercase tracking-[0.06em] ${statusColor}`}>{statusText}</span>
              </div>
              <div className="mt-1 font-body text-xs text-white/60">
                {order.status === "pending" && "10 s window for anesthesia to read it back"}
                {order.status === "mismatch" && "heard 10 mcg · surgeon ordered 100 mcg"}
                {order.status === "confirmed" && "corrected read-back received"}
              </div>
            </>
          ) : (
            <span className="font-body text-xs text-white/60">Verbal orders appear here the moment they are spoken.</span>
          )}
        </div>
        <div className={`rounded-2xl border p-4 transition-colors ${alert && !resolved ? "border-red-500/70 bg-red-500/10 shadow-[0_10px_30px_rgba(239,68,68,0.2)]" : "border-white/10 bg-white/[0.03]"}`}>
          <div className={`font-body text-[11px] font-semibold uppercase tracking-[0.1em] ${alert && !resolved ? "text-red-300" : "text-white/60"}`}>Surgr says</div>
          <div className="mt-1 min-h-[3.6em] font-body text-xs leading-relaxed text-white/90">
            {alert && !resolved ? alert.spokenText : resolved ? "Loop closed. No further action." : "Silent until a read-back is wrong, missing, or a checklist item is skipped."}
          </div>
        </div>
      </div>
    </div>
  );
}
