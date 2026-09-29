import React from 'react'
import { AbsoluteFill, Audio, Freeze, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { BEAT_A, BEAT_B, BEAT_C, BEAT_D, COCKPIT_CLICK, REPORT_BEAT, STILL_AFTER_A, STILL_ASK, STILL_CHECKLIST, captions, type Beat } from './beats'
import { Bubble, Clinician, Monitor, Table } from './people'
import { D, DURS, FADE, FPS, LEAD, LIVE_LEAD, SCENES, STARTS, cueIn, segFrames } from './timing'
import {
  ANESTH, BAD, Backdrop, BlurWords, BrowserFrame, CLAMP, Card, Chip, Count, DIM, Eyebrow, FAINT, type Focus, Headline, LiveBadge, MONO, NURSE, SANS, SERIF, SURGEON,
  TEAL, TEXT, Waves, Wordmark, easeInOut, easeOut, glass,
} from './ui'

export { FPS, SURGR_DURATION } from './timing'

/* -------------------------------------------------------------------- sound */
const Sfx: React.FC<{ name: 'whoosh' | 'tick' | 'chime' | 'rise' | 'hit'; at: number; volume?: number }> = ({ name, at, volume = 0.3 }) => (
  <Sequence from={Math.max(0, at)} layout="none"><Audio src={staticFile(`sfx/${name}.mp3`)} volume={volume} /></Sequence>
)

/* ------------------------------------------------------------------ layouts */
const Side: React.FC<{ eyebrow: string; lines: (string | { em: string })[]; size?: number; children?: React.ReactNode; frame: React.ReactNode; out?: number; lines2?: (string | { em: string })[]; swap?: number }> = ({
  eyebrow, lines, size = 64, children, frame, out, lines2, swap,
}) => (
  <AbsoluteFill>
    <div style={{ position: 'absolute', left: 96, top: 150, width: 560 }}>
      <Eyebrow delay={4}>{eyebrow}</Eyebrow>
      <div style={{ height: 24 }} />
      <div style={{ position: 'relative', minHeight: size * 2.2 }}>
        <div style={{ position: 'absolute', left: 0, top: 0 }}><Headline lines={lines} delay={8} size={size} out={swap ?? out} /></div>
        {lines2 && swap !== undefined && <div style={{ position: 'absolute', left: 0, top: 0 }}><Headline lines={lines2} delay={swap + 8} size={size} /></div>}
      </div>
      <div style={{ height: 34 }} />
      {children}
    </div>
    <div style={{ position: 'absolute', right: 70, top: 0, bottom: 0, width: 1140, display: 'flex', alignItems: 'center' }}>{frame}</div>
  </AbsoluteFill>
)
const Stack: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 14 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap, alignItems: 'flex-start' }}>{children}</div>
)

/* ================================================================ scenes == */

const Title: React.FC = () => (
  <>
    <Backdrop traceY={820} />
    <Sfx name="hit" at={2} volume={0.35} />
    <Sfx name="rise" at={cueIn(0, 'every') - 20} volume={0.22} />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -80 }}>
        <Wordmark height={150} delay={2} />
        <div style={{ height: 40 }} />
        <Headline lines={['Every verbal order in the OR,', { em: 'verified out loud.' }]} delay={cueIn(0, 'every')} size={78} align="center" stagger={10} />
        <div style={{ height: 34 }} />
        <Eyebrow delay={cueIn(0, 'verified') + 12} color={FAINT} size={16}>AssemblyAI Voice Agent Hackathon · 2026</Eyebrow>
      </div>
    </AbsoluteFill>
  </>
)

const Problem: React.FC = () => {
  const f = useCurrentFrame()
  const tSurgeon = cueIn(1, 'surgeon')
  const tHears = cueIn(1, 'anesthesia')
  const tRule = cueIn(1, 'rule')
  const tSkipped = cueIn(1, 'skipped')
  const tMisheard = cueIn(1, 'misheard')
  const tNothing = cueIn(1, 'nothing')
  const monitorVol = (fr: number) => interpolate(fr, [0, 20, tNothing - 10, tNothing + 6, D('problem') - 10, D('problem')], [0, 0.1, 0.1, 0.34, 0.34, 0], CLAMP)
  const steps = ['Order', 'Read back', 'Confirm', 'Give']
  const rulesOut = tNothing - 8
  return (
    <>
      <Backdrop trace={false} />
      <Audio src={staticFile('sfx/monitor.mp3')} loop volume={monitorVol} />
      <Table x={410} y={742} w={1100} delay={6} />
      <Monitor x={1520} y={170} w={320} delay={14} />
      <Clinician role="surgeon" x={300} y={360} delay={10} talk={[[tSurgeon + 4, tSurgeon + 70]]} look={0.6} seed={1} />
      <Clinician role="nurse" x={810} y={372} scale={0.9} delay={16} look={-0.2} seed={2} dim={f > tHears && f < tNothing} />
      <Clinician role="anesth" x={1300} y={360} delay={22} talk={[[tHears + 22, tHears + 70]]} look={-0.6} seed={3} />
      <div style={{ position: 'absolute', left: 110, top: 80 }}>
        <Eyebrow delay={4} out={tSurgeon - 12}>The problem</Eyebrow>
        <div style={{ height: 18 }} />
        <Headline lines={['Drugs are ordered', { em: 'by voice.' }]} delay={cueIn(1, 'drugs')} size={64} out={tSurgeon - 10} />
      </div>
      <Bubble x={120} y={190} role="surgeon" delay={tSurgeon + 2} out={tNothing - 12} width={520} text={<>Push <b style={{ color: SURGEON }}>100 micrograms</b> of fentanyl.</>} />
      <Bubble x={970} y={214} role="anesth" wrong delay={tHears + 20} out={tNothing - 12} width={470} tail="right" text={<>Pushing <b style={{ color: BAD }}>10 micrograms</b>…</>} />
      <Sfx name="tick" at={tSurgeon + 2} volume={0.2} />
      <Sfx name="tick" at={tHears + 20} volume={0.22} />
      {/* The rule, and how it breaks. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 96, display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center' }}>
        {steps.map((s, i) => {
          const crossed = s === 'Read back' && f > tSkipped
          const shake = s === 'Read back' && f > tMisheard && f < tMisheard + 16 ? Math.sin(f * 1.8) * 5 : 0
          return (
            <React.Fragment key={s}>
              <div style={{ transform: `translateX(${shake}px)` }}>
                <Chip tone={crossed ? 'bad' : i === 1 ? 'teal' : 'plain'} delay={tRule + i * 5} size={24} out={rulesOut} style={{ textDecoration: crossed ? 'line-through' : 'none' }}>{s}</Chip>
              </div>
              {i < steps.length - 1 && <span style={{ ...{ opacity: easeOut(interpolate(f, [tRule + i * 5 + 4, tRule + i * 5 + 14], [0, 1], CLAMP)) * (f > rulesOut ? 0 : 1) }, color: FAINT, fontSize: 26 }}>→</span>}
            </React.Fragment>
          )
        })}
      </div>
      <Sfx name="tick" at={tSkipped} volume={0.25} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 110 }}>
        <Headline lines={[{ em: 'And nothing beeps.' }]} delay={tNothing - 2} size={96} align="center" emColor={TEXT} />
      </AbsoluteFill>
    </>
  )
}

const StatCard: React.FC<{ delay: number; value: React.ReactNode; label: string; source: string; width: number }> = ({ delay, value, label, source, width }) => (
  <Card delay={delay} width={width} pad={36}>
    <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 104, lineHeight: 0.95, color: TEXT, letterSpacing: '-0.02em' }}>{value}</div>
    <div style={{ height: 18 }} />
    <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 27, lineHeight: 1.35, color: DIM }}>{label}</div>
    <div style={{ height: 16 }} />
    <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.08em', color: FAINT }}>{source}</div>
  </Card>
)
const Plane: React.FC<{ color: string }> = ({ color }) => (
  <svg width="54" height="54" viewBox="0 0 24 24" fill={color}><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" /></svg>
)
const Cross: React.FC<{ color: string }> = ({ color }) => (
  <svg width="54" height="54" viewBox="0 0 24 24" fill={color}><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" /></svg>
)
const Stakes: React.FC = () => {
  const tTwenty = cueIn(2, 'twenty')
  const tTwo = cueIn(2, 'two')
  const tAviation = cueIn(2, 'aviation')
  const tMemory = cueIn(2, 'memory')
  return (
    <>
      <Backdrop traceY={1000} intensity={0.8} />
      <div style={{ position: 'absolute', left: 110, top: 90 }}><Eyebrow delay={4}>Why it matters</Eyebrow></div>
      <div style={{ position: 'absolute', left: 110, top: 150, display: 'flex', gap: 30 }}>
        <StatCard delay={cueIn(2, 'about') - 4} width={830} value={<>1 in <Count from={1} to={20} start={tTwenty - 16} dur={20} fmt={(n) => String(Math.round(n))} /></>} label="perioperative medication administrations involve an error or adverse drug event" source="NANJI ET AL., ANESTHESIOLOGY, 2016" />
        <StatCard delay={tTwo - 6} width={830} value="~2 in 3" label="serious incidents hospitals report involve a breakdown in communication" source="THE JOINT COMMISSION" />
      </div>
      <Sfx name="tick" at={cueIn(2, 'about')} volume={0.2} />
      <Sfx name="tick" at={tTwo} volume={0.2} />
      <div style={{ position: 'absolute', left: 110, top: 640, display: 'flex', gap: 30 }}>
        <Card delay={tAviation - 4} width={830} pad={34} glow={TEAL}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <Plane color={TEAL} />
            <div>
              <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '0.18em', color: TEAL }}>AVIATION</div>
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 50, color: TEXT, lineHeight: 1.05 }}>Read-backs are mandatory.</div>
            </div>
          </div>
        </Card>
        <Card delay={cueIn(2, 'operating') - 4} width={830} pad={34} glow={BAD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <Cross color={BAD} />
            <div>
              <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '0.18em', color: BAD }}>OPERATING ROOMS</div>
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 50, color: TEXT, lineHeight: 1.05 }}>Still run on <BlurWords text="memory." delay={tMemory - 2} /></div>
            </div>
          </div>
        </Card>
      </div>
      <Sfx name="whoosh" at={tAviation - 6} volume={0.16} />
    </>
  )
}

const Node: React.FC<{ delay: number; title: string; sub: string; icon: React.ReactNode; glow?: string }> = ({ delay, title, sub, icon, glow }) => (
  <Card delay={delay} width={380} pad={32} glow={glow} style={{ minHeight: 330, display: 'flex', flexDirection: 'column' }}>
    <div style={{ height: 96, display: 'flex', alignItems: 'center' }}>{icon}</div>
    <div style={{ flex: 1 }} />
    <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 46, color: TEXT, lineHeight: 1 }}>{title}</div>
    <div style={{ height: 12 }} />
    <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 23, color: DIM, lineHeight: 1.35 }}>{sub}</div>
  </Card>
)
const Ring: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame()
  const p = interpolate(f, [start, start + 60], [0, 1], CLAMP)
  const secs = Math.max(0, Math.ceil(10 - p * 10))
  const C = 2 * Math.PI * 38
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r="38" stroke="rgba(255,255,255,0.12)" strokeWidth="6" fill="none" />
      <circle cx="48" cy="48" r="38" stroke={p >= 1 ? BAD : '#f59e0b'} strokeWidth="6" fill="none" strokeDasharray={C} strokeDashoffset={C * p} transform="rotate(-90 48 48)" strokeLinecap="round" />
      <text x="48" y="58" textAnchor="middle" fontFamily={MONO} fontSize="28" fill={TEXT}>{secs}</text>
    </svg>
  )
}
const Solution: React.FC = () => {
  const f = useCurrentFrame()
  const tListens = cueIn(3, 'listens')
  const tTen = cueIn(3, 'ten')
  const tDrug = cueIn(3, 'drug')
  const tLoud = cueIn(3, 'loud')
  const checks = [['drug', 'Drug'], ['dose', 'Dose'], ['unit', 'Unit'], ['route', 'Route']] as const
  return (
    <>
      <Backdrop traceY={1010} intensity={0.8} />
      <div style={{ position: 'absolute', left: 110, top: 96 }}>
        <Eyebrow delay={4}>What Surgr does</Eyebrow>
        <div style={{ height: 20 }} />
        <Headline lines={['It listens. It checks.', { em: 'It speaks up.' }]} delay={tListens - 6} size={72} />
      </div>
      <div style={{ position: 'absolute', left: 110, top: 470, display: 'flex', gap: 34, alignItems: 'stretch' }}>
        <Node delay={tListens} title="Hears the order" sub="Streaming speech-to-text, medical mode, speaker labels." icon={<Waves color={TEAL} size={88} />} />
        <Node delay={tTen - 4} title="Waits ten seconds" sub="Every order needs a read-back from someone else." icon={<Ring start={tTen} />} />
        <Node delay={tDrug - 8} title="Checks it" sub="0.1 mg and 100 mcg agree. Rocuronium and succinylcholine do not."
          icon={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: 320 }}>{checks.map(([w, l]) => <Chip key={l} tone="teal" size={18} delay={cueIn(3, w)} mono>{l}</Chip>)}</div>} />
        <Node delay={cueIn(3, 'moment') - 4} glow={f > tLoud ? TEAL : undefined} title="Says it out loud" sub="Through the AssemblyAI Voice Agent, in the room." icon={<Waves color={f > tLoud ? TEAL : 'rgba(255,255,255,0.4)'} size={88} active={f > tLoud} />} />
      </div>
      {checks.map(([w]) => <Sfx key={w} name="tick" at={cueIn(3, w)} volume={0.16} />)}
      <Sfx name="chime" at={tLoud} volume={0.24} />
    </>
  )
}

const Cockpit: React.FC = () => {
  const rate = 0.6
  const clickAt = COCKPIT_CLICK
  const toScene = (t: number) => (t - 0.3) / rate + LEAD / FPS
  return (
    <>
      <Backdrop trace={false} intensity={0.7} />
      <Side eyebrow="The cockpit" lines={['A live microphone.', { em: 'Real alerts.' }]} size={62}
        frame={<BrowserFrame width={1140} delay={2} badge={<LiveBadge label="Live" />} shots={[{ clip: 'live', startFrom: 0.3, playbackRate: rate, freezeAt: 5.0 }]}
          focus={[{ rect: [900, 0, 700, 90], from: toScene(clickAt) - 1.6, to: toScene(clickAt) + 1.0, maxZoom: 2.2 }]} />}>
        <Stack>
          <Chip tone="teal" delay={cueIn(4, 'listening')} size={20} dot>Streaming STT · medical mode · speaker labels</Chip>
          <Chip tone="plain" delay={cueIn(4, 'synthetic')} size={20}>Surgeon, anesthesia, nurse: synthetic voices</Chip>
          <Chip tone="warn" delay={cueIn(4, 'watch')} size={20}>Watch the dose</Chip>
        </Stack>
      </Side>
      <Sfx name="tick" at={Math.round(toScene(clickAt) * FPS)} volume={0.25} />
    </>
  )
}

/* ------------------------------------------------------------- live scenes */

const ROLE_UI = {
  surgeon: { label: 'Surgeon', color: SURGEON },
  anesthesia: { label: 'Anesthesia', color: ANESTH },
  nurse: { label: 'Scrub nurse', color: NURSE },
  surgr: { label: 'Surgr', color: TEAL },
} as const

const LiveScene: React.FC<{ beat: Beat }> = ({ beat }) => {
  const f = useCurrentFrame()
  const offs: number[] = []
  beat.segs.reduce((n, s) => { offs.push(n); return n + segFrames(s) }, LIVE_LEAD)
  /** Scene frame for a moment of the take; a trimmed moment maps to the start of the next window. */
  const toFrame = (t: number) => {
    for (let i = 0; i < beat.segs.length; i++) {
      const [a, b] = beat.segs[i]
      if (t < a) return offs[i]
      if (t <= b) return offs[i] + (t - a) * FPS
    }
    const last = beat.segs.length - 1
    return offs[last] + segFrames(beat.segs[last])
  }
  const focus: Focus[] = beat.focus.map((fo) => ({ ...fo, from: toFrame(fo.from) / FPS, to: fo.to >= 999 ? 9999 : toFrame(fo.to) / FPS }))
  const shots = beat.segs.map(([a], i) => ({ clip: 'live', at: offs[i] / FPS, startFrom: a }))
  /** Audio for one stem, only where a window of the film and the stem's audible range overlap. */
  const stem = (src: string, ranges: [number, number][], volume: number) =>
    beat.segs.flatMap(([a, b], i) =>
      ranges.map(([ra, rb], k) => {
        const from = Math.max(a, ra)
        const to = Math.min(b, rb)
        if (to <= from) return null
        return (
          <Sequence key={`${src}-${i}-${k}`} from={Math.round(offs[i] + (from - a) * FPS)} durationInFrames={Math.round((to - from) * FPS)} layout="none">
            <Audio src={staticFile(src)} startFrom={Math.round(from * FPS)} volume={volume} />
          </Sequence>
        )
      }),
    )
  const caps = captions(beat).map((c) => ({ ...c, fromF: toFrame(c.from), toF: toFrame(c.to) }))
  const cap = [...caps].reverse().find((c) => f >= c.fromF && f <= c.toF)
  const capIn = cap ? easeOut(interpolate(f, [cap.fromF, cap.fromF + 10], [0, 1], CLAMP)) : 0
  const ui = cap ? ROLE_UI[cap.role] : null
  const trimmed = beat.segs.slice(1).map((s, i) => ({ at: offs[i + 1], gap: s[0] - beat.segs[i][1] }))
  const note = [...trimmed].reverse().find((n) => f >= n.at && f <= n.at + 75)
  return (
    <>
      <Backdrop trace={false} intensity={0.55} />
      <Audio src={staticFile('sfx/room.mp3')} loop volume={0.08} />
      {stem('agent/live-mic.wav', beat.mic, 0.95)}
      {stem('agent/live.wav', beat.agent, 1.15)}
      <div style={{ position: 'absolute', left: (1920 - 1560) / 2, top: 18 }}>
        <BrowserFrame width={1560} enter={false} shots={shots} focus={focus} title={`Surgr · ${beat.eyebrow}`} badge={<LiveBadge />}
          overlay={note && (
            <div style={{ position: 'absolute', left: 22, bottom: 20 }}>
              <Chip tone="plain" mono size={15} delay={note.at} out={note.at + 60}>{`${note.gap.toFixed(1)} s ${beat.skip ?? 'of waiting on the network trimmed'}`}</Chip>
            </div>
          )} />
      </div>
      {trimmed.map((n, i) => {
        const o = interpolate(f, [n.at - 2, n.at, n.at + 6], [0, 0.45, 0], CLAMP)
        return <AbsoluteFill key={i} style={{ background: '#000', opacity: o, pointerEvents: 'none' }} />
      })}
      {cap && ui && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 960, display: 'flex', justifyContent: 'center' }}>
          <div style={{ opacity: capIn, transform: `translateY(${(1 - capIn) * 10}px)`, filter: `blur(${(1 - capIn) * 6}px)`, display: 'flex', alignItems: 'center', gap: 16, maxWidth: 1560 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 17, letterSpacing: '0.16em', textTransform: 'uppercase', color: ui.color, whiteSpace: 'nowrap' }}>
              {cap.role === 'surgr' ? <Waves size={26} color={TEAL} /> : <span style={{ width: 10, height: 10, borderRadius: 99, background: ui.color }} />}
              {ui.label}
            </span>
            <span style={{ fontFamily: cap.role === 'surgr' ? SERIF : SANS, fontStyle: cap.role === 'surgr' ? 'italic' : 'normal', fontWeight: cap.role === 'surgr' ? 400 : 500, fontSize: cap.role === 'surgr' ? 32 : 29, color: TEXT, lineHeight: 1.18 }}>
              {cap.role === 'surgr' ? `“${cap.text}”` : cap.text}
            </span>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------- narration over footage */

const Frozen: React.FC<{ at: number; focus?: Focus[]; badge?: string }> = ({ at, focus = [], badge = 'Live take' }) => (
  <BrowserFrame width={1140} delay={2} badge={<LiveBadge label={badge} />} shots={[{ clip: 'live', startFrom: at, playbackRate: 1, freezeAt: at }]} focus={focus} />
)

const AfterA: React.FC = () => (
  <Side eyebrow="What just happened" lines={['Two voices.', { em: 'One microphone.' }]} size={64}
    frame={<><Backdrop trace={false} intensity={0.6} /><Frozen at={STILL_AFTER_A.at} focus={[{ rect: STILL_AFTER_A.rect, from: 0, to: 999, maxZoom: 3 }]} /></>}>
    <Stack>
      <div style={{ display: 'flex', gap: 10 }}>
        <Chip tone="surgeon" delay={cueIn(5, 'speaker')} size={20} dot>Speaker A · Surgeon</Chip>
        <Chip tone="anesth" delay={cueIn(5, 'speaker') + 6} size={20} dot>Speaker B · Anesthesia</Chip>
      </div>
      <Chip tone="bad" delay={cueIn(5, 'dose')} size={22} mono>10 mcg ≠ 100 mcg</Chip>
      <Chip tone="ok" delay={cueIn(5, 'correct')} size={22} dot>Correct read-back · loop closed</Chip>
    </Stack>
    <Sfx name="tick" at={cueIn(5, 'dose')} volume={0.2} />
    <Sfx name="chime" at={cueIn(5, 'closed')} volume={0.2} />
  </Side>
)

const Nobody: React.FC = () => (
  <>
    <Backdrop traceY={860} intensity={0.8} />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Headline lines={['Now, an order', { em: 'that nobody answers.' }]} delay={LEAD} size={84} align="center" stagger={8} />
    </AbsoluteFill>
  </>
)

const Ask: React.FC = () => {
  const tAsk = cueIn(7, 'room')
  const tools = ['get_open_orders', 'get_last_order', 'get_checklist_status', 'get_session_summary', 'get_recent_alerts', 'acknowledge_alerts']
  return (
    <Side eyebrow="Ask Surgr" lines={['Ten seconds,', { em: 'then it calls it.' }]} lines2={['The room can', { em: 'ask it questions.' }]} swap={tAsk - 4} size={62}
      frame={<><Backdrop trace={false} intensity={0.6} /><Frozen at={STILL_ASK.at} focus={[{ rect: STILL_ASK.rect, from: 0, to: 999, maxZoom: 3 }]} /></>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, width: 560 }}>
        {tools.map((t, i) => <Chip key={t} tone="teal" mono size={16} delay={cueIn(7, 'tool') + i * 3}>{t}</Chip>)}
      </div>
      <Sfx name="tick" at={cueIn(7, 'tool')} volume={0.2} />
    </Side>
  )
}

const Checklist: React.FC = () => (
  <Side eyebrow="WHO Surgical Safety Checklist" lines={['The checklist', { em: 'ticks itself.' }]} size={64}
    frame={<><Backdrop trace={false} intensity={0.6} /><Frozen at={STILL_CHECKLIST.at} focus={[{ rect: STILL_CHECKLIST.rect, from: 0, to: 999, maxZoom: 3 }]} /></>}>
    <Stack>
      <Chip tone="nurse" delay={cueIn(8, 'checklist')} size={20} dot>21 items · Sign In · Time Out · Sign Out</Chip>
      <Chip tone="warn" delay={cueIn(8, 'missing')} size={20}>A phase that ends with gaps is an alert</Chip>
    </Stack>
  </Side>
)

const Record: React.FC = () => {
  const f = useCurrentFrame()
  const rate = 1.5
  const start = REPORT_BEAT.start
  const sceneT = (clipT: number) => (clipT - start) / rate + LEAD / FPS
  // The PDF appears when the page confirms it was saved, never before the click that saves it.
  const tPdf = Math.max(cueIn(9, 'pdf'), Math.round(sceneT(REPORT_BEAT.toastAt) * FPS))
  const pdfIn = easeOut(interpolate(f, [tPdf, tPdf + 20], [0, 1], CLAMP))
  return (
    <>
      <Backdrop trace={false} intensity={0.6} />
      <Side eyebrow="The record" lines={['The audit', { em: 'writes itself.' }]} size={64}
        frame={<BrowserFrame width={1140} delay={2} title="Surgr · operative record" badge={<LiveBadge label={`Same session · ${rate}× speed`} />} shots={[{ clip: 'report', startFrom: start, playbackRate: rate }]}
          focus={[{ rect: REPORT_BEAT.top, from: 0, to: sceneT(REPORT_BEAT.toastAt) - 1.4, maxZoom: 3 }, { rect: REPORT_BEAT.deliver, from: sceneT(REPORT_BEAT.toastAt) - 1.2, to: 999, maxZoom: 3 }]} />}>
        <Stack>
          <Chip tone="plain" delay={cueIn(9, 'every')} size={20}>Every order, read-back and alert · timestamped</Chip>
          <div style={{ display: 'flex', gap: 10 }}>
            <Chip tone="teal" delay={tPdf} size={20}>PDF</Chip>
            <Chip tone="blue" delay={Math.max(cueIn(9, 'telegram'), tPdf + 6)} size={20}>Telegram</Chip>
            <Chip tone="nurse" delay={Math.max(cueIn(9, 'debrief'), tPdf + 12)} size={20}>Spoken debrief</Chip>
          </div>
        </Stack>
      </Side>
      <div style={{ position: 'absolute', left: 110, top: 520, width: 300, opacity: pdfIn, transform: `translateY(${(1 - pdfIn) * 40}px) rotate(${-4 + pdfIn * 1.5}deg)`, filter: `blur(${(1 - pdfIn) * 8}px)` }}>
        <div style={{ ...glass, padding: 8, borderRadius: 14 }}>
          <Img src={staticFile('brand/report-p1-1.png')} style={{ width: '100%', display: 'block', borderRadius: 8 }} />
        </div>
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 14, letterSpacing: '0.14em', color: FAINT }}>THE DOWNLOADED PDF · PAGE 1</div>
      </div>
      <Sfx name="tick" at={tPdf} volume={0.2} />
      <Sfx name="chime" at={cueIn(9, 'debrief')} volume={0.18} />
    </>
  )
}

const Stack4: React.FC = () => {
  const items = [
    { word: 'streaming', name: 'Streaming STT v3', tag: 'universal-3-6-pro · medical-v1', role: 'Sub-second transcripts; drug names and doses formatted by medical mode.' },
    { word: 'speaker', name: 'Speaker labels', tag: 'true diarization', role: 'One microphone, three roles; a read-back from the wrong person is caught.' },
    { word: 'gateway', name: 'LLM Gateway', tag: 'JSON-schema outputs', role: 'Structured answers for anything the rules cannot settle, and the narrative.' },
    { word: 'agent', name: 'Voice Agent API', tag: 'reply.create · tool calls', role: "Surgr's voice in the room, and the answers when the room asks." },
  ]
  return (
    <>
      <Backdrop traceY={1010} intensity={0.8} />
      <div style={{ position: 'absolute', left: 110, top: 100 }}>
        <Eyebrow delay={4}>Built on AssemblyAI</Eyebrow>
        <div style={{ height: 20 }} />
        <Headline lines={['Four products,', { em: 'one safety loop.' }]} delay={cueIn(10, 'under')} size={72} />
      </div>
      <div style={{ position: 'absolute', left: 110, top: 470, display: 'flex', gap: 28 }}>
        {items.map((it, i) => (
          <Card key={it.name} delay={cueIn(10, it.word) - 4} width={402} pad={32} style={{ minHeight: 300 }}>
            <div style={{ fontFamily: MONO, fontSize: 15, color: TEAL, letterSpacing: '0.08em' }}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{ height: 18 }} />
            <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 44, color: TEXT, lineHeight: 1 }}>{it.name}</div>
            <div style={{ height: 10 }} />
            <div style={{ fontFamily: MONO, fontSize: 16, color: TEAL }}>{it.tag}</div>
            <div style={{ height: 18 }} />
            <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 22, color: DIM, lineHeight: 1.35 }}>{it.role}</div>
          </Card>
        ))}
      </div>
      {items.map((it) => <Sfx key={it.word} name="tick" at={cueIn(10, it.word) - 4} volume={0.18} />)}
      <div style={{ position: 'absolute', left: 110, top: 860 }}>
        <Chip tone="ok" delay={cueIn(10, 'verified')} size={22} dot>Every integration verified against the live services</Chip>
      </div>
      <Sfx name="chime" at={cueIn(10, 'verified')} volume={0.2} />
    </>
  )
}

const Business: React.FC = () => {
  const f = useCurrentFrame()
  const steps = [
    { word: 'simulation', n: 'Stage 1 · now', t: 'Simulation labs and residency training', s: 'No clearance needed; instant spoken feedback.' },
    { word: 'silent', n: 'Stage 2', t: 'Silent analytics in real rooms', s: 'Closed-loop and checklist data, no intervention.' },
    { word: 'intervention', n: 'Stage 3', t: 'Live intervention', s: 'After clinical validation and clearance.' },
  ]
  const bars = [0.62, 0.78, 0.91, 0.84, 0.97]
  const tQuality = cueIn(11, 'quality')
  return (
    <>
      <Backdrop traceY={1010} intensity={0.8} />
      <div style={{ position: 'absolute', left: 110, top: 90 }}><Eyebrow delay={4}>Who gains · how it grows</Eyebrow></div>
      <Clinician role="anesth" x={96} y={170} scale={0.72} delay={cueIn(11, 'anesthesiologist') - 10} seed={4} look={0.5} />
      <div style={{ position: 'absolute', left: 296, top: 268, width: 70, height: 1.5, background: `linear-gradient(90deg, transparent, ${ANESTH})`, opacity: easeOut(interpolate(f, [cueIn(11, 'second') - 4, cueIn(11, 'second') + 10], [0, 1], CLAMP)) }} />
      <div style={{ position: 'absolute', left: 370, top: 250 }}>
        <Chip tone="anesth" delay={cueIn(11, 'second')} size={22} dot>A second check before the syringe goes in</Chip>
      </div>
      <div style={{ position: 'absolute', left: 110, top: 560 }}>
        <Card delay={tQuality - 4} width={700} pad={30}>
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.16em', color: TEAL }}>QUALITY TEAMS · CLOSED-LOOP RATE BY ROOM</div>
          <div style={{ height: 22 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, height: 150 }}>
            {bars.map((b, i) => {
              const p = easeOut(interpolate(f, [tQuality + 4 + i * 4, tQuality + 24 + i * 4], [0, 1], CLAMP))
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: '100%', height: 130 * b * p, borderRadius: 10, background: `linear-gradient(180deg, ${TEAL}, rgba(45,212,191,0.25))` }} />
                  <div style={{ fontFamily: MONO, fontSize: 14, color: FAINT }}>OR {i + 1}</div>
                </div>
              )
            })}
          </div>
          <div style={{ height: 10 }} />
          <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 17, color: FAINT }}>Illustrative chart</div>
        </Card>
      </div>
      <div style={{ position: 'absolute', left: 900, top: 170, width: 900, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {steps.map((s) => (
          <Card key={s.word} delay={cueIn(11, s.word) - 4} pad={28} glow={s.word === 'simulation' ? TEAL : undefined}>
            <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.16em', color: TEAL }}>{s.n.toUpperCase()}</div>
            <div style={{ height: 10 }} />
            <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 44, color: TEXT, lineHeight: 1.02 }}>{s.t}</div>
            <div style={{ height: 8 }} />
            <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 22, color: DIM }}>{s.s}</div>
          </Card>
        ))}
        <div><Chip tone="teal" delay={cueIn(11, 'priced')} size={24} dot>Priced per operating room</Chip></div>
      </div>
      {steps.map((s) => <Sfx key={s.word} name="tick" at={cueIn(11, s.word) - 4} volume={0.16} />)}
    </>
  )
}

const Close: React.FC = () => (
  <>
    <Backdrop traceY={900} />
    <Sfx name="rise" at={cueIn(12, 'gives') - 30} volume={0.22} />
    <Sfx name="hit" at={cueIn(12, 'gives')} volume={0.3} />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -40, width: 1500 }}>
        <Wordmark height={110} delay={2} />
        <div style={{ height: 50 }} />
        <Headline lines={['Aviation cockpits have mandatory read-backs,', 'and a voice recorder.']} delay={cueIn(12, 'aviation')} size={56} align="center" stagger={16} />
        <div style={{ height: 22 }} />
        <Headline lines={['Operating rooms have neither.']} delay={cueIn(12, 'operating')} size={56} align="center" />
        <div style={{ height: 30 }} />
        <Headline lines={[{ em: 'Surgr gives them both.' }]} delay={cueIn(12, 'gives')} size={92} align="center" />
        <div style={{ height: 44 }} />
        <div style={{ display: 'flex', gap: 14 }}>
          <Chip tone="teal" delay={cueIn(12, 'both') + 10} size={22} dot>Built on AssemblyAI</Chip>
          <Chip tone="plain" delay={cueIn(12, 'both') + 16} size={22} mono>github.com/mrnetwork0001/Surgr</Chip>
        </div>
      </div>
    </AbsoluteFill>
  </>
)

/* ================================================================ assembly == */

const BODIES: Record<string, React.FC> = {
  title: Title, problem: Problem, stakes: Stakes, solution: Solution, cockpit: Cockpit, afterA: AfterA, nobody: Nobody, ask: Ask, checklist: Checklist, record: Record, stack: Stack4, business: Business, close: Close,
  liveA: () => <LiveScene beat={BEAT_A} />, liveB: () => <LiveScene beat={BEAT_B} />, liveC: () => <LiveScene beat={BEAT_C} />, liveD: () => <LiveScene beat={BEAT_D} />,
}

const Scene: React.FC<{ first: boolean; children: React.ReactNode }> = ({ first, children }) => {
  const f = useCurrentFrame()
  const p = first ? 1 : easeInOut(interpolate(f, [0, FADE], [0, 1], CLAMP))
  return <AbsoluteFill style={{ opacity: p, filter: p < 1 ? `blur(${(1 - p) * 10}px)` : undefined }}>{children}</AbsoluteFill>
}

/** The music bed plays only under narration, continuing where it left off, and rests under the live take. */
const bedOffsets = (() => {
  let acc = 0
  return SCENES.map((s, i) => { const o = acc; if (!s.beat) acc += DURS[i]; return o })
})()

/** Frame 0 is the settled title card, so every platform's thumbnail shows it; length and sync are unchanged. */
const Poster: React.FC = () => {
  const f = useCurrentFrame()
  if (f !== 0) return null
  return (
    <AbsoluteFill>
      <Freeze frame={150}><Title /></Freeze>
    </AbsoluteFill>
  )
}

export const Surgr: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#000' }}>
    {SCENES.map((s, i) => {
      const Body_ = BODIES[s.id]
      const dur = DURS[i] + (i === SCENES.length - 1 ? 0 : FADE)
      const last = i === SCENES.length - 1
      return (
        <Sequence key={s.id} from={STARTS[i]} durationInFrames={dur} name={s.id} premountFor={30}>
          <Scene first={i === 0}><Body_ /></Scene>
          {s.vo !== undefined && (
            <>
              <Sequence from={LEAD} layout="none"><Audio src={staticFile(`vo/v${String(s.vo).padStart(2, '0')}.mp3`)} volume={1.5} /></Sequence>
              <Audio src={staticFile('sfx/bed.mp3')} startFrom={bedOffsets[i]}
                volume={(fr) => interpolate(fr, [0, 14, dur - (last ? 60 : 14), dur], [0, s.id === 'title' || last ? 0.2 : 0.13, s.id === 'title' || last ? 0.2 : 0.13, 0], CLAMP)} />
            </>
          )}
        </Sequence>
      )
    })}
    <Poster />
    {STARTS.slice(1).map((st, i) => (
      <Sequence key={`w${i}`} from={st - 4} durationInFrames={45} layout="none"><Audio src={staticFile('sfx/whoosh.mp3')} volume={0.18} /></Sequence>
    ))}
  </AbsoluteFill>
)

void [DIM, BlurWords]
