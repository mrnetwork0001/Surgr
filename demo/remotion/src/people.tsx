import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { ANESTH, CLAMP, MONO, NURSE, SANS, SURGEON, TEAL, TEXT, Trace, easeOut, glass } from './ui'

/**
 * The people in the room, drawn flat: scrubs, cap and mask in the cockpit's role colours.
 * They breathe, blink, glance, and talk (the mask moves and sound arcs pulse beside them).
 */
export type Role = 'surgeon' | 'anesth' | 'nurse'
const LOOK = {
  surgeon: { accent: SURGEON, scrub: '#1f3a63', scrubLight: '#2d5286', cap: '#3b6fb6', skin: '#c8906a', skinShade: '#ad7654', label: 'Surgeon' },
  anesth: { accent: ANESTH, scrub: '#3a2f66', scrubLight: '#4f4288', cap: '#7c69d6', skin: '#f0c7a8', skinShade: '#d9a888', label: 'Anesthesiologist' },
  nurse: { accent: NURSE, scrub: '#1d5646', scrubLight: '#28715c', cap: '#2f9d7a', skin: '#8a5a3d', skinShade: '#744a31', label: 'Scrub nurse' },
} as const

export const Clinician: React.FC<{
  role: Role; x: number; y: number; scale?: number; delay?: number; talk?: [number, number][]; look?: number; dim?: boolean; label?: boolean; seed?: number
}> = ({ role, x, y, scale = 1, delay = 0, talk = [], look = 0, dim = false, label = true, seed = 0 }) => {
  const f = useCurrentFrame()
  const L = LOOK[role]
  const enter = easeOut(interpolate(f, [delay, delay + 24], [0, 1], CLAMP))
  const breathe = Math.sin((f + seed * 17) / 26) * 2.2
  const talking = talk.some(([a, b]) => f >= a && f <= b)
  const mouth = talking ? (Math.sin(f / 2.2 + seed) + 1) / 2 : 0
  const blinkCycle = (f + seed * 37) % 96
  const blink = blinkCycle < 4 ? 1 - Math.abs(blinkCycle - 2) / 2 : 0
  const gaze = look * 4
  const head = Math.sin((f + seed * 11) / 60) * 1.5 + look * 3
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 300 * scale, height: 380 * scale, opacity: enter * (dim ? 0.45 : 1), filter: `blur(${(1 - enter) * 10}px)${dim ? ' saturate(0.6)' : ''}`, transform: `translateY(${(1 - enter) * 30 + breathe}px)` }}>
      <svg width={300 * scale} height={380 * scale} viewBox="0 0 300 380">
        <defs>
          <radialGradient id={`rim-${role}-${seed}`} cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* shoulders and scrubs */}
        <path d="M30 380 C 34 300, 80 262, 150 258 C 220 262, 266 300, 270 380 Z" fill={L.scrub} />
        <path d="M118 262 L150 318 L182 262 Z" fill={L.scrubLight} />
        <path d="M30 380 C 34 300, 80 262, 150 258 C 220 262, 266 300, 270 380 Z" fill={`url(#rim-${role}-${seed})`} />
        {role === 'nurse' && (
          <g transform="translate(52 300) rotate(8)">
            <rect x="0" y="0" width="54" height="68" rx="6" fill="#0b1417" stroke={NURSE} strokeOpacity="0.7" strokeWidth="2" />
            {[14, 26, 38, 50].map((yy) => <rect key={yy} x="10" y={yy} width={yy === 50 ? 20 : 34} height="4" rx="2" fill={NURSE} opacity="0.55" />)}
          </g>
        )}
        {/* neck */}
        <rect x="128" y="206" width="44" height="60" rx="16" fill={L.skinShade} />
        <g transform={`rotate(${head} 150 160)`}>
          {/* ears */}
          <ellipse cx="86" cy="156" rx="10" ry="16" fill={L.skinShade} />
          <ellipse cx="214" cy="156" rx="10" ry="16" fill={L.skinShade} />
          {/* head */}
          <ellipse cx="150" cy="150" rx="64" ry="74" fill={L.skin} />
          {/* cap */}
          {role === 'nurse' ? (
            <path d="M78 140 C 70 70, 120 44, 150 44 C 196 44, 236 72, 224 140 C 206 118, 176 106, 150 106 C 122 106, 96 118, 78 140 Z" fill={L.cap} />
          ) : (
            <path d="M84 132 C 84 76, 118 56, 150 56 C 186 56, 216 76, 216 132 C 198 116, 176 108, 150 108 C 124 108, 102 116, 84 132 Z" fill={L.cap} />
          )}
          {role === 'surgeon' && (
            <g>
              <rect x="136" y="86" width="28" height="18" rx="6" fill="#dfe8ef" />
              <circle cx="150" cy="95" r="6" fill={TEAL} style={{ filter: `drop-shadow(0 0 6px ${TEAL})` }} />
            </g>
          )}
          {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={108 + i * 21} cy={role === 'nurse' ? 82 : 88} r="3" fill="#ffffff" opacity="0.22" />)}
          {/* eyebrows and eyes */}
          <path d={`M114 ${128 - (talking ? 2 : 0)} Q126 122 138 127`} stroke="#2a1d14" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d={`M162 127 Q174 122 186 ${128 - (talking ? 2 : 0)}`} stroke="#2a1d14" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="126" cy="146" rx="9" ry={7 * (1 - blink) + 0.6} fill="#ffffff" />
          <ellipse cx="174" cy="146" rx="9" ry={7 * (1 - blink) + 0.6} fill="#ffffff" />
          {blink < 0.6 && <circle cx={126 + gaze} cy="147" r="4.2" fill="#1b1410" />}
          {blink < 0.6 && <circle cx={174 + gaze} cy="147" r="4.2" fill="#1b1410" />}
          {/* mask */}
          <path d="M92 150 L 80 156 M208 150 L 220 156" stroke="#dbeaf0" strokeWidth="3" />
          <path d={`M98 166 Q150 152 202 166 L 198 ${206 + mouth * 5} Q150 ${226 + mouth * 9} 102 ${206 + mouth * 5} Z`} fill="#bfe0ec" />
          <path d={`M104 180 Q150 ${172 + mouth * 2} 196 180 M104 192 Q150 ${186 + mouth * 4} 196 192`} stroke="#9cc6d6" strokeWidth="2" fill="none" />
        </g>
      </svg>
      {talking && (
        <div style={{ position: 'absolute', left: 232 * scale, top: 120 * scale, opacity: 0.9 }}>
          <svg width={60 * scale} height={60 * scale} viewBox="0 0 40 40">
            {[0, 1, 2].map((i) => {
              const p = (Math.sin(f / 4 - i * 0.9) + 1) / 2
              return <path key={i} d={`M ${8 + i * 9} ${20 - 6 - i * 4} Q ${14 + i * 9} 20 ${8 + i * 9} ${20 + 6 + i * 4}`} fill="none" stroke={L.accent} strokeWidth={3} strokeLinecap="round" opacity={0.25 + p * 0.75} />
            })}
          </svg>
        </div>
      )}
      {label && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 386 * scale, display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 15 * Math.max(0.9, scale), letterSpacing: '0.18em', textTransform: 'uppercase', color: L.accent }}>{L.label}</span>
        </div>
      )}
    </div>
  )
}

/** A glass speech bubble with a small tail, in the speaker's colour (or red when it is wrong). */
export const Bubble: React.FC<{ x: number; y: number; text: React.ReactNode; role: Role; delay: number; out?: number; wrong?: boolean; width?: number; tail?: 'left' | 'right' }> = ({
  x, y, text, role, delay, out, wrong = false, width = 440, tail = 'left',
}) => {
  const f = useCurrentFrame()
  const pin = easeOut(interpolate(f, [delay, delay + 14], [0, 1], CLAMP))
  const pout = out === undefined ? 0 : interpolate(f, [out, out + 10], [0, 1], CLAMP)
  const color = wrong ? '#ef4444' : LOOK[role].accent
  const shake = wrong && f > delay && f < delay + 18 ? Math.sin(f * 1.7) * 4 * (1 - (f - delay) / 18) : 0
  return (
    <div style={{ position: 'absolute', left: x + shake, top: y, width, opacity: pin * (1 - pout), transform: `translateY(${(1 - pin) * 16}px) scale(${0.94 + 0.06 * pin})`, filter: `blur(${(1 - pin) * 6}px)`, transformOrigin: tail === 'left' ? '10% 100%' : '90% 100%' }}>
      <div style={{ ...glass, borderRadius: 22, padding: '18px 24px', borderColor: `${color}88`, boxShadow: `${glass.boxShadow}, 0 0 50px -16px ${color}`, fontFamily: SANS, fontWeight: 500, fontSize: 30, lineHeight: 1.25, color: TEXT }}>{text}</div>
      <div style={{ position: 'absolute', [tail === 'left' ? 'left' : 'right']: 44, bottom: -12, width: 22, height: 22, background: 'rgba(12,12,14,0.96)', borderRight: `1px solid ${color}88`, borderBottom: `1px solid ${color}88`, transform: 'rotate(45deg)' }} />
    </div>
  )
}

/** A bedside patient monitor with a live trace and vitals. */
export const Monitor: React.FC<{ x: number; y: number; delay?: number; w?: number }> = ({ x, y, delay = 0, w = 360 }) => {
  const f = useCurrentFrame()
  const e = easeOut(interpolate(f, [delay, delay + 20], [0, 1], CLAMP))
  const h = w * 0.62
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, opacity: e, filter: `blur(${(1 - e) * 8}px)`, borderRadius: 18, background: '#05090b', border: '1px solid rgba(45,212,191,0.35)', boxShadow: '0 0 60px -20px rgba(45,212,191,0.5), inset 0 1px 1px rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: w - 96, height: h, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(90deg, #000 80%, transparent)' }}>
        <Trace y={h * 0.5} amp={h * 0.26} width={w - 96} height={h} speed={170} opacity={0.9} />
      </div>
      <div style={{ position: 'absolute', right: 16, top: 12, textAlign: 'right', fontFamily: MONO, color: '#34d399' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.2em', opacity: 0.7 }}>HR</div>
        <div style={{ fontSize: 34, lineHeight: 1 }}>72</div>
      </div>
      <div style={{ position: 'absolute', right: 16, bottom: 12, textAlign: 'right', fontFamily: MONO, color: '#38bdf8' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.2em', opacity: 0.7 }}>SpO₂</div>
        <div style={{ fontSize: 28, lineHeight: 1 }}>98</div>
      </div>
    </div>
  )
}

/** The operating table from the side: a drape over the patient, the lamp's pool of light. */
export const Table: React.FC<{ x: number; y: number; w?: number; delay?: number }> = ({ x, y, w = 1100, delay = 0 }) => {
  const f = useCurrentFrame()
  const e = easeOut(interpolate(f, [delay, delay + 24], [0, 1], CLAMP))
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: 200, opacity: e }}>
      <div style={{ position: 'absolute', left: w * 0.1, right: w * 0.1, top: -120, height: 180, background: 'radial-gradient(ellipse at 50% 100%, rgba(200,238,255,0.18), transparent 70%)' }} />
      <svg width={w} height={200} viewBox={`0 0 ${w} 200`}>
        <rect x={40} y={70} width={w - 80} height={34} rx={14} fill="#1b2a33" />
        <rect x={w / 2 - 30} y={104} width={60} height={96} fill="#11191e" />
        <ellipse cx={120} cy={56} rx={44} ry={30} fill="#c8906a" opacity="0.85" />
        <path d={`M150 70 C 260 20, ${w - 260} 20, ${w - 70} 64 L ${w - 70} 76 L 150 76 Z`} fill="#2a6f8a" />
        <path d={`M150 70 C 260 20, ${w - 260} 20, ${w - 70} 64`} stroke="#5eb6d1" strokeOpacity="0.5" strokeWidth="2" fill="none" />
      </svg>
      <span style={{ display: 'none' }}>{f}</span>
    </div>
  )
}
