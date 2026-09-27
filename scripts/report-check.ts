/* Builds state from the full_case scenario and posts it to the running dev server's /api/report. */
import { ruleClassify } from "../src/lib/classifier";
import { createInitialState, reduce } from "../src/lib/readback";
import { SIM_SPEAKERS, findScenario } from "../src/lib/scenarios";
import { buildLocalReport } from "../src/lib/report";
import type { SurgrState, TranscriptTurn } from "../src/lib/types";

const sc = findScenario("full_case")!;
let state: SurgrState = createInitialState();
let now = 1_000_000;
state = reduce(state, { type: "session_start", now });
for (const sp of Object.values(SIM_SPEAKERS)) state = reduce(state, { type: "assign_role", label: sp.label, role: sp.role });
sc.lines.forEach((line, i) => {
  now += line.delayMs;
  const turn: TranscriptTurn = { id: `sim-${i}`, turnOrder: i, source: "sim", text: line.text, isFinal: true, speakerLabel: line.speaker, words: [], startMs: now - 1_000_000, endMs: now - 1_000_000, receivedAt: now };
  state = reduce(state, { type: "turn", turn });
  state = reduce(state, { type: "classified", turnId: turn.id, classification: ruleClassify(line.text), now });
});
async function main() {
const local = buildLocalReport(state, now);
const roleOf = (l: string) => state.speakerRoles[l] ?? "unknown";
const t0 = Date.now();
const res = await fetch(`http://localhost:${process.env.PORT ?? 3005}/api/report`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ report: local, transcript: state.turns.map((t) => ({ id: t.id, atMs: t.startMs, role: roleOf(t.speakerLabel), text: t.text })) }),
});
const data = await res.json();
console.log("status:", res.status, "generatedBy:", data.generatedBy, "warning:", data.warning ?? "none", `(${Date.now() - t0} ms)`);
console.log("procedure_summary:", data.report.procedure_summary);
console.log("communication notes:", data.report.communication_quality.notes);
console.log("medication notes:", data.report.medications.map((m: { drug: string; note?: string }) => `${m.drug}: ${m.note}`).join("\n  "));
console.log("recommendations:", data.report.recommendations);
}
void main();
