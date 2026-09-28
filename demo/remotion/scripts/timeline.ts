// Prints each scene's start and length, from the same module the film uses.
import { DURS, FPS, SCENES, STARTS, SURGR_DURATION } from '../src/timing'
import { BEAT_A, BEAT_B, BEAT_C, BEAT_D } from '../src/beats'
if (process.argv[2] === '--json') console.log(JSON.stringify(SCENES.map((s, i) => ({ id: s.id, start: STARTS[i], dur: DURS[i] }))))
else {
  SCENES.forEach((s, i) => console.log(`${s.id.padEnd(10)} ${String(STARTS[i]).padStart(5)}  ${(STARTS[i] / FPS).toFixed(1).padStart(6)}s  ${(DURS[i] / FPS).toFixed(1)}s`))
  console.log('total', SURGR_DURATION, (SURGR_DURATION / FPS).toFixed(1) + 's')
  for (const [n, b] of Object.entries({ BEAT_A, BEAT_B, BEAT_C, BEAT_D })) console.log(n, 'segs', b.segs.map(([a, z]) => `${a.toFixed(1)}-${z.toFixed(1)}`).join(' '), 'mic', b.mic.map(([a, z]) => `${a.toFixed(1)}-${z.toFixed(1)}`).join(' '), 'agent', b.agent.map(([a, z]) => `${a.toFixed(1)}-${z.toFixed(1)}`).join(' '))
}
