/**
 * Films the real Surgr cockpit. The browser's microphone is public/voices/take.wav (the
 * clinicians' lines), so the transcript, orders, alerts and Ask Surgr answers are all live:
 * AssemblyAI Streaming hears the take, the app reacts, the Voice Agent speaks.
 *
 *   node scripts/capture.mjs            # live + report (+ landing)
 *   BEAT=landing node scripts/capture.mjs
 *
 * Per clip it writes public/clips/<beat>.mp4 (3200x1800 from a 1600x900 viewport),
 * public/agent/<beat>.wav (Surgr's own voice, rebuilt from the Voice Agent websocket, aligned to
 * the clip), public/agent/<beat>-mic.wav (the take, aligned), and src/clips.json with a timeline
 * of every cockpit event and the rectangle of each element, in CSS pixels of the 1600x900 page.
 */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/clips')
const AGENT = path.join(ROOT, 'public/agent')
const TMP = path.join(ROOT, 'clips/tmp')
const BASE = process.env.APP_URL || 'http://localhost:3002'
const TAKE = path.join(ROOT, 'public/voices/take.wav')
const take = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/take.json'), 'utf8'))
const SIZE = { width: 1600, height: 900 }
const DPR = 2
const FPS = 30
for (const d of [OUT, AGENT, TMP]) fs.mkdirSync(d, { recursive: true })

const pointerScript = `(() => {
  const el = document.createElement('div'); el.id = '__cursor'
  el.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M2 2 L2 24 L8 18.5 L12.5 28 L16.5 26.2 L12 17 L20 17 Z" fill="white" stroke="#0b0b0d" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  Object.assign(el.style, { position: 'fixed', left: '0', top: '0', width: '26px', height: '30px', zIndex: 2147483647, pointerEvents: 'none',
    transform: 'translate(-2px,-2px) scale(1)', transformOrigin: '2px 2px', transition: 'transform .12s ease-out', opacity: '0', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.55))' })
  const ring = document.createElement('div')
  Object.assign(ring.style, { position: 'fixed', left: '0', top: '0', width: '34px', height: '34px', marginLeft: '-17px', marginTop: '-17px', borderRadius: '50%', border: '2px solid rgba(45,212,191,.9)', zIndex: 2147483646, pointerEvents: 'none', opacity: '0', transform: 'scale(.4)', transition: 'transform .35s ease-out, opacity .35s ease-out' })
  const add = () => { if (document.body && !document.getElementById('__cursor')) { document.body.appendChild(ring); document.body.appendChild(el) } }
  document.addEventListener('DOMContentLoaded', add); add()
  window.__moveCursor = (x, y) => { el.style.opacity = '1'; el.style.left = x + 'px'; el.style.top = y + 'px'; ring.style.left = x + 'px'; ring.style.top = y + 'px' }
  window.__clickCursor = () => {
    el.style.transform = 'translate(-2px,-2px) scale(0.86)'; setTimeout(() => { el.style.transform = 'translate(-2px,-2px) scale(1)' }, 140)
    ring.style.transition = 'none'; ring.style.opacity = '1'; ring.style.transform = 'scale(.4)'
    requestAnimationFrame(() => { ring.style.transition = 'transform .35s ease-out, opacity .35s ease-out'; ring.style.opacity = '0'; ring.style.transform = 'scale(1.3)' })
  }
  window.__hideCursor = () => { el.style.opacity = '0' }
})();`

/** Marks the moment the microphone opens: the fake capture file starts playing then. */
const micScript = `(() => {
  const md = navigator.mediaDevices; if (!md || !md.getUserMedia) return
  const orig = md.getUserMedia.bind(md)
  md.getUserMedia = async (c) => { const s = await orig(c); window.__gumAt = Date.now() / 1000; return s }
})();`

/** A compact snapshot of the cockpit every 200 ms, kept only when something changed. */
const watchScript = `(() => {
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }
  const txt = (el) => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : '')
  window.__snaps = []; let last = ''
  const snap = () => {
    const s = {
      turns: [...document.querySelectorAll('.turn')].map((t) => ({ id: t.id, final: !t.className.includes('turn-partial'), role: txt(t.querySelector('.turn-role')), label: txt(t.querySelector('.turn-label')), text: txt(t.querySelector('.turn-text')), rect: rect(t) })),
      orders: [...document.querySelectorAll('.order')].map((o) => ({ drug: txt(o.querySelector('.order-drug')), status: txt(o.querySelector('.status')), rect: rect(o) })),
      alerts: [...document.querySelectorAll('.alert')].map((a) => ({ title: txt(a.querySelector('.alert-title')).replace(/\\d\\d:\\d\\d.*/, '').trim(), rect: rect(a) })),
      ask: document.querySelector('.ask-card') ? { state: txt(document.querySelector('.ask-state')), q: txt(document.querySelector('.ask-q')), a: txt(document.querySelector('.ask-a')), rect: rect(document.querySelector('.ask-card')) } : null,
      phases: [...document.querySelectorAll('.phase')].map((p) => ({ name: txt(p.querySelector('.phase-name')), status: txt(p.querySelector('.phase-status')), rect: rect(p) })),
      checklist: txt(document.querySelector('#panel-checklist .stat')),
      speakers: [...document.querySelectorAll('.speaker-chip')].map((c) => ({ label: txt(c.querySelector('.speaker-label')), role: c.querySelector('select')?.value })),
      voice: txt([...document.querySelectorAll('.pill')].find((p) => /Voice agent/i.test(p.textContent))?.querySelector('.pill-value')),
      stt: txt([...document.querySelectorAll('.pill')].find((p) => /Streaming/i.test(p.textContent))?.querySelector('.pill-value')),
      panels: { transcript: rect(document.getElementById('panel-transcript')), orders: rect(document.getElementById('panel-orders')), checklist: rect(document.getElementById('panel-checklist')), alerts: rect(document.querySelector('.alerts')), header: rect(document.querySelector('.header')), modal: rect(document.querySelector('.modal')), deliver: rect(document.querySelector('.deliver')) },
    }
    const key = JSON.stringify(s)
    if (key !== last) { last = key; window.__snaps.push({ t: Date.now() / 1000, ...s }) }
  }
  setInterval(snap, 200)
})();`

async function newSession(browser) {
  const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: DPR, locale: 'en-US', permissions: ['microphone'] })
  await ctx.addInitScript(pointerScript)
  await ctx.addInitScript(micScript)
  await ctx.addInitScript(watchScript)
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') console.log('   page error:', m.text().slice(0, 140)) })
  // Surgr's voice: every Voice Agent message, timestamped on arrival.
  const agent = []
  page.on('websocket', (ws) => {
    if (!ws.url().includes('agents.assemblyai.com')) return
    ws.on('framereceived', ({ payload }) => { if (typeof payload === 'string') agent.push({ t: Date.now() / 1000, payload }) })
  })
  return { ctx, page, agent }
}

/** Screencast frames go straight to disk as they arrive; only their timestamps stay in memory. */
async function record(page, beat) {
  const client = await page.context().newCDPSession(page)
  const raw = path.join(TMP, `${beat}-raw`)
  fs.rmSync(raw, { recursive: true, force: true }); fs.mkdirSync(raw, { recursive: true })
  const frames = []
  let stopped = false
  client.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
    if (stopped) return
    const file = path.join(raw, `r${String(frames.length).padStart(6, '0')}.jpg`)
    try { fs.writeFileSync(file, Buffer.from(data, 'base64')) } catch { return }
    frames.push({ file, t: metadata.timestamp })
    await client.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 })
  return { async stop() { stopped = true; await client.send('Page.stopScreencast').catch(() => {}); if (frames.length) frames.push({ file: frames.at(-1).file, t: Date.now() / 1000 }); return frames } }
}

function encode(beat, frames) {
  if (!frames.length) throw new Error(`${beat}: no frames`)
  const dir = path.join(TMP, beat)
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  const t0 = frames[0].t
  const total = Math.round((frames.at(-1).t - t0) * FPS)
  let c = 0
  for (let i = 0; i < total; i++) {
    const want = t0 + i / FPS
    while (c + 1 < frames.length && frames[c + 1].t <= want) c++
    fs.linkSync(frames[c].file, path.join(dir, `f${String(i).padStart(5, '0')}.jpg`))
  }
  const target = path.join(OUT, `${beat}.mp4`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'), '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-vf', `scale=${SIZE.width * DPR}:${SIZE.height * DPR}:flags=lanczos`, target])
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', target]).toString().trim()
  const delivered = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', frames[0].file]).toString().trim()
  fs.rmSync(dir, { recursive: true, force: true })
  fs.rmSync(path.dirname(frames[0].file), { recursive: true, force: true })
  console.log(`   -> ${beat}.mp4 ${Number(probe).toFixed(2)}s, ${total} frames from ${frames.length} captured, delivered at ${delivered}`)
  return { t0, duration: Number(probe), frames: frames.length }
}

/** Rebuild what the app actually played through the Voice Agent: every reply except the silent ones. */
function agentTrack(beat, msgs, t0, duration) {
  const RATE = 24000
  // Mirror the app: a reply is whatever audio arrives until reply.done, whether or not a
  // reply.started came first, and it is only heard if its words are not the silence token.
  const replies = []
  let cur = null
  const open = (t) => (cur ??= { at: null, chunks: [], text: '', started: t })
  for (const m of msgs) {
    let j; try { j = JSON.parse(m.payload) } catch { continue }
    if (j.type === 'reply.started') { if (cur && cur.chunks.length) replies.push(cur); cur = null; open(m.t) }
    else if (j.type === 'reply.audio') { const r = open(m.t); if (r.at === null) r.at = m.t; r.chunks.push(Buffer.from(j.data, 'base64')) }
    else if (j.type === 'transcript.agent.delta' && typeof j.delta === 'string') open(m.t).text += j.delta
    else if (j.type === 'transcript.agent' && typeof j.text === 'string') open(m.t).text = j.text
    else if (j.type === 'reply.done' && cur) { replies.push(cur); cur = null }
  }
  if (cur) replies.push(cur) // still speaking when the clip ended
  fs.writeFileSync(path.join(TMP, `${beat}-agent.jsonl`), msgs.map((m) => JSON.stringify(m)).join('\n'))
  const kept = replies.filter((r) => r.at !== null && r.text.trim() && !/^\s*[\[("']?\s*silent\b/i.test(r.text))
  // A readable log of the agent's side of the session, without the audio payloads.
  const log = msgs.map((m) => { try { const j = JSON.parse(m.payload); if (j.type === 'reply.audio' || j.type === 'transcript.agent.delta' || j.type === 'transcript.user.delta') return null; return { t: +(m.t - t0).toFixed(2), type: j.type, text: j.text, status: j.status, name: j.name, code: j.code, message: j.message } } catch { return null } }).filter(Boolean)
  fs.writeFileSync(path.join(TMP, `${beat}-agent-log.json`), JSON.stringify(log, null, 1))
  const pcm = Buffer.alloc(Math.ceil(duration * RATE) * 2)
  const lines = []
  for (const r of kept) {
    const audio = Buffer.concat(r.chunks)
    const start = Math.max(0, r.at - t0 + 0.04)
    const off = Math.floor(start * RATE) * 2
    audio.copy(pcm, off, 0, Math.max(0, Math.min(audio.length, pcm.length - off)))
    lines.push({ start: +start.toFixed(3), end: +(start + audio.length / 2 / RATE).toFixed(3), text: r.text })
  }
  const raw = path.join(TMP, `${beat}-agent.raw`)
  fs.writeFileSync(raw, pcm)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', raw, '-ar', '48000', '-ac', '1', path.join(AGENT, `${beat}.wav`)])
  fs.rmSync(raw)
  console.log(`   -> agent/${beat}.wav: ${kept.length} spoken of ${replies.length} replies (${replies.length - kept.length} silent)`)
  for (const l of lines) console.log(`      ${l.start.toFixed(1)}s-${l.end.toFixed(1)}s  ${l.text.slice(0, 90)}`)
  return lines
}

function micTrack(beat, offset, duration) {
  const target = path.join(AGENT, `${beat}-mic.wav`)
  const ms = Math.max(0, Math.round(offset * 1000))
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', TAKE, '-af', `adelay=${ms}|${ms},apad`, '-t', String(duration), '-ar', '48000', '-ac', '1', target])
  console.log(`   -> agent/${beat}-mic.wav, take starts at ${offset.toFixed(2)}s`)
}

const wait = (page, ms) => page.waitForTimeout(ms)
async function softClick(page, locator, settle = 700) {
  const box = await locator.boundingBox()
  if (box) {
    const x = box.x + Math.min(box.width / 2, 18), y = box.y + box.height * 0.62
    await page.evaluate(([x, y]) => window.__moveCursor?.(x, y), [x, y])
    await page.mouse.move(x, y, { steps: 20 })
    await wait(page, 380)
    await page.evaluate(() => window.__clickCursor?.())
  }
  await locator.click({ timeout: 15000 })
  await wait(page, settle)
}
async function smoothScrollEl(page, sel, to, ms = 1600) {
  await page.evaluate(([sel, to, ms]) => new Promise((done) => {
    const el = document.querySelector(sel); if (!el) return done()
    const from = el.scrollTop, start = performance.now()
    const step = (now) => { const p = Math.min(1, (now - start) / ms); const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; el.scrollTop = from + (to - from) * e; p < 1 ? requestAnimationFrame(step) : done() }
    requestAnimationFrame(step)
  }), [sel, to, ms])
}

const manifestPath = path.join(ROOT, 'src/clips.json')
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {}
const only = process.env.BEAT ? process.env.BEAT.split(',') : ['live', 'landing']

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${TAKE}%noloop`, '--autoplay-policy=no-user-gesture-required', `--force-device-scale-factor=${DPR}`, '--hide-scrollbars'],
})

async function finishClip(beat, page, rec, agent, extra = {}) {
  const frames = await rec.stop()
  const snaps = await page.evaluate(() => window.__snaps || [])
  const gumAt = await page.evaluate(() => window.__gumAt ?? null)
  const enc = encode(beat, frames)
  const lines = agentTrack(beat, agent, enc.t0, enc.duration)
  const micOffset = gumAt ? gumAt - enc.t0 : null
  if (micOffset !== null && beat === 'live') micTrack(beat, micOffset, enc.duration)
  const { marks = [], ...rest } = extra
  manifest[beat] = {
    duration: enc.duration, width: SIZE.width * DPR, height: SIZE.height * DPR, micOffset,
    marks: marks.map((m) => ({ name: m.name, t: +(m.t - enc.t0).toFixed(3) })),
    agent: lines,
    snaps: snaps.filter((s) => s.t >= enc.t0).map((s) => ({ ...s, t: +(s.t - enc.t0).toFixed(3) })),
    ...rest,
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest) + '\n')
}

if (only.includes('live')) {
  console.log('live: cockpit with the take as the microphone, then the report')
  const { page, agent } = await newSession(browser)
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
  await page.locator('.header .brand-logo').waitFor({ timeout: 60000 })
  await wait(page, 2500)
  // More room for the panels: fold the simulator away (it is not used in this take).
  await page.getByRole('button', { name: /OR audio simulator/ }).click()
  await wait(page, 600)
  let rec = await record(page, 'live')
  const marks = []
  const mark = async (name) => marks.push({ name, t: Date.now() / 1000 })
  await wait(page, 1200)
  await softClick(page, page.getByRole('button', { name: 'Start live session' }), 400)
  await mark('start')
  // The take only exists once the microphone is open; if the session could not start, stop here.
  let micOpen = false
  for (let i = 0; i < 60 && !micOpen; i++) { await wait(page, 250); micOpen = Boolean(await page.evaluate(() => window.__gumAt ?? null)) }
  if (!micOpen) {
    const stt = await page.evaluate(() => [...document.querySelectorAll('.pill')].find((p) => /Streaming/i.test(p.textContent))?.getAttribute('title') ?? '')
    await browser.close()
    throw new Error(`the microphone never opened (${stt || 'no status'}); re-run when the network is steady`)
  }
  await page.evaluate(() => window.__hideCursor?.())
  // The take runs on its own. Meanwhile, once Surgr has answered the question, the surgeon
  // dismisses the answer card by hand so it never covers the checklist.
  // The take starts when the microphone opens, which depends on the network; allow for that and
  // for the last alert to finish speaking.
  const gum = async () => page.evaluate(() => window.__gumAt ?? null)
  let until = Date.now() + 20000
  let dismissed = false
  let armed = false
  while (Date.now() < until) {
    if (!armed) { const g = await gum(); if (g) { until = Math.round(g * 1000 + (take.duration + 4) * 1000); armed = true } }
    await wait(page, 300)
    if (dismissed) continue
    const answered = await page.evaluate(() => {
      const card = document.querySelector('.ask-card')
      const a = card?.querySelector('.ask-a')?.textContent?.trim() ?? ''
      const state = card?.querySelector('.ask-state')?.textContent?.trim() ?? ''
      return a.length > 10 && /answered/i.test(state)
    })
    if (answered) {
      await wait(page, 1300)
      const close = page.locator('.ask-card button[aria-label="Dismiss"]')
      if (await close.count()) {
        await softClick(page, close, 300)
        await mark('dismiss')
        // The team clears the earlier alerts before the Time Out, which gives the checklist its room.
        const ack = page.getByRole('button', { name: /Acknowledge all/ })
        if (await ack.count()) { await softClick(page, ack, 300); await mark('ack'); console.log('   alerts acknowledged') }
        await page.evaluate(() => window.__hideCursor?.())
        dismissed = true
        console.log('   answer card dismissed')
      }
    }
  }
  // Let the final alert finish before stopping.
  for (let i = 0; i < 40; i++) {
    const v = await page.evaluate(() => [...document.querySelectorAll('.pill')].find((p) => /Voice agent/i.test(p.textContent))?.querySelector('.pill-value')?.textContent ?? '')
    if (!/Speaking/i.test(v) && i > 3) break
    await wait(page, 500)
  }
  await wait(page, 1200)
  await mark('takeEnd')
  await finishClip('live', page, rec, agent, { marks })

  console.log('report: export, scroll, download, spoken debrief')
  agent.length = 0
  await page.evaluate(() => { window.__snaps = [] })
  rec = await record(page, 'report')
  await wait(page, 800)
  await softClick(page, page.getByRole('button', { name: /Export EHR report/ }), 300)
  await page.evaluate(() => window.__hideCursor?.())
  await page.getByText('Surgr Operative Communication Record').waitFor({ timeout: 60000 })
  await wait(page, 2600)
  await smoothScrollEl(page, '.modal', 560, 2200)
  await wait(page, 1600)
  await smoothScrollEl(page, '.modal', 1150, 2200)
  await wait(page, 1600)
  await smoothScrollEl(page, '.modal', 0, 1800)
  await wait(page, 900)
  await page.evaluate(() => window.__hideCursor?.())
  const dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
  await softClick(page, page.getByRole('button', { name: 'Download PDF' }), 250)
  // Step aside so the click marker never sits on the button's label, then disappear.
  await page.mouse.move(1260, 330, { steps: 12 })
  await page.evaluate(() => { window.__moveCursor?.(1260, 330) })
  await wait(page, 350)
  await page.evaluate(() => window.__hideCursor?.())
  const got = await dl
  if (got) { await got.saveAs(path.join(TMP, 'report.pdf')); console.log('   pdf downloaded') }
  await wait(page, 1500)
  await softClick(page, page.getByRole('button', { name: 'Spoken debrief' }), 300)
  await page.evaluate(() => window.__hideCursor?.())
  await wait(page, 26000)
  await finishClip('report', page, rec, agent)
}

if (only.includes('landing')) {
  console.log('landing: hero, then a glide to the capabilities')
  const { page, agent } = await newSession(browser)
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await wait(page, 1200)
  const rec = await record(page, 'landing')
  await wait(page, 6500)
  await page.evaluate(() => new Promise((done) => { const to = document.getElementById('capabilities').offsetTop, from = scrollY, start = performance.now(), ms = 2400
    const step = (n) => { const p = Math.min(1, (n - start) / ms); const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; scrollTo(0, from + (to - from) * e); p < 1 ? requestAnimationFrame(step) : done() }; requestAnimationFrame(step) }))
  await wait(page, 4000)
  await finishClip('landing', page, rec, agent)
}

await browser.close()
console.log('clips.json:', Object.keys(manifest).join(', '))
