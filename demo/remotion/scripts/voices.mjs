// The operating-room take: the clinicians' lines in three ElevenLabs voices, laid out on one
// timeline with pauses sized for Surgr's spoken alerts. The result is fed to the browser as its
// microphone during capture, so everything the cockpit shows is live transcription.
//   node scripts/voices.mjs
// Writes public/voices/take.wav (48 kHz mono, the fake mic) and src/take.json (line timings).
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { tts } = require('./tts.cjs')

const VOICES = {
  surgeon: 'nPczCjzI2devNBz1zQrb', // Brian: deep, steady
  anesthesia: 'EXAVITQu4vr4xnSDxMaL', // Sarah: clear, younger
  nurse: 'pFZP5JQG7iQjIQuC4Bku', // Lily: British, distinct from both
}
// gap = seconds of silence BEFORE the line. `say` is what the voice reads; `text` is what the film shows.
const LINES = [
  { id: 'L1', role: 'surgeon', gap: 2.0, text: 'Push 100 micrograms of fentanyl.', say: 'Push one hundred micrograms of fentanyl.' },
  { id: 'L2', role: 'anesthesia', gap: 2.2, text: 'Pushing 10 micrograms fentanyl.', say: 'Pushing ten micrograms fentanyl.' },
  { id: 'L3', role: 'anesthesia', gap: 17.0, text: 'Correction. 100 micrograms fentanyl, confirmed.', say: 'Correction. One hundred micrograms fentanyl, confirmed.' },
  { id: 'L4', role: 'surgeon', gap: 5.0, text: 'Give 2 grams of cefazolin.', say: 'Give two grams of cefazolin.' },
  { id: 'L5', role: 'surgeon', gap: 24.0, text: 'Surgr, what is still open?', say: 'Surger, what is still open?' },
  { id: 'L6', role: 'anesthesia', gap: 12.0, text: 'Sorry. 2 grams cefazolin, confirmed.', say: 'Sorry. Two grams cefazolin, confirmed.' },
  { id: 'L7', role: 'nurse', gap: 5.0, text: 'Time out. Patient is John Doe, procedure is right knee arthroscopy, site is marked.', say: 'Time out. Patient is John Doe, procedure is right knee arthroscopy, site is marked.' },
  { id: 'L8', role: 'surgeon', gap: 3.0, text: 'Great. Knife please.', say: 'Great. Knife, please.' },
]
const TAIL = 18.0
const RATE = 48000

const tmp = path.resolve('clips/tmp/voices')
fs.mkdirSync(tmp, { recursive: true })
fs.mkdirSync('public/voices', { recursive: true })

const seconds = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

const out = []
let t = 0
const parts = []
for (const line of LINES) {
  const settings = { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true }
  const { audio, words } = await tts(line.say, VOICES[line.role], { settings })
  const mp3 = path.join(tmp, `${line.id}.mp3`)
  const wav = path.join(tmp, `${line.id}.wav`)
  fs.writeFileSync(mp3, audio)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', String(RATE), '-c:a', 'pcm_s16le', wav])
  const dur = seconds(wav)
  const gapWav = path.join(tmp, `${line.id}-gap.wav`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `anullsrc=r=${RATE}:cl=mono`, '-t', String(line.gap), '-c:a', 'pcm_s16le', gapWav])
  parts.push(gapWav, wav)
  t += line.gap
  out.push({ ...line, start: +t.toFixed(3), end: +(t + dur).toFixed(3), words: words.map((w) => ({ w: w.w, s: +(t + w.s).toFixed(3), e: +(t + w.e).toFixed(3) })) })
  console.log(`${line.id} ${line.role.padEnd(10)} ${t.toFixed(2)}s → ${(t + dur).toFixed(2)}s  ${line.text}`)
  t += dur
}
const tail = path.join(tmp, 'tail.wav')
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `anullsrc=r=${RATE}:cl=mono`, '-t', String(TAIL), '-c:a', 'pcm_s16le', tail])
parts.push(tail)
fs.writeFileSync(path.join(tmp, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'))
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-ac', '1', '-ar', String(RATE), '-c:a', 'pcm_s16le', 'public/voices/take.wav'])
const total = seconds('public/voices/take.wav')
fs.writeFileSync('src/take.json', JSON.stringify({ duration: total, lines: out }, null, 1) + '\n')
console.log(`take.wav ${total.toFixed(1)}s, ${out.length} lines`)
