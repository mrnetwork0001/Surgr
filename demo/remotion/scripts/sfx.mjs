// Sound for the film, all generated with ElevenLabs: effects from the sound-generation endpoint
// and one music bed from the music endpoint, written as one piece (same space, soft, under the voice).
//   node scripts/sfx.mjs            everything missing
//   ONLY=bed node scripts/sfx.mjs   one
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { key } = require('./env.cjs')

const SFX = {
  whoosh: { text: 'Soft airy cinematic whoosh for a scene transition, smooth and clean, gentle, no harsh high end', dur: 1.4 },
  tick: { text: 'A single very soft glassy UI tick, subtle, quiet, clean, short', dur: 0.5 },
  chime: { text: 'Gentle warm two-note confirmation chime, soft bell, calm medical device, clean tail', dur: 1.8 },
  rise: { text: 'Soft airy cinematic swell rising into a calm resolve, subtle, no drums', dur: 2.2 },
  hit: { text: 'Deep soft cinematic low boom, subtle and warm, short decay, no distortion', dur: 2.0 },
  monitor: { text: 'Hospital patient monitor heartbeat beep, steady clean beeps at 72 beats per minute, dry, no voices, no alarms', dur: 10 },
  room: { text: 'Quiet operating room ambience, soft air handling hum, distant equipment, very calm, no voices, no beeping', dur: 20 },
}
const BED = {
  prompt: 'Minimal cinematic ambient electronic score for a medical technology launch film. Warm analog synth pads, soft sparse piano notes, a subtle heartbeat-like low pulse at 72 bpm, calm, focused and hopeful, steady intensity throughout, no vocals, no drums fills, clean modern mix that sits under narration, ends with a gentle resolved chord.',
  ms: 240000,
}
fs.mkdirSync('public/sfx', { recursive: true })
const only = process.env.ONLY ? process.env.ONLY.split(',') : null
const want = (n) => (only ? only.includes(n) : !fs.existsSync(`public/sfx/${n}.mp3`))

async function retry(fn) {
  let last
  for (let i = 1; i <= 4; i++) { try { return await fn() } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2000 * i)) } }
  throw last
}

for (const [name, s] of Object.entries(SFX)) {
  if (!want(name)) continue
  try {
    const buf = await retry(async () => {
      const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192', {
        method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ text: s.text, duration_seconds: s.dur, prompt_influence: 0.5 }),
      })
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`)
      return Buffer.from(await res.arrayBuffer())
    })
    fs.writeFileSync(`public/sfx/${name}.mp3`, buf)
    console.log(`${name}: ${(buf.length / 1024).toFixed(0)}kb`)
  } catch (e) { console.error(`${name}: ${e.message}`) }
}

if (want('bed')) {
  try {
    const buf = await retry(async () => {
      const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
        method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: BED.prompt, music_length_ms: BED.ms }),
      })
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
      return Buffer.from(await res.arrayBuffer())
    })
    fs.writeFileSync('public/sfx/bed.mp3', buf)
    console.log(`bed: ${(buf.length / 1024).toFixed(0)}kb`)
  } catch (e) { console.error(`bed: ${e.message}`) }
}
