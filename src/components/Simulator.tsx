"use client";
import { useState } from "react";
import type { SimStatus } from "@/hooks/useSurgr";
import { SCENARIOS, SIM_SPEAKERS, type SimSpeaker } from "@/lib/scenarios";

interface Props {
  sim: SimStatus;
  speed: number;
  onSpeed: (s: number) => void;
  onPlay: (id: string) => void;
  onStop: () => void;
  onInject: (speaker: SimSpeaker, text: string) => void;
}

export default function Simulator({ sim, speed, onSpeed, onPlay, onStop, onInject }: Props) {
  const [speaker, setSpeaker] = useState<SimSpeaker>("S1");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(true);
  const active = sim.scenarioId ? SCENARIOS.find((s) => s.id === sim.scenarioId) : undefined;

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onInject(speaker, t);
    setText("");
  };

  return (
    <footer className={`simulator ${open ? "" : "simulator-collapsed"}`}>
      <div className="sim-head">
        <button className="btn btn-ghost btn-small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "▾" : "▴"} OR audio simulator
        </button>
        <span className="muted">Play scripted OR conversations through the same pipeline as the live microphone.</span>
        <div className="sim-speed">
          <span className="muted">Speed</span>
          {[1, 2, 4].map((s) => (
            <button key={s} className={`btn btn-small ${speed === s ? "btn-primary" : "btn-ghost"}`} onClick={() => onSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </div>
      {open && (
        <div className="sim-body">
          <div className="scenarios">
            {SCENARIOS.map((s) => {
              const isActive = sim.scenarioId === s.id;
              return (
                <button
                  key={s.id}
                  className={`scenario ${isActive ? "scenario-active" : ""}`}
                  onClick={() => (isActive && sim.playing ? onStop() : onPlay(s.id))}
                  title={s.description}
                >
                  <span className="scenario-name">{isActive && sim.playing ? "■ " : "▶ "}{s.name}</span>
                  <span className="scenario-desc">{s.description}</span>
                </button>
              );
            })}
          </div>
          <div className="sim-side">
            {active ? (
              <div className="sim-now">
                <div className="sim-now-title">
                  {active.name} {sim.playing ? `· line ${sim.lineIndex + 2 > active.lines.length ? active.lines.length : sim.lineIndex + 2} of ${active.lines.length}` : "· finished"}
                </div>
                <div className="muted">Expected: {active.expected}</div>
              </div>
            ) : (
              <div className="sim-now muted">Pick a scenario, or type a line as any team member.</div>
            )}
            <div className="inject">
              <select value={speaker} onChange={(e) => setSpeaker(e.target.value as SimSpeaker)} aria-label="Speaker">
                {(Object.keys(SIM_SPEAKERS) as SimSpeaker[]).map((k) => (
                  <option key={k} value={k}>
                    {SIM_SPEAKERS[k].name} · {SIM_SPEAKERS[k].role}
                  </option>
                ))}
              </select>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="e.g. Give 100 micrograms of fentanyl IV"
                aria-label="Line to inject"
              />
              <button className="btn btn-primary btn-small" onClick={submit} disabled={!text.trim()}>
                Say it
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
