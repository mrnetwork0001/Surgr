import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { phaseLabel } from "./checklist";
import { ROLE_LABEL } from "./readback";
import { formatMs } from "./report";
import type { OperativeReport } from "./types";

/** Standard PDF fonts only cover WinAnsi; swap the few glyphs the report uses. */
function ansi(text: string): string {
  return text
    .replace(/→/g, "->")
    .replace(/[·•]/g, "-")
    .replace(/✓/g, "OK")
    .replace(/✕/g, "X")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/[µμ]/g, "u")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.07, 0.07, 0.08);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.85, 0.86, 0.88);
const OK = rgb(0.08, 0.5, 0.24);
const BAD = rgb(0.72, 0.11, 0.11);

class Writer {
  doc: PDFDocument;
  page!: PDFPage;
  y = 0;
  fonts!: { regular: PDFFont; bold: PDFFont; italic: PDFFont };
  constructor(doc: PDFDocument) {
    this.doc = doc;
  }
  async init() {
    this.fonts = {
      regular: await this.doc.embedFont(StandardFonts.Helvetica),
      bold: await this.doc.embedFont(StandardFonts.HelveticaBold),
      italic: await this.doc.embedFont(StandardFonts.HelveticaOblique),
    };
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }
  ensure(height: number) {
    if (this.y - height < MARGIN + 24) this.newPage();
  }
  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const para of ansi(text).split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = "";
      for (const w of words) {
        const trial = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(trial, size) <= width) line = trial;
        else {
          if (line) lines.push(line);
          line = w;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  text(text: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.font ?? this.fonts.regular;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? A4[0] - MARGIN - x;
    const lh = size * 1.35;
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(lh);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lh;
    }
    this.y -= opts.gap ?? 2;
  }
  heading(text: string) {
    this.y -= 10;
    this.ensure(30);
    this.page.drawText(ansi(text).toUpperCase(), { x: MARGIN, y: this.y - 9, size: 8.5, font: this.fonts.bold, color: MUTED });
    this.y -= 14;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness: 0.6, color: RULE });
    this.y -= 10;
  }
  bullet(text: string, color = INK) {
    this.text(`-  ${text}`, { x: MARGIN + 4, color });
  }
}

export async function buildReportPdf(r: OperativeReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(r.title);
  doc.setAuthor("Surgr");
  doc.setSubject("Operating room closed-loop communication record");
  const w = new Writer(doc);
  await w.init();

  w.text(r.title, { size: 20, font: w.fonts.bold, gap: 4 });
  w.text(
    `Generated ${new Date(r.generated_at).toLocaleString()} - narrative by ${r.generated_by === "local" ? "Surgr rules engine" : `${r.generated_by} via AssemblyAI LLM Gateway`} - every entry carries its audio timestamp`,
    { size: 9, color: MUTED, gap: 8 },
  );

  const q = r.communication_quality;
  const stats = [
    ["Session", formatMs(r.session.duration_ms)],
    ["Orders closed", `${q.confirmed_orders}/${q.total_orders}`],
    ["Closed-loop rate", `${Math.round(q.closed_loop_rate * 100)}%`],
    ["Mean read-back", q.mean_readback_latency_ms === null ? "-" : `${(q.mean_readback_latency_ms / 1000).toFixed(1)} s`],
    ["Safety events", String(r.safety_events.length)],
  ];
  const colW = (A4[0] - 2 * MARGIN) / stats.length;
  w.ensure(48);
  stats.forEach(([label, value], i) => {
    const x = MARGIN + i * colW;
    w.page.drawText(ansi(value), { x, y: w.y - 18, size: 18, font: w.fonts.bold, color: INK });
    w.page.drawText(label.toUpperCase(), { x, y: w.y - 32, size: 7.5, font: w.fonts.regular, color: MUTED });
  });
  w.y -= 46;

  w.heading("Procedure summary");
  w.text(r.procedure_summary);

  w.heading("Medications (closed-loop record)");
  if (r.medications.length === 0) w.text("No verbal medication orders captured.", { color: MUTED });
  for (const m of r.medications) {
    w.ensure(40);
    const ok = m.readback_status === "confirmed";
    w.text(`${m.drug.charAt(0).toUpperCase() + m.drug.slice(1)} - ${m.dose}${m.route !== "not stated" ? ` ${m.route}` : ""}`, { font: w.fonts.bold, size: 11, gap: 0 });
    w.text(
      `Ordered by ${ROLE_LABEL[m.ordered_by]} at ${formatMs(m.ordered_at_ms)} - ${m.readback_by ? `read back by ${ROLE_LABEL[m.readback_by]} at ${formatMs(m.readback_at_ms)}` : "no read-back"} - ${m.readback_status.toUpperCase()}`,
      { size: 9, color: ok ? OK : m.readback_status === "pending" ? MUTED : BAD, gap: 0 },
    );
    if (m.readback_text) w.text(`Read-back: "${m.readback_text.trim()}"`, { size: 9, font: w.fonts.italic, color: MUTED, gap: 0 });
    if (m.note) w.text(m.note, { size: 9, color: MUTED, gap: 6 });
    else w.y -= 6;
  }

  w.heading("WHO Surgical Safety Checklist");
  for (const c of r.checklist) {
    w.ensure(30);
    w.text(`${phaseLabel(c.phase)} - ${c.status.replace("_", " ")}`, { font: w.fonts.bold, size: 10.5, gap: 1 });
    for (const i of c.completed) w.bullet(`OK  ${i.label} (${formatMs(i.at_ms)})`, OK);
    for (const i of c.missed) w.bullet(`${c.status === "not_started" ? "--" : "X "}  ${i.label}`, c.status === "not_started" ? MUTED : BAD);
    w.y -= 4;
  }

  w.heading("Safety events");
  if (r.safety_events.length === 0) w.text("No safety events.", { color: MUTED });
  for (const e of r.safety_events) {
    w.text(`${formatMs(e.at_ms)}  ${e.type.replace("_", " ").toUpperCase()} (${e.severity})`, { font: w.fonts.bold, size: 9.5, color: e.severity === "critical" ? BAD : INK, gap: 0 });
    w.text(e.description, { size: 9, gap: 0 });
    w.text(e.resolution, { size: 9, font: w.fonts.italic, color: MUTED, gap: 6 });
  }

  w.heading("Communication quality");
  w.text(q.notes);

  w.heading("Recommendations");
  for (const rec of r.recommendations) w.bullet(rec);

  w.y -= 16;
  w.ensure(30);
  w.text("Surgr is a hackathon prototype built on AssemblyAI. It is not a medical device and does not replace clinical judgement or institutional safety protocols.", { size: 7.5, color: MUTED });

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Surgr operative communication record - page ${i + 1} of ${pages.length}`, { x: MARGIN, y: 24, size: 7.5, font: w.fonts.regular, color: MUTED });
  });
  return doc.save();
}

export function reportFileName(r: OperativeReport): string {
  return `surgr-report-${r.generated_at.replace(/[:.]/g, "-").slice(0, 19)}.pdf`;
}
