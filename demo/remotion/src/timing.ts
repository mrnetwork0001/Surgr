import v00 from './vo/v00.json'
import v01 from './vo/v01.json'
import v02 from './vo/v02.json'
import v03 from './vo/v03.json'
import v04 from './vo/v04.json'
import v05 from './vo/v05.json'
import v06 from './vo/v06.json'
import v07 from './vo/v07.json'
import v08 from './vo/v08.json'
import v09 from './vo/v09.json'
import v10 from './vo/v10.json'
import v11 from './vo/v11.json'
import v12 from './vo/v12.json'
import { BEAT_A, BEAT_B, BEAT_C, BEAT_D, type Beat } from './beats'

/** Scene order and lengths, shared by the film and scripts/timeline.ts. */
export const FPS = 30
export const LEAD = 8
export const FADE = 12
export const LIVE_LEAD = 10
export const LIVE_TAIL = 14
type Words = { text: string; words: { w: string; s: number; e: number }[] }
export const VO: Words[] = [v00, v01, v02, v03, v04, v05, v06, v07, v08, v09, v10, v11, v12]
const voEnd = (i: number) => VO[i].words[VO[i].words.length - 1].e
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
/** Frame within a narration scene at which the voice starts the nth word beginning with `word`. */
export const cueIn = (vo: number, word: string, n = 0) => {
  const hits = VO[vo].words.filter((w) => norm(w.w).startsWith(norm(word)))
  const w = hits[n]
  if (!w) throw new Error(`v${vo}: no word "${word}" #${n}`)
  return LEAD + Math.round(w.s * FPS)
}

export type SceneDef = { id: string; vo?: number; tail?: number; beat?: Beat }
export const SCENES: SceneDef[] = [
  { id: 'title', vo: 0, tail: 1.3 },
  { id: 'problem', vo: 1, tail: 1.0 },
  { id: 'stakes', vo: 2, tail: 0.8 },
  { id: 'solution', vo: 3, tail: 1.0 },
  { id: 'cockpit', vo: 4, tail: 0.4 },
  { id: 'liveA', beat: BEAT_A },
  { id: 'afterA', vo: 5, tail: 0.7 },
  { id: 'nobody', vo: 6, tail: 0.5 },
  { id: 'liveB', beat: BEAT_B },
  { id: 'ask', vo: 7, tail: 0.5 },
  { id: 'liveC', beat: BEAT_C },
  { id: 'checklist', vo: 8, tail: 0.5 },
  { id: 'liveD', beat: BEAT_D },
  { id: 'record', vo: 9, tail: 0.9 },
  { id: 'stack', vo: 10, tail: 0.9 },
  { id: 'business', vo: 11, tail: 0.9 },
  { id: 'close', vo: 12, tail: 3.2 },
]
export const segFrames = (s: [number, number]) => Math.round((s[1] - s[0]) * FPS)
export const beatDur = (b: Beat) => LIVE_LEAD + b.segs.reduce((n, s) => n + segFrames(s), 0) + LIVE_TAIL
export const DURS = SCENES.map((s) => (s.beat ? beatDur(s.beat) : LEAD + Math.round((voEnd(s.vo!) + (s.tail ?? 0.7)) * FPS)))
export const STARTS = DURS.reduce<number[]>((a, _, i) => [...a, i === 0 ? 0 : a[i - 1] + DURS[i - 1]], [])
export const SURGR_DURATION = DURS.reduce((n, d) => n + d, 0)
export const D = (id: string) => DURS[SCENES.findIndex((s) => s.id === id)]
