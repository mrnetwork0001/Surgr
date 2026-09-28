// Prints each scene's start frame and duration (mirrors the timing in src/Surgr.tsx).
import fs from 'node:fs'
const FPS = 30, LEAD = 8, LIVE_LEAD = 10, LIVE_TAIL = 14
const vo = (i) => JSON.parse(fs.readFileSync(`src/vo/v${String(i).padStart(2, '0')}.json`, 'utf8'))
const end = (i) => vo(i).words.at(-1).e
const live = { liveA: [[5.0, 15.4], [17.3, 33.0], [36.5, 38.4]], liveB: [[37.1, 40.6], [45.6, 65.4]], liveC: [[62.9, 67.3], [76.9, 83.1]], liveD: [[83.2, 97.2], [103.0, 112.6]] }
const scenes = [['title', 0, 1.3], ['problem', 1, 1.0], ['stakes', 2, 0.8], ['solution', 3, 0.8], ['cockpit', 4, 0.4], ['liveA'], ['afterA', 5, 0.7], ['nobody', 6, 0.5], ['liveB'], ['ask', 7, 0.5], ['liveC'], ['checklist', 8, 0.5], ['liveD'], ['record', 9, 0.9], ['stack', 10, 0.9], ['business', 11, 0.9], ['close', 12, 3.2]]
let t = 0
const out = scenes.map(([id, v, tail]) => {
  const dur = live[id] ? LIVE_LEAD + live[id].reduce((n, [a, b]) => n + Math.round((b - a) * FPS), 0) + LIVE_TAIL : LEAD + Math.round((end(v) + tail) * FPS)
  const r = { id, start: t, dur }
  t += dur
  return r
})
if (process.argv[2] === '--json') console.log(JSON.stringify(out))
else { for (const s of out) console.log(`${s.id.padEnd(10)} ${String(s.start).padStart(5)}  ${(s.start / FPS).toFixed(1).padStart(6)}s  ${(s.dur / FPS).toFixed(1)}s`); console.log('total', t, (t / FPS).toFixed(1) + 's') }
