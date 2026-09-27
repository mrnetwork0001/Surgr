"use client";
import { useEffect, useRef } from "react";
import type { SttStatus } from "@/hooks/useStreaming";
import { ROLE_LABEL } from "@/lib/readback";
import { formatMs } from "@/lib/report";
import type { Classification, Role, TranscriptTurn } from "@/lib/types";

interface Props {
  turns: TranscriptTurn[];
  speakerRoles: Record<string, Role>;
  speakerLabels: string[];
  onAssignRole: (label: string, role: Role) => void;
  highlightTurnId: string | null;
  sttStatus: SttStatus;
  micLevel: number;
}

const ROLES: Role[] = ["surgeon", "anesthesiologist", "nurse", "unknown"];

function badge(c?: Classification): { text: string; cls: string } | null {
  if (!c) return null;
  switch (c.kind) {
    case "drug_order":
      return { text: "ORDER", cls: "badge-order" };
    case "read_back":
      return { text: c.applied ? "READ-BACK" : "READ-BACK (no open order)", cls: "badge-readback" };
    case "checklist_item":
      return { text: `CHECKLIST${c.checklistItemIds ? ` ×${c.checklistItemIds.length}` : ""}`, cls: "badge-checklist" };
    case "drug_mention":
      return c.applied ? { text: "READ-BACK", cls: "badge-readback" } : { text: "DRUG MENTION", cls: "badge-muted" };
    default:
      if (c.phaseStart) return { text: `PHASE START`, cls: "badge-checklist" };
      if (c.phaseEnd) return { text: `PHASE END`, cls: "badge-checklist" };
      return null;
  }
}

export default function TranscriptFeed({ turns, speakerRoles, speakerLabels, onAssignRole, highlightTurnId, sttStatus, micLevel }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  useEffect(() => {
    if (turns.length !== lastCount.current) {
      lastCount.current = turns.length;
      endRef.current?.scrollIntoView({ block: "end" });
    }
  }, [turns]);

  return (
    <>
      <div className="panel-head">
        <h2>Live transcript</h2>
        <div className="mic-meter" title="Microphone level">
          <div className="mic-meter-fill" style={{ width: `${Math.min(100, Math.round(micLevel * 400))}%` }} />
        </div>
      </div>

      <div className="speakers">
        {speakerLabels.length === 0 && <span className="muted">Speakers will appear here as they talk.</span>}
        {speakerLabels.map((label) => {
          const role = speakerRoles[label] ?? "unknown";
          return (
            <label key={label} className={`speaker-chip role-${role}`}>
              <span className="speaker-label">{label}</span>
              <select value={role} onChange={(e) => onAssignRole(label, e.target.value as Role)} aria-label={`Role for speaker ${label}`}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      <div className="feed">
        {turns.length === 0 && (
          <div className="empty">
            {sttStatus === "listening"
              ? "Listening. Speak an order such as “give fifty milligrams of propofol”."
              : "Start a live session or play a scenario below to see the room transcript."}
          </div>
        )}
        {turns.map((t) => {
          const role = speakerRoles[t.speakerLabel] ?? "unknown";
          const b = t.isFinal ? badge(t.classification) : null;
          return (
            <div
              key={t.id}
              id={`turn-${t.id}`}
              className={`turn role-${role} ${t.isFinal ? "" : "turn-partial"} ${highlightTurnId === t.id ? "turn-highlight" : ""}`}
            >
              <div className="turn-meta">
                <span className="turn-time">{formatMs(t.startMs)}</span>
                <span className="turn-role">{ROLE_LABEL[role]}</span>
                <span className="turn-label">{t.speakerLabel}</span>
              </div>
              <div className="turn-text">
                {t.text || "…"}
                {b && <span className={`badge ${b.cls}`}>{b.text}</span>}
                {t.classification?.by === "llm" && <span className="badge badge-muted">LLM</span>}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </>
  );
}
