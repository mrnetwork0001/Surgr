"use client";
import { useNow } from "@/hooks/useNow";
import { formatDose } from "@/lib/drugs";
import { READBACK_DEADLINE_MS, ROLE_LABEL } from "@/lib/readback";
import { formatMs } from "@/lib/report";
import type { DrugOrder, Role } from "@/lib/types";

interface Props {
  orders: DrugOrder[];
  speakerRoles: Record<string, Role>;
}

const STATUS_LABEL: Record<DrugOrder["status"], string> = {
  pending: "Awaiting read-back",
  confirmed: "Confirmed",
  mismatch: "Mismatch",
  timeout: "No read-back",
};

export default function OrderBoard({ orders }: Props) {
  const now = useNow(100);
  const open = orders.filter((o) => o.status === "pending" || o.status === "mismatch" || o.status === "timeout").length;
  const confirmed = orders.filter((o) => o.status === "confirmed").length;

  return (
    <>
      <div className="panel-head">
        <h2>Closed-loop orders</h2>
        <div className="stat-row">
          <span className="stat stat-ok">{confirmed} closed</span>
          <span className={`stat ${open ? "stat-warn" : ""}`}>{open} open</span>
        </div>
      </div>
      <div className="orders">
        {orders.length === 0 && <div className="empty">Verbal drug orders appear here with a 10-second read-back countdown.</div>}
        {orders
          .slice()
          .reverse()
          .map((o) => {
            const remaining = o.status === "pending" && now ? Math.max(0, o.deadlineAt - now) : 0;
            const pct = o.status === "pending" ? Math.round((remaining / READBACK_DEADLINE_MS) * 100) : 0;
            return (
              <div key={o.id} className={`order order-${o.status}`}>
                <div className="order-top">
                  <div className="order-drug">
                    <span className="order-dose">{formatDose(o.dose, o.unit)}</span> {o.drug}
                    {o.route && <span className="order-route">{o.route}</span>}
                  </div>
                  <span className={`status status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                </div>
                <div className="order-meta">
                  Ordered by {ROLE_LABEL[o.orderedByRole]} at {formatMs(o.orderAudioMs)}
                </div>
                {o.status === "pending" && (
                  <div className="countdown" aria-label="Read-back countdown">
                    <div className="countdown-bar" style={{ width: `${pct}%` }} />
                    <span className="countdown-text">{now ? (remaining / 1000).toFixed(1) : "--"} s</span>
                  </div>
                )}
                {o.readBack && (
                  <div className="readback">
                    <div className="readback-text">“{o.readBack.text.trim()}”</div>
                    <div className="readback-meta">
                      {ROLE_LABEL[o.readBack.role]} at {formatMs(o.readBack.audioMs)}
                      {o.status === "confirmed" && ` · closed in ${((o.readBack.at - o.orderedAt) / 1000).toFixed(1)} s`}
                      {o.status === "mismatch" && o.readBack.reasons.length > 0 && (
                        <span className="readback-reasons"> · heard {formatDose(o.readBack.dose, o.readBack.unit)} {o.readBack.drug ?? ""}{o.readBack.route ? ` ${o.readBack.route}` : ""} · {o.readBack.reasons.join(" & ")} differs</span>
                      )}
                    </div>
                  </div>
                )}
                {o.status === "timeout" && <div className="readback-meta">No read-back within {READBACK_DEADLINE_MS / 1000} s. Alert spoken into the room.</div>}
              </div>
            );
          })}
      </div>
    </>
  );
}
