import type { OperativeReport } from "./types";

/** A spoken post-op debrief, kept short enough to listen to (about 45 seconds). */
export function debriefText(r: OperativeReport): string {
  const q = r.communication_quality;
  const events = r.safety_events;
  const parts: string[] = ["Surgr debrief."];
  parts.push(r.procedure_summary.replace(/^Procedure as stated by the team:\s*/i, "The team stated: "));
  parts.push(
    q.total_orders === 0
      ? "No verbal medication orders were captured."
      : `${q.confirmed_orders} of ${q.total_orders} verbal orders were closed, a closed-loop rate of ${Math.round(q.closed_loop_rate * 100)} percent${q.mean_readback_latency_ms !== null ? `, with a mean read-back time of ${(q.mean_readback_latency_ms / 1000).toFixed(1)} seconds` : ""}.`,
  );
  if (events.length === 0) parts.push("No safety events were raised.");
  else {
    parts.push(`${events.length} safety ${events.length === 1 ? "event was" : "events were"} raised.`);
    for (const e of events.slice(0, 4)) parts.push(`${e.description.split(". ")[0]}. ${e.resolution}`);
  }
  const phases = r.checklist.map((c) => `${c.phase.replace("_", " ")} ${c.status.replace("_", " ")}`).join(", ");
  parts.push(`Checklist: ${phases}.`);
  if (r.recommendations.length) parts.push(`Recommendations: ${r.recommendations.slice(0, 3).join(" ")}`);
  parts.push("End of debrief.");
  return parts.join(" ").replace(/\s+/g, " ").slice(0, 1400);
}
