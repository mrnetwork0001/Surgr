// Builds deck/surgr-deck.pptx: 13 editable 16:9 slides in the Surgr look (black, glass cards, serif italic headings).
// Run: node deck/build-pptx.mjs   (needs pptxgenjs: npm i -D pptxgenjs)
import pptxgen from "pptxgenjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const img = (f) => path.join(here, "img", f);

const W = 13.333, H = 7.5, M = 0.6;
const C = { text: "FFFFFF", muted: "9AA3B2", faint: "6B7280", accent: "2DD4BF", blue: "38BDF8", ok: "22C55E", bad: "EF4444" };
const F = { head: "Cambria", body: "Calibri", mono: "Courier New" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Surgr";
pres.title = "Surgr — AssemblyAI Voice Agent Hackathon 2026";

/* ---------- helpers ---------- */
function base(slide, bg, n, notes) {
  slide.background = { path: img(bg) };
  // Wordmark: identical size and position on every slide (never shrinks).
  slide.addImage({ path: img("wordmark.png"), x: M, y: 0.38, w: 1.6, h: 0.533 });
  slide.addText(String(n).padStart(2, "0"), { x: W - M - 1.2, y: 0.42, w: 1.2, h: 0.4, align: "right", fontFace: F.mono, fontSize: 10, color: C.faint, charSpacing: 3, isTextBox: true, margin: 0 });
  if (notes) slide.addNotes(notes);
}
function kicker(slide, text, y = 1.25) {
  slide.addText(text.toUpperCase(), { x: M, y, w: 8, h: 0.3, fontFace: F.mono, fontSize: 11, color: C.muted, charSpacing: 4, isTextBox: true, margin: 0 });
}
function title(slide, text, opts = {}) {
  slide.addText(text, { x: M, y: opts.y ?? 1.55, w: opts.w ?? W - 2 * M, h: opts.h ?? 1.0, fontFace: F.head, italic: true, fontSize: opts.size ?? 40, color: C.text, isTextBox: true, margin: 0, valign: "top", fit: "shrink" });
}
function para(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, { x, y, w, h, fontFace: F.body, fontSize: opts.size ?? 15, color: opts.color ?? "D9DEE7", isTextBox: true, margin: 0, valign: opts.valign ?? "top", paraSpaceAfter: 4, fit: "shrink", ...(opts.extra || {}) });
}
function card(slide, x, y, w, h) {
  slide.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.18, fill: { color: "FFFFFF", transparency: 95 }, line: { color: "FFFFFF", width: 0.75, transparency: 82 } });
}
function cardText(slide, x, y, w, h, heading, body, opts = {}) {
  card(slide, x, y, w, h);
  let cy = y + 0.22;
  if (opts.num) {
    slide.addText(opts.num, { x: x + 0.25, y: cy, w: w - 0.5, h: 0.25, fontFace: F.mono, fontSize: 9, color: C.accent, charSpacing: 3, isTextBox: true, margin: 0 });
    cy += 0.32;
  }
  if (opts.stat) {
    slide.addText(opts.stat, { x: x + 0.25, y: cy, w: w - 0.5, h: 0.75, fontFace: F.head, italic: true, fontSize: opts.statSize ?? 38, color: C.text, isTextBox: true, margin: 0, valign: "top", fit: "shrink" });
    cy += 0.8;
  }
  if (heading) {
    const hs = opts.headSize ?? 22;
    // Estimate wrapped lines (Cambria italic ≈ 0.53 em per character) so long headings get a taller box.
    const lines = Math.max(1, Math.ceil((heading.length * 0.53 * hs) / 72 / (w - 0.5)));
    const hh = 0.42 * lines;
    slide.addText(heading, { x: x + 0.25, y: cy, w: w - 0.5, h: hh, fontFace: F.head, italic: true, fontSize: hs, color: C.text, isTextBox: true, margin: 0, valign: "top", fit: "shrink" });
    cy += hh + 0.06;
  }
  if (body) para(slide, body, x + 0.25, cy, w - 0.5, y + h - cy - 0.2, { size: opts.bodySize ?? 13.5 });
  if (opts.source) slide.addText(opts.source, { x: x + 0.25, y: y + h - 0.45, w: w - 0.5, h: 0.3, fontFace: F.body, fontSize: 10, color: C.faint, isTextBox: true, margin: 0 });
}
function bullets(slide, items, x, y, w, h, size = 15) {
  slide.addText(items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 8 } })), { x, y, w, h, fontFace: F.body, fontSize: size, color: "D9DEE7", isTextBox: true, margin: 0, valign: "top", fit: "shrink" });
}
function pill(slide, text, x, y, w, opts = {}) {
  slide.addShape(pres.ShapeType.roundRect, { x, y, w, h: 0.36, rectRadius: 0.18, fill: { color: "FFFFFF", transparency: 95 }, line: { color: "FFFFFF", width: 0.75, transparency: 75 } });
  slide.addText(text, { x, y, w, h: 0.36, align: "center", valign: "middle", fontFace: opts.mono ? F.mono : F.body, fontSize: opts.size ?? 11, color: opts.color ?? C.text, isTextBox: true, margin: 0 });
}
function tableDark(slide, rows, x, y, w, colW, opts = {}) {
  const header = rows[0].map((h) => ({ text: h.toUpperCase(), options: { fontFace: F.mono, fontSize: 9, color: C.muted, bold: false, charSpacing: 2, border: [{ type: "none" }, { type: "none" }, { pt: 0.75, color: "3A3F4A" }, { type: "none" }], fill: { color: "000000", transparency: 100 }, margin: [4, 6, 6, 0] } }));
  const body = rows.slice(1).map((r) => r.map((c, i) => ({ text: c, options: { fontFace: i === (opts.monoCol ?? -1) ? F.mono : F.body, fontSize: opts.size ?? 12.5, color: i === 0 ? C.text : "D9DEE7", bold: i === 0, border: [{ type: "none" }, { type: "none" }, { pt: 0.5, color: "262A33" }, { type: "none" }], fill: { color: "000000", transparency: 100 }, margin: [7, 6, 7, 0], valign: "top" } })));
  slide.addTable([header, ...body], { x, y, w, colW, autoPage: false });
}

/* ---------- 1 · Title ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-1.png", 1, "Surgr is a real-time closed-loop safety copilot for the operating room, built for the AssemblyAI Voice Agent Hackathon.");
  s.addText([
    { text: "Every verbal order in the OR, ", options: { color: C.text } },
    { text: "verified out loud.", options: { color: C.accent } },
  ], { x: M, y: 2.0, w: 11.5, h: 2.2, fontFace: F.head, italic: true, fontSize: 58, isTextBox: true, margin: 0, valign: "top", fit: "shrink" });
  para(s, "A real-time closed-loop safety copilot for the operating room. It listens, checks every drug order against its read-back, tracks the WHO checklist, speaks up when a loop does not close, and writes the audit record.", M, 4.45, 10.6, 1.2, { size: 19, color: "E5E9F0" });
  s.addText("ASSEMBLYAI VOICE AGENT HACKATHON · SEPTEMBER 2026 · GITHUB.COM/MRNETWORK0001/SURGR", { x: M, y: 6.35, w: 11.5, h: 0.35, fontFace: F.mono, fontSize: 10, color: C.faint, charSpacing: 2, isTextBox: true, margin: 0 });
}

/* ---------- 2 · Problem ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-4.png", 2, "Drugs are ordered by voice. Closed-loop communication is the standard but depends on people. One in twenty administrations involves an error; two thirds of sentinel events involve communication.");
  kicker(s, "The problem");
  title(s, "The loop breaks quietly", { h: 0.8 });
  para(s, "Drugs in surgery are ordered by voice. The standard is closed-loop communication: repeat the order back, get it confirmed, then act. Aviation made that mandatory decades ago. In an operating room it depends on people remembering under noise, fatigue and time pressure. Nothing beeps when a read-back does not happen.", M, 2.45, 12.1, 1.15, { size: 15 });
  const stats = [
    ["1 in 20", "perioperative medication administrations involve an error or adverse drug event", "Nanji et al., Anesthesiology, 2016"],
    ["11% → 7%", "major complications after the WHO Surgical Safety Checklist; deaths 1.5% → 0.8%", "Haynes et al., NEJM, 2009"],
    ["~2 in 3", "sentinel events involve a breakdown in team communication", "The Joint Commission"],
    ["310M+", "major operations performed worldwide every year", "Weiser et al., 2016"],
  ];
  const cw = (W - 2 * M - 3 * 0.25) / 4;
  stats.forEach(([v, l, src], i) => cardText(s, M + i * (cw + 0.25), 3.85, cw, 3.0, null, l, { stat: v, statSize: 34, source: src, bodySize: 13 }));
}

/* ---------- 3 · Product ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-2.png", 3, "Four stages: listen, understand, intervene, document. The spoken alert is the product.");
  kicker(s, "The product");
  title(s, "Listen, understand, intervene, document", { h: 0.8 });
  const steps = [
    ["01", "Listen", "Room audio streams to AssemblyAI. Medical mode gets drug names and doses right; speaker labels tell surgeon, anesthesiologist and nurse apart on one microphone."],
    ["02", "Understand", "A deterministic classifier parses orders, read-backs and checklist statements in under a millisecond. Ambiguous drug talk goes to the LLM Gateway under a strict JSON schema."],
    ["03", "Intervene", "Every order gets ten seconds to be read back. Wrong dose, wrong drug, wrong route or silence, and Surgr speaks the alert into the room through the Voice Agent."],
    ["04", "Document", "An operative record where every order, read-back, checklist item and safety event links to the exact second in the audio. PDF, Telegram, email, spoken debrief."],
  ];
  const cw = (W - 2 * M - 3 * 0.25) / 4;
  steps.forEach(([n, h, b], i) => cardText(s, M + i * (cw + 0.25), 2.5, cw, 2.6, h, b, { num: n, bodySize: 12, headSize: 20 }));
  card(s, M, 5.3, W - 2 * M, 1.6);
  s.addText("“Safety alert. Read-back dose mismatch. The surgeon ordered one hundred micrograms fentanyl. Anesthesia read back ten micrograms. Please stop and re-confirm.”", { x: M + 0.3, y: 5.42, w: W - 2 * M - 0.6, h: 0.9, fontFace: F.head, italic: true, fontSize: 19, color: C.text, isTextBox: true, margin: 0, valign: "top", fit: "shrink" });
  s.addText("What the room hears about one second after a wrong read-back. This sentence is the product.", { x: M + 0.3, y: 6.38, w: W - 2 * M - 0.6, h: 0.35, fontFace: F.body, fontSize: 11, color: C.muted, isTextBox: true, margin: 0 });
}

/* ---------- 4 · Cockpit ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-3.png", 4, "The cockpit exists for the circulating nurse, the debrief and the audit. Alerts are spoken. Nine scripted scenarios let a judge trigger a wrong dose without an operating room.");
  kicker(s, "The cockpit");
  card(s, M, 1.65, 7.7, 4.95);
  s.addImage({ path: img("cockpit.png"), x: M + 0.12, y: 1.77, w: 7.46, h: 4.66 });
  s.addText("One screen for the whole room. Nobody has to look at it.", { x: 8.65, y: 1.6, w: 4.1, h: 1.9, fontFace: F.head, italic: true, fontSize: 30, color: C.text, isTextBox: true, margin: 0, valign: "top", fit: "shrink" });
  bullets(s, [
    "Transcript by role, every order and read-back tagged as it lands.",
    "Order board with a ten-second countdown; a mismatch goes red and stays red until a correct read-back arrives.",
    "WHO checklist that ticks itself from speech; a phase that ends with gaps, or an incision without a Time Out, raises a spoken alert.",
    "Simulator with nine scripted scenarios so any judge can trigger a wrong dose without an operating room.",
  ], 8.65, 3.6, 4.1, 3.1, 13.5);
}

/* ---------- 5 · Ask Surgr ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-4.png", 5, "The Voice Agent listens to the room continuously. Say its name and it answers from live state through JSON-schema tools; everything else is answered with silence and discarded.");
  kicker(s, "Ask Surgr");
  s.addText("The room can ask it questions", { x: M, y: 1.55, w: 6.2, h: 1.2, fontFace: F.head, italic: true, fontSize: 34, color: C.text, isTextBox: true, margin: 0, valign: "top", fit: "shrink" });
  para(s, "The Voice Agent listens to the room for the whole case. Anything not addressed to Surgr is answered with silence, discarded before it plays. Say its name and it answers from live state through JSON-schema tools.", M, 2.85, 6.2, 1.3, { size: 14.5 });
  const tools = ["get_open_orders", "get_last_order", "get_checklist_status", "get_session_summary", "get_recent_alerts", "acknowledge_alerts"];
  tools.forEach((t, i) => pill(s, t, M + (i % 3) * 2.1, 4.35 + Math.floor(i / 3) * 0.48, 2.0, { mono: true, size: 9.5 }));
  card(s, 7.3, 1.6, 5.45, 2.6);
  s.addImage({ path: img("ask.png"), x: 7.5, y: 1.85, w: 5.05, h: 5.05 * (262 / 760) });
  card(s, M, 5.55, W - 2 * M, 1.4);
  s.addText("“Surgr, what is still open?”   →   “You have one open order for two grams of cefazolin.”", { x: M + 0.3, y: 5.65, w: W - 2 * M - 0.6, h: 0.7, fontFace: F.head, italic: true, fontSize: 20, color: C.text, isTextBox: true, margin: 0, valign: "top", fit: "shrink" });
  s.addText("Verified against the live Voice Agent API: tool call issued, result returned, answer spoken.", { x: M + 0.3, y: 6.42, w: W - 2 * M - 0.6, h: 0.35, fontFace: F.body, fontSize: 11, color: C.muted, isTextBox: true, margin: 0 });
}

/* ---------- 6 · Record ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-2.png", 6, "The audit record writes itself. Facts and timestamps come from Surgr's state; the LLM writes narrative only. Delivered as PDF, Telegram, email, share sheet, or spoken debrief.");
  kicker(s, "The record");
  card(s, M, 1.65, 6.0, 5.3);
  const rh = 5.06, rw = rh * (1040 / 952);
  s.addImage({ path: img("report.png"), x: M + (6.0 - rw) / 2, y: 1.77, w: rw, h: rh });
  s.addText("The audit writes itself", { x: 7.0, y: 1.6, w: 5.75, h: 1.15, fontFace: F.head, italic: true, fontSize: 34, color: C.text, isTextBox: true, margin: 0, valign: "top", fit: "shrink" });
  bullets(s, [
    "Closed-loop rate, mean read-back time, every medication with order and read-back timestamps.",
    "WHO compliance per phase, safety events with how they were resolved, recommendations.",
    "Facts and timestamps always come from Surgr's own state; the LLM only writes narrative, and the record says so.",
    "Delivered as PDF, to Telegram, by email, through the device share sheet, or read aloud as a spoken debrief.",
  ], 7.0, 2.9, 5.75, 3.8, 14);
}

/* ---------- 7 · Built on AssemblyAI ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-3.png", 7, "Four AssemblyAI products in one loop: Streaming v3 with medical mode and speaker labels, LLM Gateway, Voice Agent API.");
  kicker(s, "Built on AssemblyAI");
  title(s, "Four products, one safety loop", { h: 0.8 });
  const flow = ["Room mic", "Streaming STT v3", "Rules + LLM Gateway", "Read-back state machine", "Voice Agent · EHR record"];
  let fx = M;
  flow.forEach((t, i) => {
    const w = 0.22 * t.length + 0.5;
    pill(s, t, fx, 2.45, w, { mono: true, size: 10 });
    fx += w + 0.12;
    if (i < flow.length - 1) { s.addText("→", { x: fx - 0.06, y: 2.45, w: 0.3, h: 0.36, fontSize: 12, color: C.accent, align: "center", valign: "middle", isTextBox: true, margin: 0 }); fx += 0.3; }
  });
  tableDark(s, [
    ["Layer", "AssemblyAI product", "How Surgr uses it"],
    ["Live transcription", "Streaming v3 · universal-3-6-pro", "Medical mode formats drugs and doses; 47-drug keyterm list; clinician silence thresholds; short-lived browser tokens."],
    ["Who is speaking", "speaker_labels", "True diarization on one microphone, so a read-back from the person who gave the order is caught."],
    ["Understanding", "LLM Gateway", "JSON-schema classification of ambiguous drug talk; report narrative. Budget read from rate-limit headers; never blocks the safety loop."],
    ["Voice in the room", "Voice Agent API", "Alerts via reply.create; continuous room listening with silent-reply suppression; six client tools answer questions from live state."],
  ], M, 3.15, W - 2 * M, [2.3, 3.0, 6.83], { monoCol: 1, size: 12 });
}

/* ---------- 8 · Verified ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-4.png", 8, "Everything was tested against the live services: streaming, the Voice Agent with tool calling, and a real microphone session.");
  kicker(s, "What we verified");
  title(s, "Every integration tested against the live services", { h: 0.95, size: 33 });
  const cw = (W - 2 * M - 2 * 0.25) / 3;
  [
    ["Streaming", "A 78-second three-voice rehearsal streamed to AssemblyAI transcribed all nine lines verbatim, with two speaker labels and doses written as digits by medical mode."],
    ["Voice Agent", "A mismatch alert was spoken word for word (eleven seconds of audio). Tool calling confirmed: question in, get_open_orders called, answer spoken."],
    ["Live microphone", "A real session in Chrome: two voices separated, three alerts spoken at the right moments, orders closed, report exported, printed and delivered."],
  ].forEach(([h, b], i) => cardText(s, M + i * (cw + 0.25), 2.5, cw, 2.05, h, b, { bodySize: 12.5, headSize: 20 }));
  [["<1 ms", "rule classification per utterance"], ["≈1 s", "from a wrong read-back to the spoken alert"], ["10 s", "read-back window before a timeout alert"]].forEach(([v, l], i) => cardText(s, M + i * (cw + 0.25), 4.8, cw, 1.6, null, l, { stat: v, statSize: 34, bodySize: 12.5 }));
  s.addText("Nine scripted scenarios run through the engine as a regression suite. Solo demo mode and a rehearsal audio file let anyone test without a second person.", { x: M, y: 6.6, w: W - 2 * M, h: 0.4, fontFace: F.body, fontSize: 11, color: C.muted, isTextBox: true, margin: 0 });
}

/* ---------- 9 · Who gains ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-2.png", 9, "The anesthesiologist gains the most: a second check before the syringe goes in. Surgeons, nurses, the quality office and the patient all gain.");
  kicker(s, "Who gains");
  title(s, "Built for the people administering the drug", { h: 0.8, size: 36 });
  const cw = (W - 2 * M - 2 * 0.25) / 3;
  [
    ["Anesthesiologist", "A second check on every dose before the syringe goes in. The person who benefits most, because they are the one administering."],
    ["Surgeon", "Confirmation that what was said is what is being given, without policing it. Orders, read-backs and alerts documented for them."],
    ["Nurses", "The checklist tracks itself. No clipboard, no chasing eight items while the room moves on."],
  ].forEach(([h, b], i) => cardText(s, M + i * (cw + 0.25), 2.5, cw, 1.95, h, b, { bodySize: 13, headSize: 21 }));
  const hw = (W - 2 * M - 0.25) / 2;
  cardText(s, M, 4.7, hw, 2.1, "Quality & safety office", "Objective closed-loop and checklist compliance per room and per team, and a defensible timestamped record when an incident is reviewed.", { bodySize: 13, headSize: 21 });
  cardText(s, M + hw + 0.25, 4.7, hw, 2.1, "A day with it", "A microphone, a speaker, Surgr on the wall or nowhere visible. The team works as before. Once or twice a week it says “read-back mismatch, please re-confirm”. That sentence is the product.", { bodySize: 13, headSize: 21 });
}

/* ---------- 10 · Market ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-3.png", 10, "Priced per operating room. Beachhead is simulation centres and residency programmes where no regulatory clearance is needed.");
  kicker(s, "Market and model");
  title(s, "Priced per operating room", { h: 0.8 });
  const cw = (W - 2 * M - 2 * 0.25) / 3;
  [
    ["TAM", "310M+", "major operations a year worldwide, in an estimated 250,000+ operating rooms across hospitals and surgery centres."],
    ["SAM · United States first", "≈$240M/yr", "≈40,000 US operating rooms × $500 per OR per month. Sold to hospital quality and perioperative leadership."],
    ["Beachhead", "≈$10M/yr", "≈1,000 simulation centres and residency programmes at $10k per site licence, where instant spoken feedback needs no regulatory clearance."],
  ].forEach(([k, v, b], i) => cardText(s, M + i * (cw + 0.25), 2.5, cw, 2.75, null, b, { num: k, stat: v, statSize: 32, bodySize: 13 }));
  cardText(s, M, 5.5, W - 2 * M, 1.45, "Revenue streams", "Per-OR subscription for live use · site licences for simulation and training · analytics tier for quality offices · integration services for EHR export. Figures are planning estimates, not audited market data.", { bodySize: 13, headSize: 20 });
}

/* ---------- 11 · Competition ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-4.png", 11, "Scribes document after the fact, black-box products review retrospectively, checklist apps need taps. Surgr intervenes in the moment with a deterministic engine.");
  kicker(s, "Competitive landscape");
  title(s, "Others document or review. Surgr intervenes.", { h: 0.8, size: 36 });
  tableDark(s, [
    ["Category", "Examples", "What they do", "What Surgr does differently"],
    ["Ambient clinical scribes", "Abridge, Nuance DAX, Ambience", "Turn conversations into notes after the fact.", "Acts during the case, in the room, out loud."],
    ["OR black-box analytics", "Surgical Safety Technologies", "Record the OR for retrospective review.", "Closes the loop in the moment; the record is a by-product."],
    ["Checklist apps", "Digital WHO checklists", "Someone taps items on a tablet.", "Items tick from speech; skipped phases are spoken alerts."],
    ["Hackathon look-alikes", "OR and resuscitation voice recorders", "Same instinct: transcribe and flag.", "Deterministic dose and unit logic, speaker-aware self-read-back detection, a room that can ask questions, delivery to Telegram and a spoken debrief, all verified live."],
  ], M, 2.55, W - 2 * M, [2.4, 2.7, 3.0, 4.03], { size: 12 });
  s.addText("Moat: the deterministic safety engine and the evidence base it produces, not the transcription layer.", { x: M, y: 6.55, w: W - 2 * M, h: 0.4, fontFace: F.body, fontSize: 11, color: C.muted, isTextBox: true, margin: 0 });
}

/* ---------- 12 · Roadmap ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-2.png", 12, "Three stages: training, silent analytics, live intervention after validation. Plain about limitations.");
  kicker(s, "Roadmap and honesty");
  title(s, "Three stages into the operating room", { h: 0.8 });
  const cw = (W - 2 * M - 2 * 0.25) / 3;
  [
    ["STAGE 1 · NOW", "Simulation and training", "Residency programmes and simulation labs. Instant spoken feedback teaches closed-loop discipline. No regulatory barrier."],
    ["STAGE 2", "Silent mode in real ORs", "Compliance analytics per room and per team, no intervention. Builds the evidence base and the pilot relationships."],
    ["STAGE 3", "Live intervention", "After clinical validation and regulatory clearance. Multilingual rooms, EHR integration, on-premise audio."],
  ].forEach(([n, h, b], i) => cardText(s, M + i * (cw + 0.25), 2.5, cw, 2.35, h, b, { num: n, bodySize: 13, headSize: 21 }));
  cardText(s, M, 5.1, W - 2 * M, 1.85, "What we say plainly", "Surgr is a prototype, not a medical device. Similar voices can share a speaker label. Hackathon accounts get two LLM Gateway requests a minute, so the deterministic engine does the real-time work and the record says when the narrative fell back to the local summary.", { bodySize: 13, headSize: 20 });
}

/* ---------- 13 · Close ---------- */
{
  const s = pres.addSlide();
  base(s, "bg-1.png", 13, "Aviation cockpits have mandatory read-backs and a voice recorder. Operating rooms have neither. Surgr gives them both.");
  s.addText("Aviation cockpits have mandatory read-backs and a voice recorder. Operating rooms have neither.", { x: M, y: 2.0, w: 11.8, h: 2.6, fontFace: F.head, italic: true, fontSize: 46, color: C.text, isTextBox: true, margin: 0, valign: "top", fit: "shrink" });
  s.addText("Surgr gives them both.", { x: M, y: 4.75, w: 11.8, h: 0.7, fontFace: F.head, italic: true, fontSize: 30, color: C.accent, isTextBox: true, margin: 0 });
  s.addText("LIVE APP · SEE SUBMISSION LINK   ·   GITHUB.COM/MRNETWORK0001/SURGR   ·   BUILT ON ASSEMBLYAI", { x: M, y: 6.35, w: 11.8, h: 0.35, fontFace: F.mono, fontSize: 10, color: C.faint, charSpacing: 2, isTextBox: true, margin: 0 });
}

const out = path.join(here, "surgr-deck.pptx");
await pres.writeFile({ fileName: out });
console.log("wrote", out);
