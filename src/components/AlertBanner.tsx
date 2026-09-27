"use client";
import type { VoiceStatus } from "@/hooks/useVoiceAgent";
import { formatMs } from "@/lib/report";
import type { SafetyAlert } from "@/lib/types";

interface Props {
  alerts: SafetyAlert[];
  onAck: (id: string) => void;
  onAckAll: () => void;
  voiceStatus: VoiceStatus;
}

export default function AlertBanner({ alerts, onAck, onAckAll, voiceStatus }: Props) {
  if (alerts.length === 0) return null;
  const visible = alerts.slice(-3).reverse();
  return (
    <div className="alerts" aria-live="assertive">
      {visible.map((a) => (
        <div key={a.id} className={`alert alert-${a.severity}`}>
          <div className="alert-icon" aria-hidden>
            {a.severity === "critical" ? "!" : "i"}
          </div>
          <div className="alert-body">
            <div className="alert-title">
              {a.title}
              <span className="alert-time">{formatMs(a.audioMs)}</span>
              {voiceStatus === "speaking" && <span className="alert-speaking">● speaking</span>}
            </div>
            <div className="alert-message">{a.message}</div>
          </div>
          <button className="btn btn-small" onClick={() => onAck(a.id)}>
            Acknowledge
          </button>
        </div>
      ))}
      {alerts.length > 1 && (
        <button className="btn btn-small btn-ghost alerts-clear" onClick={onAckAll}>
          Acknowledge all ({alerts.length})
        </button>
      )}
    </div>
  );
}
