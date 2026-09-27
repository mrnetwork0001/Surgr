export type Role = "surgeon" | "anesthesiologist" | "nurse" | "unknown";
export type Phase = "sign_in" | "time_out" | "sign_out";
export type TurnSource = "live" | "sim";

export interface Word {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

export interface TranscriptTurn {
  id: string;
  turnOrder: number;
  source: TurnSource;
  text: string;
  isFinal: boolean;
  speakerLabel: string;
  speakerConfidence?: number;
  words: Word[];
  /** Milliseconds since session start (audio-relative). */
  startMs: number;
  endMs: number;
  /** Wall clock. */
  receivedAt: number;
  classification?: Classification;
}

export type ClassificationKind =
  | "drug_order"
  | "read_back"
  | "drug_mention"
  | "checklist_item"
  | "other";

export interface Classification {
  kind: ClassificationKind;
  drug?: string;
  dose?: number;
  unit?: string;
  route?: string;
  /** True when the read-back used an explicit confirmation word ("confirmed", "copy"). */
  readBackExplicit?: boolean;
  checklistItemIds?: string[];
  phaseStart?: Phase;
  phaseEnd?: Phase;
  confidence: number;
  by: "rules" | "llm";
  summary?: string;
  /** Set by the reducer: did this classification change state? */
  applied?: boolean;
}

export type OrderStatus = "pending" | "confirmed" | "mismatch" | "timeout";
export type MismatchReason = "drug" | "dose" | "route";

export interface ReadBack {
  text: string;
  by: string;
  role: Role;
  turnId: string;
  at: number;
  audioMs: number;
  drug?: string;
  dose?: number;
  unit?: string;
  route?: string;
  reasons: MismatchReason[];
}

export interface DrugOrder {
  id: string;
  drug: string;
  dose?: number;
  unit?: string;
  route?: string;
  originalText: string;
  orderedBy: string;
  orderedByRole: Role;
  orderTurnId: string;
  orderedAt: number;
  orderAudioMs: number;
  deadlineAt: number;
  status: OrderStatus;
  readBack?: ReadBack;
  resolvedAt?: number;
}

export type AlertType =
  | "mismatch"
  | "timeout"
  | "checklist_skipped"
  | "self_readback"
  | "no_timeout";

export interface SafetyAlert {
  id: string;
  type: AlertType;
  severity: "critical" | "warning";
  title: string;
  message: string;
  spokenText: string;
  orderId?: string;
  turnId?: string;
  at: number;
  audioMs: number;
  acknowledged: boolean;
}

export interface ChecklistItemState {
  done: boolean;
  turnId?: string;
  at?: number;
  audioMs?: number;
}

export interface PhaseRecord {
  phase: Phase;
  startedAt: number;
  startAudioMs: number;
  endedAt?: number;
  endAudioMs?: number;
  missedItemIds?: string[];
}

export interface SurgrState {
  turns: TranscriptTurn[];
  speakerRoles: Record<string, Role>;
  orders: DrugOrder[];
  alerts: SafetyAlert[];
  checklist: Record<string, ChecklistItemState>;
  phase: Phase | null;
  phaseHistory: PhaseRecord[];
  sessionStartedAt: number | null;
}

export interface OperativeReport {
  title: string;
  generated_at: string;
  generated_by: string;
  session: {
    started_at: string | null;
    duration_ms: number;
    final_turns: number;
    speakers: { label: string; role: Role }[];
  };
  procedure_summary: string;
  checklist: {
    phase: Phase;
    status: "complete" | "incomplete" | "not_started";
    completed: { id: string; label: string; at_ms?: number; turn_id?: string }[];
    missed: { id: string; label: string }[];
  }[];
  medications: {
    order_id: string;
    drug: string;
    dose: string;
    route: string;
    ordered_by: Role;
    ordered_at_ms: number;
    order_turn_id: string;
    readback_status: OrderStatus;
    readback_by?: Role;
    readback_at_ms?: number;
    readback_turn_id?: string;
    readback_text?: string;
    note?: string;
  }[];
  safety_events: {
    type: AlertType;
    severity: "critical" | "warning";
    at_ms: number;
    description: string;
    resolution: string;
    turn_id?: string;
  }[];
  communication_quality: {
    total_orders: number;
    confirmed_orders: number;
    closed_loop_rate: number;
    mean_readback_latency_ms: number | null;
    notes: string;
  };
  recommendations: string[];
}
