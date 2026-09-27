/* Runs every simulator scenario through the rule classifier and state machine. */
import { ruleClassify } from "../src/lib/classifier";
import { createInitialState, reduce } from "../src/lib/readback";
import { SCENARIOS, SIM_SPEAKERS } from "../src/lib/scenarios";
import { buildLocalReport } from "../src/lib/report";
import type { SurgrState, TranscriptTurn } from "../src/lib/types";

function run(id: string) {
  const sc = SCENARIOS.find((s) => s.id === id)!;
  let state: SurgrState = createInitialState();
  let now = 1_000_000;
  state = reduce(state, { type: "session_start", now });
  for (const sp of Object.values(SIM_SPEAKERS)) state = reduce(state, { type: "assign_role", label: sp.label, role: sp.role });
  console.log(`\n=== ${sc.name} (${sc.id}) ===`);
  sc.lines.forEach((line, i) => {
    const before = now;
    now += line.delayMs;
    // advance ticks between lines
    const alertsBeforeTicks = state.alerts.length;
    for (let t = before + 250; t <= now; t += 250) state = reduce(state, { type: "tick", now: t });
    for (const a of state.alerts.slice(alertsBeforeTicks)) console.log(`   !! (tick) ${a.severity.toUpperCase()} ${a.type}: ${a.title}`);
    const turn: TranscriptTurn = {
      id: `sim-${i}`, turnOrder: i, source: "sim", text: line.text, isFinal: true,
      speakerLabel: line.speaker, words: [], startMs: now - 1_000_000, endMs: now - 1_000_000, receivedAt: now,
    };
    state = reduce(state, { type: "turn", turn });
    const c = ruleClassify(line.text);
    const alertsBefore = state.alerts.length;
    state = reduce(state, { type: "classified", turnId: turn.id, classification: c, now });
    const extra = [c.drug && `${c.dose ?? "?"} ${c.unit ?? ""} ${c.drug} ${c.route ?? ""}`.trim(), c.checklistItemIds?.join(","), c.phaseStart && `phase+${c.phaseStart}`, c.phaseEnd && `phase-${c.phaseEnd}`].filter(Boolean).join(" | ");
    console.log(`${line.speaker} "${line.text}"\n   -> ${c.kind} (${c.confidence}) ${extra}`);
    for (const a of state.alerts.slice(alertsBefore)) console.log(`   !! ${a.severity.toUpperCase()} ${a.type}: ${a.title}`);
  });
  for (let t = now + 250; t <= now + 11_000; t += 250) state = reduce(state, { type: "tick", now: t });
  const late = state.alerts.filter((a) => a.at > now);
  for (const a of late) console.log(`   !! (after end) ${a.type}: ${a.title}`);
  console.log("   orders:", state.orders.map((o) => `${o.drug} ${o.dose ?? ""}${o.unit ?? ""} => ${o.status}`).join("; ") || "none");
  console.log("   phases:", state.phaseHistory.map((p) => `${p.phase}${p.endedAt ? " done" : " open"}${p.missedItemIds?.length ? ` missed=${p.missedItemIds.join(",")}` : ""}`).join("; ") || "none");
  const r = buildLocalReport(state, now + 11_000);
  console.log("   report:", r.communication_quality.notes, "| checklist:", r.checklist.map((c) => `${c.phase}=${c.status}`).join(" "));
}
for (const s of SCENARIOS) run(s.id);
