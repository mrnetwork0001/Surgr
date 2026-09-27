"use client";
import { useEffect, useState } from "react";
import { ruleClassify } from "@/lib/classifier";
import { createInitialState, reduce } from "@/lib/readback";
import type { SurgrState, TranscriptTurn } from "@/lib/types";
import styles from "./LandingDemo.module.css";

const LINES = [
  { speaker: "S1", role: "surgeon", text: "Push 100 micrograms of fentanyl.", at: 900 },
  { speaker: "S2", role: "anesthesiologist", text: "Pushing 10 micrograms fentanyl.", at: 3800 },
  { speaker: "S2", role: "anesthesiologist", text: "Correction. 100 micrograms fentanyl, confirmed.", at: 9200 },
] as const;
const LOOP_MS = 14_500;

function seed(): SurgrState {
  let s = createInitialState();
  s = reduce(s, { type: "assign_role", label: "S1", role: "surgeon" });
  s = reduce(s, { type: "assign_role", label: "S2", role: "anesthesiologist" });
  return s;
}

/**
 * The hero demo runs the same rule classifier and read-back state machine as the cockpit,
 * on a scripted three-line exchange, so what visitors see is the real engine.
 */
export default function LandingDemo() {
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

  return (
    <div className={styles.card} aria-label="Live demonstration of Surgr's read-back verification">
      <div className={styles.head}>
        <span className={styles.live}>
          <span className={styles.dot} /> Live engine
        </span>
        <span className={styles.caption}>Same classifier and state machine as the cockpit</span>
      </div>

      <div className={styles.transcript}>
        {state.turns.length === 0 && <div className={styles.placeholder}>Listening to the room…</div>}
        {state.turns.map((t) => {
          const role = state.speakerRoles[t.speakerLabel] ?? "unknown";
          const kind = t.classification?.kind;
          return (
            <div key={t.id} className={`${styles.turn} ${styles[role] ?? ""}`}>
              <div className={styles.meta}>
                <span className={styles.role}>{role === "surgeon" ? "Surgeon" : "Anesthesiologist"}</span>
                {kind === "drug_order" && <span className={`${styles.badge} ${styles.badgeOrder}`}>order</span>}
                {kind === "read_back" && <span className={`${styles.badge} ${styles.badgeReadback}`}>read-back</span>}
              </div>
              <div className={styles.text}>{t.text}</div>
            </div>
          );
        })}
      </div>

      <div className={styles.bottom}>
        <div className={`${styles.order} ${order ? styles[`order_${order.status}`] : styles.orderEmpty}`}>
          {order ? (
            <>
              <div className={styles.orderTop}>
                <span className={styles.drug}>
                  <strong>100 mcg</strong> {order.drug}
                </span>
                <span className={styles.status}>
                  {order.status === "pending" && "awaiting read-back"}
                  {order.status === "mismatch" && "dose mismatch"}
                  {order.status === "confirmed" && "closed loop ✓"}
                  {order.status === "timeout" && "no read-back"}
                </span>
              </div>
              <div className={styles.orderMeta}>
                {order.status === "pending" && "10 s window for anesthesia to read it back"}
                {order.status === "mismatch" && "heard 10 mcg · surgeon ordered 100 mcg"}
                {order.status === "confirmed" && "corrected read-back received"}
              </div>
            </>
          ) : (
            <span className={styles.orderMeta}>Verbal orders appear here the moment they are spoken.</span>
          )}
        </div>

        <div className={`${styles.voice} ${alert && !resolved ? styles.voiceActive : ""}`}>
          <div className={styles.voiceLabel}>
            <span className={styles.wave} aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
            Surgr says
          </div>
          <div className={styles.voiceText}>
            {alert && !resolved
              ? alert.spokenText
              : resolved
                ? "Loop closed. No further action."
                : "Silent until a read-back is wrong, missing, or a checklist item is skipped."}
          </div>
        </div>
      </div>
    </div>
  );
}
