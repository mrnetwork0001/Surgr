// ElevenLabs text-to-speech with character timestamps, folded into words.
const { key } = require('./env.cjs')
async function tts(text, voice, opts = {}) {
  let last
  for (let attempt = 1; attempt <= 5; attempt++) {
    try { return await once(text, voice, opts) } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * attempt)) }
  }
  throw last
}
async function once(text, voice, { model = 'eleven_multilingual_v2', settings } = {}) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_192`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: model, voice_settings: settings ?? { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true } }),
  })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  const body = await res.json()
  const a = body.alignment
  const words = []
  let cur = null
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) { words.push(cur); cur = null } return }
    if (!cur) cur = { w: '', s: a.character_start_times_seconds[i], e: 0 }
    cur.w += ch
    cur.e = a.character_end_times_seconds[i]
  })
  if (cur) words.push(cur)
  return { audio: Buffer.from(body.audio_base64, 'base64'), words }
}
module.exports = { tts }
