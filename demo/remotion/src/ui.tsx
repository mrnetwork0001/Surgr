import React from 'react'
import { AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { loadFont as loadInstrument } from '@remotion/google-fonts/InstrumentSerif'
import { loadFont as loadBarlow } from '@remotion/google-fonts/Barlow'
import { loadFont as loadGeistMono } from '@remotion/google-fonts/GeistMono'
import clipsJson from './clips.json'

/**
 * The Surgr film is set the way the product is: pure black, liquid-glass panels with hairline
 * gradient edges, Instrument Serif italic for anything said out loud, Barlow for everything else,
 * one teal accent, and the cockpit's role colours for the people in the room. Motion borrows the
 * landing page: words blur in, cards rise and settle, and a monitor trace sweeps underneath.
 */

/* ------------------------------------------------------------------ palette */
export const BG = '#000000'
export const TEXT = '#ffffff'
export const DIM = 'rgba(255,255,255,0.74)'
export const FAINT = 'rgba(255,255,255,0.5)'
export const LINE = 'rgba(255,255,255,0.12)'
export const TEAL = '#2dd4bf'
export const BLUE = '#0ea5e9'
export const SURGEON = '#60a5fa'
export const ANESTH = '#a78bfa'
export const NURSE = '#34d399'
export const BAD = '#ef4444'
export const OK = '#22c55e'
export const WARN = '#f59e0b'

/* -------------------------------------------------------------------- fonts */
const serif = loadInstrument('normal', { weights: ['400'], subsets: ['latin'] })
loadInstrument('italic', { weights: ['400'], subsets: ['latin'] })
const barlow = loadBarlow('normal', { weights: ['300', '400', '500', '600'], subsets: ['latin'] })
const mono = loadGeistMono('normal', { weights: ['400', '500'], subsets: ['latin'] })
export const SERIF = `${serif.fontFamily}, Georgia, serif`
export const SANS = `${barlow.fontFamily}, system-ui, sans-serif`
export const MONO = `${mono.fontFamily}, ui-monospace, monospace`

/* ------------------------------------------------------------------- motion */
export const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

export const useRise = (delay = 0, distance = 20, out?: number) => {
  const f = useCurrentFrame()
  const pin = easeOut(interpolate(f, [delay, delay + 20], [0, 1], CLAMP))
  const pout = out === undefined ? 0 : easeInOut(interpolate(f, [out, out + 12], [0, 1], CLAMP))
  return { opacity: pin * (1 - pout), transform: `translateY(${(1 - pin) * distance - pout * 10}px)`, filter: `blur(${(1 - pin) * 8 + pout * 6}px)` }
}
export const Rise: React.FC<{ children: React.ReactNode; delay?: number; distance?: number; out?: number; style?: React.CSSProperties }> = ({ children, delay = 0, distance = 20, out, style }) => (
  <div style={{ ...useRise(delay, distance, out), ...style }}>{children}</div>
)

/** Word-by-word blur-in, the landing page's headline motion. */
export const BlurWords: React.FC<{ text: string; delay?: number; stagger?: number; style?: React.CSSProperties; out?: number }> = ({ text, delay = 0, stagger = 3, style, out }) => {
  const f = useCurrentFrame()
  const pout = out === undefined ? 0 : easeInOut(interpolate(f, [out, out + 12], [0, 1], CLAMP))
  return (
    <span style={{ ...style, opacity: 1 - pout }}>
      {text.split(' ').map((w, i) => {
        const p = easeOut(interpolate(f, [delay + i * stagger, delay + i * stagger + 18], [0, 1], CLAMP))
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: '0.26em', opacity: p, filter: `blur(${(1 - p) * 10}px)`, transform: `translateY(${(1 - p) * 26}px)` }}>
            {w}
          </span>
        )
      })}
    </span>
  )
}

export const Count: React.FC<{ from: number; to: number; start: number; dur?: number; fmt: (n: number) => string }> = ({ from, to, start, dur = 36, fmt }) => {
  const f = useCurrentFrame()
  const p = easeInOut(interpolate(f, [start, start + dur], [0, 1], CLAMP))
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(from + (to - from) * p)}</span>
}

/* ------------------------------------------------------------------ backdrop */

/** One heartbeat, phase 0..1, in R-wave units. */
const ecgShape = (p: number): number => {
  if (p < 0.1) return 0
  if (p < 0.18) return 0.12 * Math.sin(((p - 0.1) / 0.08) * Math.PI)
  if (p < 0.24) return 0
  if (p < 0.26) return -0.12 * ((p - 0.24) / 0.02)
  if (p < 0.3) return -0.12 + 1.12 * ((p - 0.26) / 0.04)
  if (p < 0.34) return 1 - 1.3 * ((p - 0.3) / 0.04)
  if (p < 0.37) return -0.3 + 0.3 * ((p - 0.34) / 0.03)
  if (p < 0.45) return 0
  if (p < 0.62) return 0.28 * Math.sin(((p - 0.45) / 0.17) * Math.PI)
  return 0
}

/** A monitor trace that sweeps left to right with an erase gap, as a pure function of the frame. */
export const Trace: React.FC<{ y: number; amp: number; color?: string; opacity?: number; speed?: number; bpm?: number; width?: number; height?: number; flat?: boolean }> = ({
  y, amp, color = TEAL, opacity = 0.55, speed = 260, bpm = 72, width = 1920, height = 1080, flat = false,
}) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const period = 60 / bpm
  const cursor = (t * speed) % width
  const gap = 70
  const pts: string[] = []
  const tail: string[] = []
  for (let x = 0; x <= width; x += 4) {
    const behind = (cursor - x + width) % width
    if (behind < 0 || (width - behind) < gap) { pts.push('M'); tail.push('M'); continue }
    const tAt = t - behind / speed
    const v = flat ? 0 : ecgShape(((tAt / period) % 1 + 1) % 1)
    const py = y - v * amp
    pts.push(`${x},${py.toFixed(1)}`)
    if (behind < 220) tail.push(`${x},${py.toFixed(1)}`)
    else tail.push('M')
  }
  const toPath = (arr: string[]) => {
    let d = ''
    let pen = false
    for (const p of arr) {
      if (p === 'M') { pen = false; continue }
      d += pen ? ` L${p}` : ` M${p}`
      pen = true
    }
    return d
  }
  const tip = (() => { const x = Math.round(cursor / 4) * 4; const tAt = t; const v = flat ? 0 : ecgShape(((tAt / period) % 1 + 1) % 1); return { x, y: y - v * amp } })()
  return (
    <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
      <path d={toPath(pts)} fill="none" stroke={color} strokeOpacity={opacity * 0.4} strokeWidth={2} strokeLinejoin="round" />
      <path d={toPath(tail)} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={2.6} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      <circle cx={tip.x} cy={tip.y} r={4} fill={color} opacity={opacity} style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
    </svg>
  )
}

/** Black, an overhead lamp that breathes, soft teal and blue blooms, drifting motes, grain, vignette. */
export const Backdrop: React.FC<{ trace?: boolean; traceY?: number; lamp?: boolean; intensity?: number }> = ({ trace = true, traceY = 900, lamp = true, intensity = 1 }) => {
  const f = useCurrentFrame()
  const breath = 0.85 + 0.15 * Math.sin(f / 30 * 0.9)
  const motes = Array.from({ length: 36 }, (_, i) => {
    const seed = (i * 9301 + 49297) % 233280
    const r = seed / 233280
    const x = (r * 1920 + i * 53) % 1920
    const y0 = ((i * 137) % 1080)
    const y = (y0 - f * (0.25 + (i % 5) * 0.08) + 1080 * 4) % 1080
    return { x: x + Math.sin(f / 50 + i) * 6, y, s: 1 + (i % 3) * 0.8, o: 0.12 + (i % 4) * 0.06 }
  })
  return (
    <AbsoluteFill style={{ background: BG }}>
      {lamp && <AbsoluteFill style={{ background: `radial-gradient(1200px 820px at 50% -18%, rgba(200,238,255,${0.16 * breath * intensity}), rgba(140,210,230,${0.05 * breath * intensity}) 40%, transparent 70%)` }} />}
      <AbsoluteFill style={{ background: `radial-gradient(900px 600px at ${12 + Math.sin(f / 200) * 3}% 100%, rgba(45,212,191,${0.12 * intensity}), transparent 62%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(900px 600px at ${88 + Math.cos(f / 240) * 3}% 12%, rgba(14,165,233,${0.1 * intensity}), transparent 62%)` }} />
      {motes.map((m, i) => (
        <div key={i} style={{ position: 'absolute', left: m.x, top: m.y, width: m.s * 2, height: m.s * 2, borderRadius: 99, background: 'rgba(220,240,255,1)', opacity: m.o * intensity }} />
      ))}
      {trace && <Trace y={traceY} amp={70} opacity={0.5 * intensity} />}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)' }} />
    </AbsoluteFill>
  )
}

/* --------------------------------------------------------------------- type */
export const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number; color?: string; size?: number; out?: number }> = ({ children, delay = 0, color = TEAL, size = 18, out }) => (
  <div style={{ ...useRise(delay, 10, out), fontFamily: MONO, fontSize: size, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color, whiteSpace: 'nowrap' }}>{children}</div>
)

export type HeadLine = string | { em: string }
export const Headline: React.FC<{ lines: HeadLine[]; delay?: number; size?: number; align?: 'left' | 'center'; stagger?: number; out?: number; emColor?: string }> = ({
  lines, delay = 0, size = 76, align = 'left', stagger = 8, out, emColor = TEAL,
}) => {
  let wordIndex = 0
  return (
    <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: size, lineHeight: 0.98, letterSpacing: '-0.02em', color: TEXT, textAlign: align }}>
      {lines.map((l, i) => {
        const text = typeof l === 'string' ? l : l.em
        const d = delay + i * stagger + wordIndex * 0
        wordIndex += text.split(' ').length
        return (
          <div key={i} style={{ color: typeof l === 'string' ? TEXT : emColor }}>
            <BlurWords text={text} delay={d} out={out} />
          </div>
        )
      })}
    </div>
  )
}

export const Body: React.FC<{ children: React.ReactNode; delay?: number; size?: number; color?: string; width?: number; out?: number }> = ({ children, delay = 0, size = 26, color = DIM, width = 560, out }) => (
  <div style={{ ...useRise(delay, 14, out), fontFamily: SANS, fontWeight: 300, fontSize: size, lineHeight: 1.4, color, maxWidth: width }}>{children}</div>
)

/* ------------------------------------------------------------------- glass */
export const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), 0 30px 80px -30px rgba(0,0,0,0.8)',
  borderRadius: 26,
  backdropFilter: 'blur(18px)',
}
export const Card: React.FC<{ children: React.ReactNode; delay?: number; pad?: number; width?: number | string; out?: number; style?: React.CSSProperties; glow?: string }> = ({
  children, delay = 0, pad = 30, width, out, style, glow,
}) => (
  <div style={{ ...useRise(delay, 22, out), ...glass, width, padding: pad, ...(glow ? { borderColor: `${glow}88`, boxShadow: `${glass.boxShadow}, 0 0 60px -18px ${glow}` } : {}), ...style }}>{children}</div>
)

const TONES = {
  teal: { fg: TEAL, bg: 'rgba(45,212,191,0.10)' },
  blue: { fg: BLUE, bg: 'rgba(14,165,233,0.10)' },
  surgeon: { fg: SURGEON, bg: 'rgba(96,165,250,0.12)' },
  anesth: { fg: ANESTH, bg: 'rgba(167,139,250,0.12)' },
  nurse: { fg: NURSE, bg: 'rgba(52,211,153,0.12)' },
  bad: { fg: BAD, bg: 'rgba(239,68,68,0.12)' },
  ok: { fg: OK, bg: 'rgba(34,197,94,0.12)' },
  warn: { fg: WARN, bg: 'rgba(245,158,11,0.12)' },
  plain: { fg: 'rgba(255,255,255,0.86)', bg: 'rgba(255,255,255,0.05)' },
} as const
export type Tone = keyof typeof TONES
export const Chip: React.FC<{ children: React.ReactNode; tone?: Tone; delay?: number; size?: number; dot?: boolean; out?: number; mono?: boolean; style?: React.CSSProperties }> = ({
  children, tone = 'plain', delay = 0, size = 20, dot, out, mono, style,
}) => {
  const t = TONES[tone]
  return (
    <span style={{ ...useRise(delay, 10, out), display: 'inline-flex', alignItems: 'center', gap: size * 0.45, fontFamily: mono ? MONO : SANS, fontWeight: 500, fontSize: size, lineHeight: 1,
      color: t.fg, background: t.bg, border: `1px solid ${t.fg}55`, borderRadius: 999, padding: `${size * 0.46}px ${size * 0.8}px`, whiteSpace: 'nowrap', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08)', ...style }}>
      {dot && <span style={{ width: size * 0.42, height: size * 0.42, borderRadius: 99, background: t.fg, boxShadow: `0 0 12px ${t.fg}` }} />}
      {children}
    </span>
  )
}

export const Wordmark: React.FC<{ height?: number; delay?: number }> = ({ height = 120, delay = 0 }) => {
  const f = useCurrentFrame()
  const p = easeInOut(interpolate(f, [delay, delay + 30], [0, 1], CLAMP))
  const w = (height * 1086) / 362
  return (
    <div style={{ width: w, height, opacity: Math.min(1, p * 1.6), filter: `blur(${(1 - p) * 14}px)`, transform: `scale(${0.96 + 0.04 * p})` }}>
      <Img src={staticFile('brand/surgr-header.png')} style={{ width: w, height, display: 'block' }} />
    </div>
  )
}

/** Speech: three arcs that pulse while someone (or Surgr) is talking. */
export const Waves: React.FC<{ color?: string; size?: number; active?: boolean }> = ({ color = TEAL, size = 40, active = true }) => {
  const f = useCurrentFrame()
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      {[0, 1, 2].map((i) => {
        const p = active ? (Math.sin(f / 4 - i * 0.9) + 1) / 2 : 0.2
        return <path key={i} d={`M ${8 + i * 9} ${20 - 6 - i * 4} Q ${14 + i * 9} 20 ${8 + i * 9} ${20 + 6 + i * 4}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.25 + p * 0.75} />
      })}
    </svg>
  )
}

/* ------------------------------------------------------------ browser frame */
export const SRC_W = 1600
export const SRC_H = 900
export type Rect = [number, number, number, number]
export type Focus = { rect: Rect; from: number; to: number; move?: number; maxZoom?: number }
export type Shot = { clip: string; at?: number; startFrom?: number; playbackRate?: number; freezeAt?: number; dissolve?: number }

type Cam = { cx: number; cy: number; z: number }
const FULL: Cam = { cx: SRC_W / 2, cy: SRC_H / 2, z: 1 }
const camFor = (fo: Focus): Cam => {
  const [x, y, w, h] = fo.rect
  const z = Math.max(1, Math.min(fo.maxZoom ?? 2.2, Math.min(SRC_W / w, SRC_H / h)))
  const half = { w: SRC_W / 2 / z, h: SRC_H / 2 / z }
  return { z, cx: Math.min(SRC_W - half.w, Math.max(half.w, x + w / 2)), cy: Math.min(SRC_H - half.h, Math.max(half.h, y + h / 2)) }
}
export const cameraAt = (t: number, focus: Focus[]): Cam => {
  const sorted = [...focus].sort((a, b) => a.from - b.from)
  const open = sorted[0] && sorted[0].from <= 0 ? camFor(sorted[0]) : FULL
  const keys: { t: number; c: Cam }[] = [{ t: 0, c: open }]
  sorted.forEach((fo, i) => {
    const move = fo.move ?? 1.0
    const last = keys[keys.length - 1]
    keys.push({ t: Math.max(fo.from, last.t), c: last.c })
    keys.push({ t: Math.max(fo.from, last.t) + move, c: camFor(fo) })
    keys.push({ t: Math.max(fo.to, fo.from + move), c: camFor(fo) })
    const next = sorted[i + 1]
    if (!next || next.from > fo.to + move) keys.push({ t: fo.to + move, c: FULL })
  })
  for (let i = keys.length - 1; i >= 0; i--) {
    if (t >= keys[i].t) {
      const a = keys[i]
      const b = keys[i + 1]
      if (!b || b.t === a.t) return a.c
      const p = easeInOut(Math.min(1, (t - a.t) / (b.t - a.t)))
      return { cx: a.c.cx + (b.c.cx - a.c.cx) * p, cy: a.c.cy + (b.c.cy - a.c.cy) * p, z: a.c.z + (b.c.z - a.c.z) * p }
    }
  }
  return FULL
}

type Snap = { t: number; [k: string]: unknown }
type ClipInfo = { duration: number; micOffset: number | null; agent: { start: number; end: number; text: string }[]; snaps: Snap[] }
export const clips = clipsJson as unknown as Record<string, ClipInfo>

const ShotVideo: React.FC<{ shot: Shot }> = ({ shot }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rate = shot.playbackRate ?? 1
  const start = shot.startFrom ?? 0
  const length = clips[shot.clip]?.duration ?? 0
  const lastFrame = Math.max(0, Math.floor(((length - start) / rate - 0.2) * fps))
  const freezeFrame = shot.freezeAt !== undefined ? Math.max(0, Math.floor(((shot.freezeAt - start) / rate) * fps)) : Infinity
  return (
    <Freeze frame={Math.min(f, lastFrame, freezeFrame)}>
      <OffthreadVideo src={staticFile(`clips/${shot.clip}.mp4`)} startFrom={Math.round(start * fps)} playbackRate={rate} muted style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
    </Freeze>
  )
}

/** A dark browser window around real footage, with a virtual camera over the 1600x900 page. */
export const BrowserFrame: React.FC<{ shots: Shot[]; width?: number; delay?: number; focus?: Focus[]; title?: string; badge?: React.ReactNode; enter?: boolean; overlay?: React.ReactNode }> = ({
  shots, width = 1180, delay = 0, focus = [], title = 'Surgr · cockpit', badge, enter = true, overlay,
}) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const e = enter ? easeOut(interpolate(f, [delay, delay + 24], [0, 1], CLAMP)) : 1
  const BAR = 46
  const vw = width
  const vh = (width * SRC_H) / SRC_W
  const k = vw / SRC_W
  const cam = cameraAt(f / fps, focus)
  const tx = vw / 2 - cam.cx * k * cam.z
  const ty = vh / 2 - cam.cy * k * cam.z
  const cuts = shots.map((sh) => Math.round((sh.at ?? 0) * fps))
  return (
    <div style={{ width, opacity: e, filter: `blur(${(1 - e) * 10}px)`, transform: `translateY(${(1 - e) * 30}px)`, borderRadius: 20, overflow: 'hidden', background: '#050507',
      border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 60px 140px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(45,212,191,0.06), 0 0 80px -30px rgba(45,212,191,0.35)' }}>
      <div style={{ height: BAR, display: 'flex', alignItems: 'center', padding: '0 18px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 9 }}>{['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 99, background: c, opacity: 0.8 }} />)}</div>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontFamily: SANS, fontWeight: 500, fontSize: 17, color: FAINT, letterSpacing: '0.02em' }}>{title}</div>
        <div style={{ marginLeft: 'auto' }}>{badge}</div>
      </div>
      <div style={{ width: vw, height: vh, position: 'relative', overflow: 'hidden', background: '#000' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: vw, height: vh, transform: `translate(${tx}px, ${ty}px) scale(${cam.z})`, transformOrigin: '0 0' }}>
          {shots.map((sh, i) => {
            const from = cuts[i]
            const fade = i === 0 ? 0 : sh.dissolve ?? 0
            const until = i + 1 < shots.length ? cuts[i + 1] + (shots[i + 1].dissolve ?? 0) : Infinity
            if (f < from || f > until) return null
            const o = fade <= 0 ? 1 : interpolate(f, [from, from + fade], [0, 1], CLAMP)
            return (
              <AbsoluteFill key={`${sh.clip}-${i}`} style={{ opacity: o }}>
                <Sequence from={from} layout="none"><ShotVideo shot={sh} /></Sequence>
              </AbsoluteFill>
            )
          })}
        </div>
        {/* A soft edge so anything the camera crops fades out rather than stopping at a hard line. */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 28px 10px rgba(0,0,0,0.85)' }} />
        {overlay}
      </div>
    </div>
  )
}

export const LiveBadge: React.FC<{ label?: string }> = ({ label = 'Live · real microphone' }) => {
  const f = useCurrentFrame()
  const pulse = (Math.sin(f / 6) + 1) / 2
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#fca5a5' }}>
      <span style={{ width: 9, height: 9, borderRadius: 99, background: BAD, boxShadow: `0 0 ${6 + pulse * 10}px ${BAD}`, opacity: 0.6 + pulse * 0.4 }} />
      {label}
    </span>
  )
}
