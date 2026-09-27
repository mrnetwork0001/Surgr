"use client";
import { useEffect, useRef } from "react";

type Variant = "hero" | "capabilities" | "cockpit";

interface Props {
  variant?: Variant;
  /** 0..1 multiplier on light and trace brightness. */
  intensity?: number;
  /** Optional still image (already known to exist) drawn beneath the animation with a slow Ken Burns drift. */
  image?: string;
}

interface Bloom {
  x: number;
  y: number;
  r: number;
  c: string;
  a: number;
}

interface VariantConfig {
  lamp: boolean;
  motes: number;
  sweep: number;
  ecgY: number;
  ecgAmp: number;
  pleth: boolean;
  plethY: number;
  plethAmp: number;
  blooms: Bloom[];
  imageDim: number;
  vignette: number;
}

const VARIANTS: Record<Variant, VariantConfig> = {
  hero: {
    lamp: true,
    motes: 70,
    sweep: 220,
    ecgY: 0.8,
    ecgAmp: 0.055,
    pleth: true,
    plethY: 0.905,
    plethAmp: 0.03,
    blooms: [
      { x: 0.12, y: 0.88, r: 0.6, c: "45,212,191", a: 0.14 },
      { x: 0.9, y: 0.72, r: 0.55, c: "14,165,233", a: 0.12 },
    ],
    imageDim: 0.5,
    vignette: 0.85,
  },
  capabilities: {
    lamp: false,
    motes: 36,
    sweep: 200,
    ecgY: 0.445,
    ecgAmp: 0.045,
    pleth: false,
    plethY: 0.5,
    plethAmp: 0.03,
    blooms: [
      { x: 0.85, y: 0.25, r: 0.6, c: "14,165,233", a: 0.14 },
      { x: 0.25, y: 0.95, r: 0.55, c: "45,212,191", a: 0.12 },
      { x: 0.6, y: 0.6, r: 0.5, c: "79,70,229", a: 0.08 },
    ],
    imageDim: 0.58,
    vignette: 0.85,
  },
  cockpit: {
    lamp: false,
    motes: 0,
    sweep: 150,
    ecgY: 0.94,
    ecgAmp: 0.035,
    pleth: false,
    plethY: 0.97,
    plethAmp: 0.02,
    blooms: [
      { x: 0.15, y: 0.3, r: 0.6, c: "45,212,191", a: 0.1 },
      { x: 0.85, y: 0.2, r: 0.55, c: "14,165,233", a: 0.09 },
    ],
    imageDim: 0.7,
    vignette: 0.7,
  },
};

/** One heartbeat, phase 0..1, amplitude in R-wave units. */
function ecgShape(p: number): number {
  if (p < 0.1) return 0;
  if (p < 0.18) return 0.12 * Math.sin(((p - 0.1) / 0.08) * Math.PI);
  if (p < 0.24) return 0;
  if (p < 0.26) return -0.12 * ((p - 0.24) / 0.02);
  if (p < 0.3) return -0.12 + 1.12 * ((p - 0.26) / 0.04);
  if (p < 0.34) return 1 - 1.3 * ((p - 0.3) / 0.04);
  if (p < 0.37) return -0.3 + 0.3 * ((p - 0.34) / 0.03);
  if (p < 0.45) return 0;
  if (p < 0.62) return 0.28 * Math.sin(((p - 0.45) / 0.17) * Math.PI);
  return 0;
}

/** Pulse-oximeter plethysmogram, phase 0..1. */
function plethShape(p: number): number {
  const a = Math.exp(-((p - 0.2) ** 2) / 0.006);
  const b = 0.45 * Math.exp(-((p - 0.42) ** 2) / 0.012);
  return (a + b) * 0.9;
}

/**
 * Operating-room ambience drawn on a canvas: an overhead surgical lamp that breathes,
 * dust motes drifting through its cone, and monitor-style sweeping ECG and SpO2 traces.
 * Pauses when scrolled out of view and renders a single frame under prefers-reduced-motion.
 */
export default function ORBackdrop({ variant = "hero", intensity = 1, image }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef(!!image);

  useEffect(() => {
    imageRef.current = !!image;
  }, [image]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cfg = VARIANTS[variant];
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    let ecgBuf = new Float32Array(0);
    let plethBuf = new Float32Array(0);
    let cursor = 0;
    let phase = 0;
    let lastT = 0;

    const motes = Array.from({ length: cfg.motes }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.8,
      v: 6 + Math.random() * 14,
      sway: Math.random() * Math.PI * 2,
      a: 0.25 + Math.random() * 0.5,
    }));

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.max(2, Math.ceil(w));
      ecgBuf = new Float32Array(cols).fill(NaN);
      plethBuf = new Float32Array(cols).fill(NaN);
      cursor = 0;
    };
    resize();
    window.addEventListener("resize", resize);

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);

    const drawTrace = (buf: Float32Array, baseY: number, amp: number, rgb: string, cur: number, gap: number, lw: number) => {
      const seg = (from: number, to: number, alpha: number, glow: boolean) => {
        if (to - from < 2) return;
        ctx.lineWidth = lw;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.strokeStyle = `rgba(${rgb},${alpha})`;
        ctx.shadowBlur = glow ? 14 : 0;
        ctx.shadowColor = `rgba(${rgb},${alpha})`;
        ctx.beginPath();
        let started = false;
        for (let x = from; x < to; x++) {
          const v = buf[x];
          if (Number.isNaN(v)) {
            started = false;
            continue;
          }
          const y = baseY - v * amp;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      };
      const tail = 160;
      const dim = 0.26 * intensity;
      if (cur - tail > 0) seg(0, cur - tail, dim, false);
      seg(Math.min(buf.length, cur + gap), buf.length, dim, false);
      seg(Math.max(0, cur - tail), cur, 0.9 * intensity, true);
      const v = buf[(cur - 1 + buf.length) % buf.length];
      if (!Number.isNaN(v)) {
        ctx.fillStyle = `rgba(${rgb},${0.95 * intensity})`;
        ctx.shadowBlur = 18;
        ctx.shadowColor = `rgba(${rgb},0.9)`;
        ctx.beginPath();
        ctx.arc(cur - 1, baseY - v * amp, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    const draw = (t: number, dt: number) => {
      ctx.globalCompositeOperation = "source-over";
      if (imageRef.current) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = `rgba(0,0,0,${cfg.imageDim})`;
        ctx.fillRect(0, 0, w, h);
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#04080d");
        g.addColorStop(0.55, "#010305");
        g.addColorStop(1, "#000");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      const breath = 0.85 + 0.15 * Math.sin(t * 0.0006);
      ctx.globalCompositeOperation = "lighter";
      if (cfg.lamp) {
        const lx = w * 0.5;
        const ly = -h * 0.18;
        const lr = h * 1.15;
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
        g.addColorStop(0, `rgba(200,238,255,${0.24 * breath * intensity})`);
        g.addColorStop(0.3, `rgba(140,210,230,${0.1 * breath * intensity})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      for (const b of cfg.blooms) {
        const bx = (b.x + Math.sin(t * 0.00015 + b.x * 7) * 0.03) * w;
        const by = (b.y + Math.cos(t * 0.00012 + b.y * 5) * 0.03) * h;
        const r = b.r * Math.max(w, h) * 0.5;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        g.addColorStop(0, `rgba(${b.c},${b.a * intensity})`);
        g.addColorStop(0.5, `rgba(${b.c},${b.a * 0.35 * intensity})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(bx - r, by - r, r * 2, r * 2);
      }

      ctx.globalCompositeOperation = "source-over";
      for (const m of motes) {
        m.y -= (m.v * dt) / 1000 / h;
        m.x += Math.sin(t * 0.0004 + m.sway) * 0.00006;
        if (m.y < -0.02) {
          m.y = 1.02;
          m.x = Math.random();
        }
        const px = m.x * w;
        const py = m.y * h;
        const dist = Math.hypot(px - w * 0.5, py + h * 0.18) / (h * 1.1);
        const light = cfg.lamp ? Math.max(0, 1 - dist) : 0.5;
        ctx.fillStyle = `rgba(220,240,255,${m.a * light * 0.7 * intensity})`;
        ctx.beginPath();
        ctx.arc(px, py, m.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const cols = Math.max(1, Math.round((cfg.sweep * dt) / 1000));
      for (let i = 0; i < cols; i++) {
        phase += dt / cols / 833;
        const p = phase % 1;
        const c = cursor % ecgBuf.length;
        ecgBuf[c] = ecgShape(p);
        plethBuf[c] = plethShape((p + 0.22) % 1);
        cursor++;
      }
      const cur = cursor % ecgBuf.length;
      drawTrace(ecgBuf, cfg.ecgY * h, cfg.ecgAmp * h, "45,212,191", cur, 48, 1.6);
      if (cfg.pleth) drawTrace(plethBuf, cfg.plethY * h, cfg.plethAmp * h, "96,165,250", cur, 48, 1.2);

      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, `rgba(0,0,0,${cfg.vignette})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    };

    const frame = (t: number) => {
      const dt = lastT ? Math.min(50, t - lastT) : 16;
      lastT = t;
      if (visible) draw(t, dt);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [variant, intensity]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black" aria-hidden>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="kenburns absolute inset-0 h-full w-full object-cover" />
      )}
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}
