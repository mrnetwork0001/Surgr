import { CHECKLIST_BY_ID, itemsForPhase, phaseLabel } from "./checklist";
import { formatDose, spokenDose, toMicrograms } from "./drugs";
import type {
  Classification,
  DrugOrder,
  MismatchReason,
  Phase,
  Role,
  SafetyAlert,
  SurgrState,
  TranscriptTurn,
} from "./types";

export const READBACK_DEADLINE_MS = 10_000;

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export type SurgrEvent =
  | { type: "session_start"; now: number }
  | { type: "turn"; turn: TranscriptTurn }
  | { type: "classified"; turnId: string; classification: Classification; now: number }
  | { type: "tick"; now: number }
  | { type: "assign_role"; label: string; role: Role }
  | { type: "ack_alert"; id: string }
  | { type: "set_solo"; value: boolean }
  | { type: "reset" };

export function createInitialState(): SurgrState {
  return {
    turns: [],
    speakerRoles: {},
    orders: [],
    alerts: [],
    checklist: {},
    phase: null,
    phaseHistory: [],
    sessionStartedAt: null,
    soloMode: false,
  };
}

export const ROLE_LABEL: Record<Role, string> = {
  surgeon: "Surgeon",
  anesthesiologist: "Anesthesiologist",
  nurse: "Scrub Nurse",
  unknown: "Unassigned",
};

const SPOKEN_ROLE: Record<Role, string> = {
  surgeon: "the surgeon",
  anesthesiologist: "anesthesia",
  nurse: "the nurse",
  unknown: "a team member",
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isRealLabel(label: string): boolean {
  return label !== "" && label !== "PENDING" && label !== "unknown";
}

function roleOf(state: SurgrState, label: string): Role {
  return state.speakerRoles[label] ?? "unknown";
}

function hasRole(state: SurgrState, role: Role): boolean {
  return Object.values(state.speakerRoles).includes(role);
}

function autoAssign(state: SurgrState, label: string, role: Role): SurgrState {
  if (!isRealLabel(label)) return state;
  if (state.speakerRoles[label]) return state;
  if (hasRole(state, role)) return state;
  return { ...state, speakerRoles: { ...state.speakerRoles, [label]: role } };
}

function addAlert(state: SurgrState, alert: Omit<SafetyAlert, "id" | "acknowledged">): SurgrState {
  return { ...state, alerts: [...state.alerts, { ...alert, id: nextId("alert"), acknowledged: false }] };
}

function sameDrug(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

function compareReadBack(order: DrugOrder, c: Classification): MismatchReason[] {
  const reasons: MismatchReason[] = [];
  if (c.drug && !sameDrug(order.drug, c.drug)) reasons.push("drug");
  if (order.dose !== undefined && c.dose !== undefined) {
    const a = toMicrograms(order.dose, order.unit);
    const b = toMicrograms(c.dose, c.unit);
    let equal: boolean;
    if (a !== null && b !== null) equal = Math.abs(a - b) < 1e-6;
    else if (c.unit === undefined || order.unit === undefined) equal = Math.abs(order.dose - c.dose) < 1e-6;
    else equal = order.unit === c.unit && Math.abs(order.dose - c.dose) < 1e-6;
    if (!equal) reasons.push("dose");
  }
  if (order.route && c.route && order.route !== c.route) reasons.push("route");
  return reasons;
}

function describeOrder(o: DrugOrder): string {
  return `${formatDose(o.dose, o.unit)} ${o.drug}${o.route ? ` ${o.route}` : ""}`;
}

function spokenOrder(o: DrugOrder): string {
  return `${spokenDose(o.dose, o.unit)} ${o.drug}${o.route ? ` ${o.route}` : ""}`;
}

function openOrder(state: SurgrState, turn: TranscriptTurn, c: Classification, now: number): SurgrState {
  if (!c.drug) return state;
  let s = autoAssign(state, turn.speakerLabel, "surgeon");
  const order: DrugOrder = {
    id: nextId("order"),
    drug: c.drug,
    dose: c.dose,
    unit: c.unit,
    route: c.route,
    originalText: turn.text,
    orderedBy: turn.speakerLabel,
    orderedByRole: roleOf(s, turn.speakerLabel),
    orderTurnId: turn.id,
    orderedAt: now,
    orderAudioMs: turn.startMs,
    deadlineAt: now + READBACK_DEADLINE_MS,
    status: "pending",
  };
  s = { ...s, orders: [...s.orders, order] };
  return s;
}

function applyReadBack(
  state: SurgrState,
  turn: TranscriptTurn,
  c: Classification,
  now: number,
): { state: SurgrState; applied: boolean } {
  const matchable = state.orders.filter((o) => o.status !== "confirmed");
  if (matchable.length === 0) return { state, applied: false };

  const byDrug = matchable.filter((o) => sameDrug(o.drug, c.drug));
  let candidate: DrugOrder | undefined;
  let drugMismatch = false;
  if (byDrug.length > 0) {
    candidate = byDrug.find((o) => o.status === "pending") ?? byDrug[byDrug.length - 1];
  } else if (c.kind === "read_back" && (c.readBackExplicit || !c.drug)) {
    // Explicit confirmation of the wrong drug, or a confirmation without naming a drug.
    candidate = matchable.find((o) => o.status === "pending") ?? matchable[matchable.length - 1];
    drugMismatch = !!c.drug;
  }
  if (!candidate) return { state, applied: false };

  const label = turn.speakerLabel;
  if (!state.soloMode && isRealLabel(label) && label === candidate.orderedBy && candidate.status === "pending") {
    const s = addAlert(state, {
      type: "self_readback",
      severity: "warning",
      title: "Read-back from the ordering clinician",
      message: `${describeOrder(candidate)} was repeated by the person who ordered it. Closed-loop confirmation must come from the person administering the drug.`,
      spokenText: `Read-back must come from the team member giving the drug, not the person ordering it. Please confirm ${spokenOrder(candidate)}.`,
      orderId: candidate.id,
      turnId: turn.id,
      at: now,
      audioMs: turn.startMs,
    });
    return { state: s, applied: true };
  }

  const reasons = drugMismatch ? (["drug"] as MismatchReason[]) : compareReadBack(candidate, c);
  let s = autoAssign(state, label, "anesthesiologist");
  const readBack = {
    text: turn.text,
    by: label,
    role: roleOf(s, label),
    turnId: turn.id,
    at: now,
    audioMs: turn.startMs,
    drug: c.drug,
    dose: c.dose,
    unit: c.unit,
    route: c.route,
    reasons,
  };
  const ok = reasons.length === 0;
  const updated: DrugOrder = {
    ...candidate,
    status: ok ? "confirmed" : "mismatch",
    readBack,
    resolvedAt: ok ? now : undefined,
  };
  s = { ...s, orders: s.orders.map((o) => (o.id === candidate.id ? updated : o)) };

  if (!ok) {
    const heard = c.drug || c.dose !== undefined
      ? `${spokenDose(c.dose ?? candidate.dose, c.unit ?? candidate.unit)} ${c.drug ?? candidate.drug}${c.route ? ` ${c.route}` : ""}`
      : "a different order";
    const what = reasons.map((r) => (r === "dose" ? "dose" : r === "drug" ? "drug" : "route")).join(" and ");
    s = addAlert(s, {
      type: "mismatch",
      severity: "critical",
      title: `Read-back ${what} mismatch`,
      message: `${ROLE_LABEL[candidate.orderedByRole]} ordered ${describeOrder(candidate)}. ${ROLE_LABEL[readBack.role]} read back "${turn.text.trim()}".`,
      spokenText: `Safety alert. Read-back ${what} mismatch. ${cap(SPOKEN_ROLE[candidate.orderedByRole])} ordered ${spokenOrder(candidate)}. ${cap(SPOKEN_ROLE[readBack.role])} read back ${heard}. Please stop and re-confirm.`,
      orderId: candidate.id,
      turnId: turn.id,
      at: now,
      audioMs: turn.startMs,
    });
  }
  return { state: s, applied: true };
}

function applyChecklist(state: SurgrState, turn: TranscriptTurn, ids: string[], now: number): { state: SurgrState; applied: boolean } {
  let s = state;
  let applied = false;
  for (const id of ids) {
    const def = CHECKLIST_BY_ID[id];
    if (!def) continue;
    if (s.phase && def.phase !== s.phase) continue;
    if (s.checklist[id]?.done) continue;
    s = { ...s, checklist: { ...s.checklist, [id]: { done: true, turnId: turn.id, at: now, audioMs: turn.startMs } } };
    applied = true;
  }
  if (applied && ids.some((id) => id === "so_counts" || id === "to_sterility" || id === "so_specimen")) {
    s = autoAssign(s, turn.speakerLabel, "nurse");
  }
  return { state: s, applied };
}

function endPhase(state: SurgrState, phase: Phase, turn: TranscriptTurn, now: number): { state: SurgrState; applied: boolean } {
  if (state.phase !== phase) {
    if (phase === "time_out" && !state.phaseHistory.some((p) => p.phase === "time_out") && !state.alerts.some((a) => a.type === "no_timeout")) {
      const s = addAlert(state, {
        type: "no_timeout",
        severity: "critical",
        title: "Incision called without a Time Out",
        message: "The team moved to incision but no WHO Time Out was performed.",
        spokenText: "Safety alert. Incision was called but no time out has been performed. Please stop and complete the time out before incision.",
        turnId: turn.id,
        at: now,
        audioMs: turn.startMs,
      });
      return { state: s, applied: true };
    }
    return { state, applied: false };
  }
  const missing = itemsForPhase(phase).filter((i) => !state.checklist[i.id]?.done);
  let s: SurgrState = {
    ...state,
    phase: null,
    phaseHistory: state.phaseHistory.map((p, idx) =>
      idx === state.phaseHistory.length - 1 && p.phase === phase && p.endedAt === undefined
        ? { ...p, endedAt: now, endAudioMs: turn.startMs, missedItemIds: missing.map((m) => m.id) }
        : p,
    ),
  };
  if (missing.length > 0) {
    const names = missing.map((m) => m.short.toLowerCase());
    const spokenList = names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")}, and ${names.length - 3} more`;
    s = addAlert(s, {
      type: "checklist_skipped",
      severity: missing.length >= 3 ? "critical" : "warning",
      title: `${phaseLabel(phase)} ended with ${missing.length} item${missing.length === 1 ? "" : "s"} unconfirmed`,
      message: `Not confirmed: ${missing.map((m) => m.label).join("; ")}.`,
      spokenText: `Checklist alert. ${phaseLabel(phase)} ended without confirming ${spokenList}. Please complete the checklist before proceeding.`,
      turnId: turn.id,
      at: now,
      audioMs: turn.startMs,
    });
  }
  return { state: s, applied: true };
}

function startPhase(state: SurgrState, phase: Phase, turn: TranscriptTurn, now: number): { state: SurgrState; applied: boolean } {
  if (state.phase === phase) return { state, applied: false };
  let s = state;
  if (s.phase) s = endPhase(s, s.phase, turn, now).state;
  s = {
    ...s,
    phase,
    phaseHistory: [...s.phaseHistory, { phase, startedAt: now, startAudioMs: turn.startMs }],
  };
  if (phase === "time_out" || phase === "sign_out") s = autoAssign(s, turn.speakerLabel, "nurse");
  return { state: s, applied: true };
}

function applyClassification(state: SurgrState, turn: TranscriptTurn, c: Classification, now: number): SurgrState {
  let s = state;
  let applied = false;

  if (c.phaseStart) {
    const r = startPhase(s, c.phaseStart, turn, now);
    s = r.state;
    applied = applied || r.applied;
  }

  if (c.kind === "drug_order" && c.drug) {
    s = openOrder(s, turn, c, now);
    applied = true;
  } else if (c.drug || c.kind === "read_back") {
    const r = applyReadBack(s, turn, c, now);
    s = r.state;
    applied = applied || r.applied;
  }

  // Outside an active checklist phase, only utterances that are primarily checklist
  // statements may tick items; a drug read-back that happens to mention an antibiotic must not.
  if (c.checklistItemIds?.length && (s.phase !== null || c.kind === "checklist_item")) {
    const r = applyChecklist(s, turn, c.checklistItemIds, now);
    s = r.state;
    applied = applied || r.applied;
  }

  if (c.phaseEnd) {
    const r = endPhase(s, c.phaseEnd, turn, now);
    s = r.state;
    applied = applied || r.applied;
  }

  const stamped: Classification = { ...c, applied };
  return { ...s, turns: s.turns.map((t) => (t.id === turn.id ? { ...t, classification: stamped } : t)) };
}

export function reduce(state: SurgrState, event: SurgrEvent): SurgrState {
  switch (event.type) {
    case "reset":
      return { ...createInitialState(), soloMode: state.soloMode };

    case "set_solo":
      return state.soloMode === event.value ? state : { ...state, soloMode: event.value };

    case "session_start":
      if (state.sessionStartedAt) return state;
      return { ...state, sessionStartedAt: event.now };

    case "assign_role": {
      const speakerRoles = { ...state.speakerRoles };
      if (event.role === "unknown") delete speakerRoles[event.label];
      else speakerRoles[event.label] = event.role;
      return { ...state, speakerRoles };
    }

    case "ack_alert":
      return { ...state, alerts: state.alerts.map((a) => (a.id === event.id ? { ...a, acknowledged: true } : a)) };

    case "turn": {
      const idx = state.turns.findIndex((t) => t.id === event.turn.id);
      const sessionStartedAt = state.sessionStartedAt ?? event.turn.receivedAt;
      if (idx === -1) return { ...state, sessionStartedAt, turns: [...state.turns, event.turn] };
      const existing = state.turns[idx];
      if (existing.isFinal && !event.turn.isFinal) return state;
      const merged: TranscriptTurn = { ...existing, ...event.turn, classification: existing.classification };
      const turns = state.turns.slice();
      turns[idx] = merged;
      return { ...state, sessionStartedAt, turns };
    }

    case "classified": {
      const turn = state.turns.find((t) => t.id === event.turnId);
      if (!turn) return state;
      return applyClassification(state, turn, event.classification, event.now);
    }

    case "tick": {
      const expired = state.orders.filter((o) => o.status === "pending" && o.deadlineAt <= event.now);
      if (expired.length === 0) return state;
      let s: SurgrState = {
        ...state,
        orders: state.orders.map((o) => (expired.includes(o) ? { ...o, status: "timeout" } : o)),
      };
      const base = s.sessionStartedAt ?? event.now;
      for (const o of expired) {
        s = addAlert(s, {
          type: "timeout",
          severity: "critical",
          title: "No read-back received",
          message: `${describeOrder(o)} ordered by ${ROLE_LABEL[o.orderedByRole].toLowerCase()} has not been read back within ${READBACK_DEADLINE_MS / 1000} seconds.`,
          spokenText: `Safety alert. No read-back received for ${spokenOrder(o)} ordered by ${SPOKEN_ROLE[o.orderedByRole]}. Anesthesia, please confirm the order.`,
          orderId: o.id,
          turnId: o.orderTurnId,
          at: event.now,
          audioMs: event.now - base,
        });
      }
      return s;
    }

    default:
      return state;
  }
}
