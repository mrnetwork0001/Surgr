"use client";
import { CHECKLIST, PHASES } from "@/lib/checklist";
import { formatMs } from "@/lib/report";
import type { ChecklistItemState, Phase, PhaseRecord } from "@/lib/types";

interface Props {
  checklist: Record<string, ChecklistItemState>;
  phase: Phase | null;
  phaseHistory: PhaseRecord[];
}

export default function ChecklistPanel({ checklist, phase, phaseHistory }: Props) {
  const total = CHECKLIST.length;
  const done = CHECKLIST.filter((i) => checklist[i.id]?.done).length;

  return (
    <>
      <div className="panel-head">
        <h2>WHO Surgical Safety Checklist</h2>
        <div className="stat-row">
          <span className="stat">
            {done}/{total}
          </span>
        </div>
      </div>
      <div className="checklist">
        {PHASES.map((p) => {
          const items = CHECKLIST.filter((i) => i.phase === p.id);
          const pDone = items.filter((i) => checklist[i.id]?.done).length;
          const record = phaseHistory.filter((h) => h.phase === p.id).at(-1);
          const active = phase === p.id;
          const status = active ? "active" : record?.endedAt ? (record.missedItemIds?.length ? "incomplete" : "complete") : pDone > 0 ? "partial" : "idle";
          return (
            <div key={p.id} className={`phase phase-${status}`}>
              <div className="phase-head">
                <div>
                  <div className="phase-name">{p.label}</div>
                  <div className="phase-when">{p.when}</div>
                </div>
                <div className="phase-status">
                  {status === "active" && <span className="status status-pending">In progress</span>}
                  {status === "complete" && <span className="status status-confirmed">Complete</span>}
                  {status === "incomplete" && <span className="status status-mismatch">Ended incomplete</span>}
                  {(status === "idle" || status === "partial") && (
                    <span className="status">
                      {pDone}/{items.length}
                    </span>
                  )}
                </div>
              </div>
              <ul className="items">
                {items.map((i) => {
                  const st = checklist[i.id];
                  const missed = !st?.done && record?.endedAt;
                  return (
                    <li key={i.id} className={`item ${st?.done ? "item-done" : ""} ${missed ? "item-missed" : ""}`}>
                      <span className="item-box" aria-hidden>
                        {st?.done ? "✓" : missed ? "✕" : ""}
                      </span>
                      <span className="item-label">{i.label}</span>
                      {st?.done && <span className="item-time">{formatMs(st.audioMs)}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
