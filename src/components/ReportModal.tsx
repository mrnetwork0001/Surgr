"use client";
import { useEffect, useState } from "react";
import type { ReportResult } from "@/hooks/useSurgr";
import { phaseLabel } from "@/lib/checklist";
import { ROLE_LABEL } from "@/lib/readback";
import { formatMs } from "@/lib/report";

interface Props {
  result: ReportResult;
  onClose: () => void;
  onJump: (turnId: string) => void;
  onRetry: () => void;
  retrying: boolean;
}

function useCountdown(seconds: number | undefined): number {
  const [left, setLeft] = useState(seconds ?? 0);
  useEffect(() => {
    if (!seconds) return;
    const end = Date.now() + seconds * 1000;
    const t = window.setInterval(() => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 500);
    return () => window.clearInterval(t);
  }, [seconds]);
  return seconds ? left : 0;
}

export default function ReportModal({ result, onClose, onJump, onRetry, retrying }: Props) {
  const r = result.report;
  const retryIn = useCountdown(result.retryAfterSec);
  const download = () => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `surgr-report-${r.generated_at.replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const Jump = ({ turnId, ms }: { turnId?: string; ms?: number }) =>
    turnId ? (
      <button className="link" onClick={() => onJump(turnId)} title="Jump to this moment in the transcript">
        {formatMs(ms)}
      </button>
    ) : (
      <span>{formatMs(ms)}</span>
    );

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal report" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div className="modal-head">
          <div>
            <h2 id="report-title">{r.title}</h2>
            <div className="muted">
              Generated {new Date(r.generated_at).toLocaleString()} · narrative by {result.generatedBy === "local" ? "Surgr rules engine" : `${result.generatedBy} via AssemblyAI LLM Gateway`} · every entry links to the audio timestamp
            </div>
            {result.warning && (
              <div className="warn-text">
                LLM narrative unavailable: {result.warning}
                {result.retryAfterSec !== undefined && (
                  <>
                    {" "}
                    <button className="btn btn-small" onClick={onRetry} disabled={retrying || retryIn > 0}>
                      {retrying ? "Retrying…" : retryIn > 0 ? `Retry narrative in ${retryIn} s` : "Retry LLM narrative"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-small" onClick={download}>
              Download JSON
            </button>
            <button className="btn btn-small" onClick={() => window.print()}>
              Print
            </button>
            <button className="btn btn-small btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="report-grid">
          <div className="report-stat">
            <div className="report-stat-value">{formatMs(r.session.duration_ms)}</div>
            <div className="report-stat-label">Session</div>
          </div>
          <div className="report-stat">
            <div className="report-stat-value">{r.communication_quality.confirmed_orders}/{r.communication_quality.total_orders}</div>
            <div className="report-stat-label">Orders closed</div>
          </div>
          <div className="report-stat">
            <div className="report-stat-value">{Math.round(r.communication_quality.closed_loop_rate * 100)}%</div>
            <div className="report-stat-label">Closed-loop rate</div>
          </div>
          <div className="report-stat">
            <div className="report-stat-value">{r.communication_quality.mean_readback_latency_ms === null ? "–" : `${(r.communication_quality.mean_readback_latency_ms / 1000).toFixed(1)} s`}</div>
            <div className="report-stat-label">Mean read-back time</div>
          </div>
          <div className="report-stat">
            <div className="report-stat-value">{r.safety_events.length}</div>
            <div className="report-stat-label">Safety events</div>
          </div>
        </div>

        <section>
          <h3>Procedure summary</h3>
          <p>{r.procedure_summary}</p>
        </section>

        <section>
          <h3>Medications (closed-loop record)</h3>
          {r.medications.length === 0 ? (
            <p className="muted">No verbal medication orders captured.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Drug</th>
                  <th>Dose</th>
                  <th>Route</th>
                  <th>Ordered</th>
                  <th>Read-back</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {r.medications.map((m) => (
                  <tr key={m.order_id}>
                    <td>{m.drug}</td>
                    <td>{m.dose}</td>
                    <td>{m.route}</td>
                    <td>
                      {ROLE_LABEL[m.ordered_by]} · <Jump turnId={m.order_turn_id} ms={m.ordered_at_ms} />
                    </td>
                    <td>
                      {m.readback_by ? (
                        <>
                          {ROLE_LABEL[m.readback_by]} · <Jump turnId={m.readback_turn_id} ms={m.readback_at_ms} />
                        </>
                      ) : (
                        <span className="muted">none</span>
                      )}
                    </td>
                    <td>
                      <span className={`status status-${m.readback_status}`}>{m.readback_status}</span>
                    </td>
                    <td className="muted">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h3>WHO checklist compliance</h3>
          <div className="report-phases">
            {r.checklist.map((c) => (
              <div key={c.phase} className="report-phase">
                <div className="report-phase-head">
                  <strong>{phaseLabel(c.phase)}</strong>
                  <span className={`status ${c.status === "complete" ? "status-confirmed" : c.status === "incomplete" ? "status-mismatch" : ""}`}>{c.status.replace("_", " ")}</span>
                </div>
                <ul>
                  {c.completed.map((i) => (
                    <li key={i.id} className="item-done">
                      ✓ {i.label} <Jump turnId={i.turn_id} ms={i.at_ms} />
                    </li>
                  ))}
                  {c.missed.map((i) => (
                    <li key={i.id} className={c.status === "not_started" ? "muted" : "item-missed"}>
                      {c.status === "not_started" ? "○" : "✕"} {i.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3>Safety events</h3>
          {r.safety_events.length === 0 ? (
            <p className="muted">No safety events.</p>
          ) : (
            <ul className="events">
              {r.safety_events.map((e, i) => (
                <li key={i} className={`event event-${e.severity}`}>
                  <Jump turnId={e.turn_id} ms={e.at_ms} /> <strong>{e.type.replace("_", " ")}</strong> — {e.description} <em>{e.resolution}</em>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3>Communication quality</h3>
          <p>{r.communication_quality.notes}</p>
        </section>

        <section>
          <h3>Recommendations</h3>
          <ul>
            {r.recommendations.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
