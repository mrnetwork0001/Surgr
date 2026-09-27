"use client";
import Link from "next/link";
import { useNow } from "@/hooks/useNow";
import type { Surgr } from "@/hooks/useSurgr";
import { formatMs } from "@/lib/report";

const STT_LABEL: Record<string, string> = {
  idle: "Mic off",
  connecting: "Connecting…",
  listening: "Listening",
  closed: "Stopped",
  error: "Error",
};

const VOICE_LABEL: Record<string, string> = {
  idle: "Standby",
  connecting: "Connecting…",
  ready: "Ready",
  speaking: "Speaking",
  fallback: "Browser TTS",
  error: "Error",
};

export default function Header({ surgr }: { surgr: Surgr }) {
  const now = useNow(1000);
  const { state, stt, voice } = surgr;
  const elapsed = state.sessionStartedAt && now ? now - state.sessionStartedAt : 0;
  const live = stt.status === "listening" || stt.status === "connecting";

  return (
    <header className="header">
      <Link href="/" className="brand" title="Back to the Surgr home page">
        <div className="brand-mark" aria-hidden>
          <span className="brand-glyph">S</span>
        </div>
        <div>
          <div className="brand-name">Surgr</div>
          <div className="brand-tag">Operating room closed-loop safety copilot</div>
        </div>
      </Link>

      <div className="status-row" role="status">
        <Pill
          tone={surgr.hasKey === null ? "muted" : surgr.hasKey ? "ok" : "warn"}
          label="AssemblyAI"
          value={surgr.hasKey === null ? "checking…" : surgr.hasKey ? "key detected" : "no key"}
          title={surgr.hasKey ? "ASSEMBLYAI_API_KEY found in .env.local" : "Add ASSEMBLYAI_API_KEY to .env.local and restart the dev server"}
        />
        <Pill
          tone={stt.status === "listening" ? "ok" : stt.status === "error" ? "danger" : "muted"}
          label="Streaming STT"
          value={STT_LABEL[stt.status] ?? stt.status}
          title={stt.error ?? "universal-3-6-pro · medical mode · speaker labels"}
        />
        <Pill
          tone={!surgr.voiceEnabled ? "muted" : voice.status === "speaking" ? "danger" : voice.status === "ready" ? "ok" : voice.status === "error" ? "warn" : "muted"}
          label="Voice agent"
          value={surgr.voiceEnabled ? (VOICE_LABEL[voice.status] ?? voice.status) : "Muted"}
          title={voice.error ?? voice.lastSpoken ?? "AssemblyAI Voice Agent API"}
        />
        <Pill
          tone={surgr.llmEnabled && surgr.hasKey ? (surgr.llmRateLimited ? "warn" : surgr.llmInFlight > 0 ? "accent" : "ok") : "muted"}
          label="LLM Gateway"
          value={!surgr.llmEnabled ? "Off" : !surgr.hasKey ? "Rules only" : surgr.llmRateLimited ? "Rate limited" : surgr.llmInFlight > 0 ? "Thinking…" : surgr.llmModel ? shortModel(surgr.llmModel) : "Ready"}
          title={`Ambiguous utterances are classified via the AssemblyAI LLM Gateway${surgr.llmModel ? ` (${surgr.llmModel})` : ""}`}
        />
        <div className="timer" title="Session time">
          <span className={`dot ${live ? "dot-live" : ""}`} />
          {formatMs(elapsed)}
        </div>
      </div>

      <div className="controls">
        <label className="toggle" title="Speak alerts into the room">
          <input type="checkbox" checked={surgr.voiceEnabled} onChange={(e) => surgr.setVoiceEnabled(e.target.checked)} />
          <span>Voice</span>
        </label>
        <label className="toggle" title="Use Claude via LLM Gateway for ambiguous turns">
          <input type="checkbox" checked={surgr.llmEnabled} onChange={(e) => surgr.setLlmEnabled(e.target.checked)} />
          <span>LLM</span>
        </label>
        {live ? (
          <button className="btn btn-danger" onClick={surgr.stopLive}>
            Stop mic
          </button>
        ) : (
          <button className="btn btn-primary" onClick={surgr.startLive} disabled={surgr.hasKey === false} title={surgr.hasKey === false ? "Add your AssemblyAI key first" : "Stream the room microphone to AssemblyAI"}>
            Start live session
          </button>
        )}
        <button className="btn" onClick={surgr.generateReport} disabled={surgr.reportLoading || state.turns.length === 0}>
          {surgr.reportLoading ? "Generating…" : "Export EHR report"}
        </button>
        <button className="btn btn-ghost" onClick={surgr.reset} title="Clear the session">
          Reset
        </button>
      </div>
    </header>
  );
}

function Pill({ tone, label, value, title }: { tone: "ok" | "warn" | "danger" | "muted" | "accent"; label: string; value: string; title?: string }) {
  return (
    <div className={`pill pill-${tone}`} title={title}>
      <span className="pill-label">{label}</span>
      <span className="pill-value">{value}</span>
    </div>
  );
}

function shortModel(id: string): string {
  const m = id.match(/^(claude-(?:haiku|sonnet|opus)-\d+(?:-\d+)?)|^(qwen[\d.]+-\d+b)|^(gemini-[\d.]+-\w+)|^(gpt-[\w.]+)/i);
  const hit = m?.slice(1).find(Boolean);
  return (hit ?? id).replace(/-/g, " ");
}
