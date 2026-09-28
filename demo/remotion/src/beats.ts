import clipsJson from './clips.json'
import takeJson from './take.json'
import type { Focus, Rect } from './ui'

/**
 * Everything about the live take the film needs, derived from what the capture recorded:
 * where to cut, when the clinicians and Surgr are audible, what to caption, where to aim the
 * camera. Re-filming the take re-times the film with no hand edits.
 */
type Turn = { final: boolean; text: string; rect: Rect }
type Snap = {
  t: number; turns: Turn[]; orders: { rect: Rect }[]; alerts: { rect: Rect }[]; ask: { rect: Rect } | null
  phases: { name: string; rect: Rect }[]; panels: Record<string, Rect | null>
}
type Clip = { duration: number; micOffset: number | null; agent: { start: number; end: number; text: string }[]; snaps: Snap[]; marks: { name: string; t: number }[] }
const clipsAll = clipsJson as unknown as Record<string, Clip>
export const LIVE = clipsAll.live
export const REPORT = clipsAll.report
const take = takeJson as { lines: { id: string; role: 'surgeon' | 'anesthesia' | 'nurse'; text: string; start: number; end: number }[] }
export const MIC = LIVE.micOffset ?? 0

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
export const line = (id: string) => {
  const l = take.lines.find((x) => x.id === id)
  if (!l) throw new Error(`no take line ${id}`)
  return { ...l, s: l.start + MIC, e: l.end + MIC }
}
export const finalAt = (prefix: string) => {
  for (const s of LIVE.snaps) if (s.turns.some((t) => t.final && norm(t.text).startsWith(norm(prefix)))) return s.t
  throw new Error(`no final turn "${prefix}"`)
}
export const agent = (re: RegExp, after = 0) => {
  const g = LIVE.agent.find((a) => a.start >= after && re.test(a.text))
  if (!g) throw new Error(`no agent line ${re}`)
  return g
}
export const markAt = (clip: Clip, name: string) => clip.marks.find((m) => m.name === name)?.t
export const snapAt = (clip: Clip, t: number) => {
  let best = clip.snaps[0]
  for (const s of clip.snaps) if (s.t <= t) best = s
  return best
}
const union = (rs: (Rect | null | undefined)[]): Rect => {
  const v = rs.filter(Boolean) as Rect[]
  const x0 = Math.min(...v.map((r) => r[0]))
  const y0 = Math.min(...v.map((r) => r[1]))
  const x1 = Math.max(...v.map((r) => r[0] + r[2]))
  const y1 = Math.max(...v.map((r) => r[1] + r[3]))
  return [x0, y0, x1 - x0, y1 - y0]
}
const lastFinal = (s: Snap) => [...s.turns].reverse().find((t) => t.final)?.rect

/* Camera views that end exactly in the gaps between the cockpit's panels, so nothing is cut mid-word. */
const LEFT2 = { x: 8, w: 1109 } // transcript + orders
const RIGHT = { x: 644, w: 956 } // orders + checklist + the Ask card
/* The cockpit header row (0-63) is left out of zoomed views: its right-hand controls would be cut
   at the view's edge. Views also sit a little high, so the frame's title bar never hides a heading. */
const HEADER = 63
const TITLE_BAR = 30
const view = (v: { x: number; w: number }, cy: number): Rect => {
  const h = (v.w * 900) / 1600
  const y = Math.max(HEADER, Math.min(900 - h, cy - h / 2 - TITLE_BAR))
  return [v.x, y, v.w, h]
}
const centerY = (r: Rect) => r[1] + r[3] / 2
export const FULL: Rect = [0, 0, 1600, 900]

export type Range = [number, number]
export type Beat = { eyebrow: string; segs: Range[]; mic: Range[]; agent: Range[]; focus: Focus[] }

/** Joins windows whose gap is too short to be worth a cut. */
const merge = (segs: Range[], minGap = 1.4): Range[] => {
  const out: Range[] = []
  for (const s of [...segs].sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1]
    if (last && s[0] - last[1] < minGap) last[1] = Math.max(last[1], s[1])
    else out.push([s[0], s[1]])
  }
  return out
}

const L1 = line('L1'), L2 = line('L2'), L3 = line('L3'), L4 = line('L4'), L5 = line('L5'), L7 = line('L7'), L8 = line('L8')
const T2 = finalAt('Pushing')
const T3 = finalAt('Correction')
const T4 = finalAt('Give 2')
const T5 = finalAt('Surgr')
const T6 = finalAt('Sorry')
const T7 = finalAt('Time out')
const T8 = finalAt('Great')
const A1 = agent(/^Safety alert\. Read-back dose/i)
const A2 = agent(/No read-back/i)
const A3 = agent(/^(?!\s*(safety|checklist)\b)/i, L5.s)
const A4 = agent(/^Checklist alert/i)
const DISMISS = markAt(LIVE, 'dismiss')

export const BEAT_A: Beat = {
  eyebrow: '01 · Dose mismatch',
  segs: merge([[L1.s - 1.0, Math.max(T2 + 1.2, L2.e + 0.6)], [A1.start - 0.7, L3.e + 0.8], [T3 - 0.7, T3 + 1.8]]),
  mic: [[L1.s - 0.3, L3.e + 0.3]],
  agent: [[A1.start - 0.1, A1.end + 0.1]],
  focus: [
    { rect: view(LEFT2, 63 + 312), from: L1.s - 0.4, to: T3 - 0.6, maxZoom: 3 },
    { rect: view(LEFT2, centerY(union([lastFinal(snapAt(LIVE, T3 + 0.3)), snapAt(LIVE, T3 + 0.3).orders[0]?.rect]))), from: T3 - 0.4, to: 999, maxZoom: 3 },
  ],
}
export const BEAT_B: Beat = {
  eyebrow: '02 · No read-back',
  segs: merge([[L4.s - 0.8, L4.e + 0.8], [T4 - 0.8, A2.end + 0.6]]),
  mic: [[L4.s - 0.3, L4.e + 0.3]],
  agent: [[A2.start - 0.1, A2.end + 0.1]],
  focus: [
    { rect: view(LEFT2, centerY(union([lastFinal(snapAt(LIVE, T4 + 0.3)), snapAt(LIVE, T4 + 0.3).orders[0]?.rect]))), from: L4.s - 0.6, to: A2.start - 0.9, maxZoom: 3 },
    { rect: view(LEFT2, centerY(union([snapAt(LIVE, A2.start).panels.alerts, snapAt(LIVE, A2.start).orders[0]?.rect]))), from: A2.start - 0.7, to: 999, maxZoom: 3 },
  ],
}
const askRect = snapAt(LIVE, A3.end).ask?.rect ?? [1204, 754, 380, 130]
export const BEAT_C: Beat = {
  eyebrow: '03 · Ask Surgr',
  segs: merge([[L5.s - 0.6, L5.e + 1.0], [A3.start - 0.8, Math.min(A3.end + 1.6, (DISMISS ?? 999) - 0.8)]]),
  mic: [[L5.s - 0.3, L5.e + 0.3]],
  agent: [[A3.start - 0.1, A3.end + 0.1]],
  focus: [
    { rect: view(LEFT2, centerY(lastFinal(snapAt(LIVE, T5 + 0.3)) ?? [0, 600, 10, 60])), from: L5.s - 0.6, to: A3.start - 1.0, maxZoom: 3 },
    // A tight frame on the card: it sits in the page's bottom-right corner, below every panel heading.
    { rect: [Math.max(0, askRect[0] + askRect[2] / 2 - 300), Math.min(900 - 338 - 22, askRect[1] + askRect[3] / 2 - 150), 600, 338], from: A3.start - 0.8, to: 999, maxZoom: 3 },
  ],
}
const timeOut = snapAt(LIVE, T7 + 0.4).phases.find((p) => /time out/i.test(p.name))?.rect ?? [1137, 432, 433, 284]
export const BEAT_D: Beat = {
  eyebrow: '04 · WHO checklist',
  segs: merge([[Math.min(T6 - 0.5, L7.s - 0.8), T8 + 1.4], [A4.start - 0.7, A4.end + 0.8]]),
  mic: [[L7.s - 0.3, L8.e + 0.3]],
  agent: [[A4.start - 0.1, A4.end + 0.1]],
  focus: [
    { rect: view(RIGHT, centerY(timeOut)), from: L7.s - 0.8, to: T8 + 0.4, maxZoom: 3 },
    { rect: FULL, from: T8 + 0.6, to: 999, maxZoom: 1 },
  ],
}

export type Caption = { from: number; to: number; role: 'surgeon' | 'anesthesia' | 'nurse' | 'surgr'; text: string }
/** Captions for one beat, in take time: the clinicians' own words, and what Surgr said. */
export const captions = (b: Beat): Caption[] => {
  const within = (t: number, rs: Range[]) => rs.some(([a, z]) => t >= a && t <= z)
  const out: Caption[] = []
  for (const l of take.lines) {
    const s = l.start + MIC
    if (within(s, b.mic)) out.push({ from: s, to: l.end + MIC + 0.6, role: l.role, text: l.text })
  }
  for (const g of LIVE.agent) if (within(g.start, b.agent)) out.push({ from: g.start, to: g.end + 0.6, role: 'surgr', text: g.text })
  return out
}

/* Stills for the narration scenes that sit on the live take. */
export const STILL_AFTER_A = { at: T3 + 1.2, rect: view(LEFT2, centerY(union([lastFinal(snapAt(LIVE, T3 + 1.2)), snapAt(LIVE, T3 + 1.2).orders[0]?.rect]))) }
export const STILL_ASK = { at: A2.end + 0.3, rect: view(LEFT2, centerY(union([snapAt(LIVE, A2.end).panels.alerts, snapAt(LIVE, A2.end).orders[0]?.rect]))) }
export const STILL_CHECKLIST = { at: Math.max(DISMISS ?? 0, T6) + 0.8, rect: view(RIGHT, centerY(timeOut)) }
export const COCKPIT_CLICK = markAt(LIVE, 'start') ?? 2.4

/* The report beat: when the record appears, when the PDF is saved. */
const modalAt = REPORT.snaps.find((s) => s.panels.modal)?.t ?? 7.5
const toastAt = REPORT.snaps.find((s) => (s.panels.deliver?.[3] ?? 0) > 70)?.t ?? modalAt + 13
const deliverAt = snapAt(REPORT, toastAt + 0.2).panels.deliver ?? [305, 131, 990, 107]
export const REPORT_BEAT = {
  start: Math.max(0, modalAt - 0.3),
  toastAt,
  top: [280, 0, 1040, 585] as Rect,
  deliver: [280, Math.max(0, Math.min(900 - 585, centerY(deliverAt) - 292 - TITLE_BAR)), 1040, 585] as Rect,
}
