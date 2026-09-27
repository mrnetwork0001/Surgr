import { CHECKLIST_BY_ID, PHASES, itemsForPhase } from "./checklist";
import { formatDose } from "./drugs";
import { ROLE_LABEL } from "./readback";
import type { OperativeReport, SurgrState } from "./types";

export function formatMs(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || !Number.isFinite(ms)) return "--:--";
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Deterministic operative note built from Surgr's own state. Every timestamp is authoritative. */
export function buildLocalReport(state: SurgrState, now = Date.now()): OperativeReport {
  const finalTurns = state.turns.filter((t) => t.isFinal);
  const lastMs = finalTurns.length ? Math.max(...finalTurns.map((t) => t.endMs)) : 0;
  const duration = state.sessionStartedAt ? Math.max(now - state.sessionStartedAt, lastMs) : lastMs;

  const checklist = PHASES.map((p) => {
    const items = itemsForPhase(p.id);
    const completed = items
      .filter((i) => state.checklist[i.id]?.done)
      .map((i) => ({ id: i.id, label: i.label, at_ms: state.checklist[i.id]?.audioMs, turn_id: state.checklist[i.id]?.turnId }));
    const missed = items.filter((i) => !state.checklist[i.id]?.done).map((i) => ({ id: i.id, label: i.label }));
    const started = state.phaseHistory.some((h) => h.phase === p.id) || completed.length > 0;
    const status = !started ? "not_started" : missed.length === 0 ? "complete" : "incomplete";
    return { phase: p.id, status, completed, missed } as OperativeReport["checklist"][number];
  });

  const medications = state.orders.map((o) => ({
    order_id: o.id,
    drug: o.drug,
    dose: formatDose(o.dose, o.unit),
    route: o.route ?? "not stated",
    ordered_by: o.orderedByRole,
    ordered_at_ms: o.orderAudioMs,
    order_turn_id: o.orderTurnId,
    readback_status: o.status,
    readback_by: o.readBack?.role,
    readback_at_ms: o.readBack?.audioMs,
    readback_turn_id: o.readBack?.turnId,
    readback_text: o.readBack?.text,
    note:
      o.status === "confirmed" && o.readBack
        ? `Closed loop completed in ${((o.readBack.at - o.orderedAt) / 1000).toFixed(1)} s.`
        : o.status === "mismatch"
          ? `Read-back differed on ${o.readBack?.reasons.join(" and ")}; order not safely confirmed.`
          : o.status === "timeout"
            ? "No read-back received within 10 seconds of the order."
            : "Awaiting read-back.",
  }));

  const safety_events = state.alerts.map((a) => {
    const order = a.orderId ? state.orders.find((o) => o.id === a.orderId) : undefined;
    const resolution =
      a.type === "mismatch" || a.type === "timeout"
        ? order?.status === "confirmed"
          ? `Resolved: correct read-back received at ${formatMs(order.readBack?.audioMs)}.`
          : "Unresolved at end of session."
        : a.type === "checklist_skipped"
          ? "Items remained unconfirmed when the phase ended."
          : a.type === "no_timeout"
            ? state.phaseHistory.some((h) => h.phase === "time_out")
              ? "A Time Out was performed later in the session."
              : "No Time Out was performed during the session."
            : a.acknowledged
              ? "Acknowledged by the team."
              : "Not acknowledged.";
    return {
      type: a.type,
      severity: a.severity,
      at_ms: a.audioMs,
      description: `${a.title}. ${a.message}`,
      resolution,
      turn_id: a.turnId,
    };
  });

  const confirmed = state.orders.filter((o) => o.status === "confirmed");
  const latencies = confirmed.filter((o) => o.readBack).map((o) => o.readBack!.at - o.orderedAt);
  const meanLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;
  const total = state.orders.length;
  const rate = total ? confirmed.length / total : 0;
  const firstTry = confirmed.filter((o) => !state.alerts.some((a) => a.orderId === o.id)).length;

  const recommendations: string[] = [];
  if (state.alerts.some((a) => a.type === "mismatch")) recommendations.push("Reinforce dose read-back: repeat drug, dose and unit before administration.");
  if (state.alerts.some((a) => a.type === "timeout")) recommendations.push("Verbal orders must be acknowledged within 10 seconds; assign a designated responder.");
  if (state.alerts.some((a) => a.type === "self_readback")) recommendations.push("Read-back must come from the clinician administering the drug, not the one ordering it.");
  if (state.alerts.some((a) => a.type === "no_timeout")) recommendations.push("Complete a WHO Time Out before every incision.");
  if (checklist.some((c) => c.status === "incomplete")) recommendations.push("Checklist phases ended with unconfirmed items; review skipped items with the team.");
  if (checklist.some((c) => c.status === "not_started")) recommendations.push("Not all WHO checklist phases were observed; confirm they were performed and captured.");
  if (recommendations.length === 0) recommendations.push("No deviations recorded. Closed-loop communication and checklist compliance were complete.");

  const procTurn = state.checklist["so_procedure"]?.turnId ?? state.checklist["to_confirm"]?.turnId;
  const procText = procTurn ? state.turns.find((t) => t.id === procTurn)?.text : undefined;

  return {
    title: "Surgr Operative Communication Record",
    generated_at: new Date(now).toISOString(),
    generated_by: "local",
    session: {
      started_at: state.sessionStartedAt ? new Date(state.sessionStartedAt).toISOString() : null,
      duration_ms: duration,
      final_turns: finalTurns.length,
      speakers: Object.entries(state.speakerRoles).map(([label, role]) => ({ label, role })),
    },
    procedure_summary: procText
      ? `Procedure as stated by the team: "${procText.trim()}"`
      : "Procedure name was not captured from the team's verbal checklist.",
    checklist,
    medications,
    safety_events,
    communication_quality: {
      total_orders: total,
      confirmed_orders: confirmed.length,
      closed_loop_rate: rate,
      mean_readback_latency_ms: meanLatency,
      notes: total
        ? `${confirmed.length} of ${total} verbal orders were closed; ${firstTry} on the first read-back. ${state.alerts.length} safety alert${state.alerts.length === 1 ? "" : "s"} raised.`
        : "No verbal medication orders were captured.",
    },
    recommendations,
  };
}

export function checklistLabel(id: string): string {
  return CHECKLIST_BY_ID[id]?.label ?? id;
}

export function roleName(role: OperativeReport["medications"][number]["ordered_by"]): string {
  return ROLE_LABEL[role];
}
