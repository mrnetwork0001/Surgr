"use client";
import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { SCENARIOS } from "@/lib/scenarios";
import { ArrowUpRight } from "./Icons";
import LoopDemo from "./LoopDemo";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export const GITHUB_URL = "https://github.com/mrnetwork0001/Surgr";
export const HACKATHON_URL = "https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon";

const glow = (pos: string, rgb: string) => ({ backgroundImage: `radial-gradient(900px 480px at ${pos}, rgba(${rgb},0.12), transparent 62%)` });

const shell = "relative overflow-hidden bg-black px-8 py-24 md:px-16 lg:px-20";

/* ---------------- Problem ---------------- */

const STATS = [
  { value: "1 in 20", label: "perioperative medication administrations involve an error or adverse drug event", source: "Nanji et al., Anesthesiology, 2016" },
  { value: "11% → 7%", label: "major complications after adopting the WHO Surgical Safety Checklist; deaths fell from 1.5% to 0.8%", source: "Haynes et al., NEJM, 2009" },
  { value: "~2 in 3", label: "sentinel events involve a breakdown in team communication", source: "The Joint Commission" },
  { value: "310M+", label: "major operations are performed worldwide every year", source: "Weiser et al., 2016" },
];

export function Problem() {
  return (
    <section id="problem" className={shell}>
      <div className="pointer-events-none absolute inset-0" style={glow("15% 0%", "45,212,191")} />
      <div className="relative">
        <SectionHeading
          label="Why it matters"
          title="The loop breaks quietly"
          lead="Closed-loop communication is the standard: an order is spoken, repeated back, and confirmed. In a busy room the repeat is skipped, a dose is misheard, a checklist item is assumed. Nothing beeps. Surgr is the thing that notices."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.value} delay={i * 0.08}>
              <div className="liquid-glass flex h-full flex-col rounded-[1.25rem] p-6">
                <div className="font-heading text-5xl italic leading-none tracking-[-1px] text-white">{s.value}</div>
                <p className="mt-4 font-body text-sm font-light leading-snug text-white/85">{s.label}</p>
                <div className="mt-auto pt-4 font-body text-[11px] text-white/50">{s.source}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- How it works ---------------- */

const STEPS = [
  { n: "01", title: "Listen", body: "Room audio streams to AssemblyAI at 16 kHz. Medical mode gets drug names and doses right; speaker labels tell surgeon, anesthesiologist and nurse apart on one microphone." },
  { n: "02", title: "Understand", body: "A deterministic classifier parses orders, read-backs and checklist statements in under a millisecond. Utterances it cannot settle go to the LLM Gateway under a strict JSON schema." },
  { n: "03", title: "Intervene", body: "Every order gets ten seconds to be read back. Wrong dose, wrong drug, wrong route or silence, and Surgr speaks the alert into the room through the Voice Agent API." },
  { n: "04", title: "Document", body: "An operative communication record where every medication, checklist item and safety event links to the exact second in the audio, with JSON export and a print view." },
];

const FLOW = ["Room mic", "Streaming STT", "Rules + LLM Gateway", "Read-back state machine", "Voice Agent · EHR record"];

export function HowItWorks() {
  return (
    <section id="how" className={shell}>
      <div className="pointer-events-none absolute inset-0" style={glow("85% 10%", "14,165,233")} />
      <div className="relative">
        <SectionHeading label="How it works" title="Listen, understand, intervene, document" maxWidth="max-w-[16ch]" />
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="liquid-glass flex h-full flex-col rounded-[1.25rem] p-6">
                  <div className="font-mono text-[11px] tracking-[0.2em] text-teal-300">{s.n}</div>
                  <h3 className="mt-4 font-heading text-3xl italic leading-none tracking-[-1px] text-white">{s.title}</h3>
                  <p className="mt-3 font-body text-sm font-light leading-snug text-white/85">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.15}>
            <div className="mb-3 font-body text-[11px] uppercase tracking-[0.12em] text-white/60">Watch the loop close</div>
            <LoopDemo />
          </Reveal>
        </div>
        <Reveal className="mt-10 flex flex-wrap items-center gap-2 font-mono text-[12px] text-white/70" delay={0.1}>
          {FLOW.map((f, i) => (
            <span key={f} className="flex items-center gap-2">
              <span className="liquid-glass rounded-full px-3 py-1 text-white/90">{f}</span>
              {i < FLOW.length - 1 && <span className="text-white/40">→</span>}
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Product ---------------- */

const CALLOUTS = [
  { title: "Transcript by role", body: "Surgeon, anesthesiologist and nurse in their own colours, every order and read-back tagged as it lands." },
  { title: "Order board", body: "A ten-second countdown per order. A mismatch goes red and stays red until a correct read-back arrives." },
  { title: "Checklist that ticks itself", body: "Sign In, Time Out and Sign Out complete from speech; a phase that ends with gaps raises a spoken alert." },
];

export function Product() {
  return (
    <section id="product" className={shell}>
      <div className="pointer-events-none absolute inset-0" style={glow("50% 100%", "45,212,191")} />
      <div className="relative">
        <SectionHeading
          label="The cockpit"
          title="One screen for the whole room. Nobody has to look at it."
          maxWidth="max-w-[22ch]"
          lead="The display exists for the circulating nurse, the debrief and the audit. The alerts are spoken. The record writes itself."
        />
        <Reveal>
          <div className="liquid-glass rounded-[1.5rem] p-2">
            <Image
              src="/screenshots/cockpit-v2.png"
              alt="Surgr cockpit with a live transcript by role, a fentanyl order flagged as a dose mismatch, and the WHO checklist"
              width={1600}
              height={1000}
              className="block h-auto w-full rounded-[1.1rem]"
            />
          </div>
        </Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {CALLOUTS.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <div className="border-l border-white/20 pl-4">
                <div className="font-heading text-2xl italic text-white">{c.title}</div>
                <p className="mt-2 font-body text-sm font-light leading-snug text-white/80">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10" delay={0.1}>
          <Link href="/app" className="liquid-glass-strong inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-body text-sm font-medium text-white transition-transform hover:scale-[1.03] active:scale-[0.97]">
            Open the cockpit <ArrowUpRight width={16} height={16} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Stack ---------------- */

const STACK = [
  { name: "Streaming STT v3", tag: "universal-3-6-pro · medical-v1", body: "Sub-second transcripts from the room microphone. Medical mode formats drug names and doses; keyterms boost 48 operating-room drugs and checklist phrases." },
  { name: "Speaker labels", tag: "true diarization", body: "One microphone, three roles. Speaker embeddings separate the team in real time, so a read-back from the wrong person is caught." },
  { name: "LLM Gateway", tag: "JSON-schema outputs", body: "Structured classification for the utterances rules cannot settle, and the narrative sections of the operative record. Rate budget tracked from the gateway's headers." },
  { name: "Voice Agent API", tag: "reply.create", body: "Surgr's voice in the room. Alerts are spoken verbatim through a persistent agent session, with browser speech as a fallback." },
];

export function Stack() {
  return (
    <section id="stack" className={shell}>
      <div className="pointer-events-none absolute inset-0" style={glow("10% 90%", "79,70,229")} />
      <div className="relative">
        <SectionHeading
          label="Built on AssemblyAI"
          title="Four products, one safety loop"
          lead="Every integration was verified against the live services: a streaming session with medical mode and speaker labels, a Voice Agent reply spoken verbatim, and JSON-schema outputs from the LLM Gateway."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STACK.map((s, i) => (
            <Reveal key={s.name} delay={i * 0.08}>
              <div className="liquid-glass flex h-full flex-col rounded-[1.25rem] p-6">
                <div className="font-heading text-3xl italic leading-none tracking-[-1px] text-white">{s.name}</div>
                <div className="mt-2 font-mono text-[11px] text-teal-300">{s.tag}</div>
                <p className="mt-4 font-body text-sm font-light leading-snug text-white/85">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Scenarios ---------------- */

export function Scenarios() {
  return (
    <section id="scenarios" className={shell}>
      <div className="pointer-events-none absolute inset-0" style={glow("90% 0%", "45,212,191")} />
      <div className="relative">
        <SectionHeading
          label="Try it"
          title="Nine ways to break the loop"
          lead="The simulator plays scripted operating-room conversations through the same pipeline as the live microphone, so you can trigger a wrong dose without an operating room. Turn your sound on."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s, i) => (
            <Reveal key={s.id} delay={(i % 3) * 0.06}>
              <div className="liquid-glass flex h-full flex-col rounded-[1.25rem] p-5">
                <div className="font-heading text-2xl italic text-white">{s.name}</div>
                <p className="mt-2 font-body text-sm font-light leading-snug text-white/80">{s.description}</p>
                <div className="mt-auto pt-4 font-body text-xs text-teal-200/90">
                  <span className="text-white/50">Expect: </span>
                  {s.expected}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 flex flex-wrap items-center gap-6" delay={0.1}>
          <Link href="/app" className="flex items-center gap-2 rounded-full bg-white px-6 py-3 font-body text-sm font-medium text-black transition-transform hover:scale-[1.03] active:scale-[0.97]">
            Launch app <ArrowUpRight width={16} height={16} />
          </Link>
          <span className="font-body text-sm text-white/60">Or start a live session in Chrome and say “give fifty milligrams of propofol”.</span>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

const FAQ = [
  {
    q: "Is Surgr a medical device?",
    a: "No. It is a hackathon prototype built to show what real-time closed-loop verification can look like. It is not cleared for clinical use and does not replace clinical judgement or institutional protocols.",
  },
  {
    q: "What is real and what is simulated?",
    a: "Every AssemblyAI integration is live: streaming transcription with medical mode and speaker labels, the LLM Gateway, and the Voice Agent that speaks the alerts. The simulator injects scripted text into the same pipeline so a wrong dose can be triggered without an operating room, and the demo above runs the real engine in your browser.",
  },
  {
    q: "Does it work without an API key?",
    a: "The simulator, the rule-based read-back engine, the checklist and the local report all run without any cloud call, and the voice falls back to the browser's speech synthesis. The live microphone, spoken alerts through the Voice Agent and the LLM narrative need a key, which stays on the server.",
  },
  {
    q: "How quickly does an alert fire?",
    a: "The rule classifier decides in under a millisecond. A mismatched read-back is spoken within about a second; an unanswered order is called out after the ten-second read-back window.",
  },
  {
    q: "Where does the audio go?",
    a: "The browser streams directly to AssemblyAI using a short-lived token minted by the server; the API key never reaches the page. Streaming PII redaction can be enabled for the exported record.",
  },
  {
    q: "Why is the LLM used so sparingly?",
    a: "Hackathon accounts get two gateway requests per minute. The deterministic classifier does the real-time work, and the LLM is reserved for drug-related utterances the rules cannot resolve and for the end-of-case narrative. Rate limits are read from the gateway's headers and honoured automatically.",
  },
];

export function Faq() {
  return (
    <section id="faq" className={shell}>
      <div className="pointer-events-none absolute inset-0" style={glow("30% 100%", "14,165,233")} />
      <div className="relative">
        <SectionHeading label="Details" title="Straight answers" />
        <div className="grid gap-4 md:grid-cols-2">
          {FAQ.map((f, i) => (
            <Reveal key={f.q} delay={(i % 2) * 0.08}>
              <div className="liquid-glass h-full rounded-[1.25rem] p-6">
                <div className="font-heading text-2xl italic leading-tight text-white">{f.q}</div>
                <p className="mt-3 font-body text-sm font-light leading-snug text-white/85">{f.a}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

const ON_THIS_PAGE = [
  { label: "Capabilities", href: "#capabilities" },
  { label: "How it works", href: "#how" },
  { label: "The cockpit", href: "#product" },
  { label: "Built on AssemblyAI", href: "#stack" },
  { label: "Scenarios", href: "#scenarios" },
  { label: "Details", href: "#faq" },
];

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
      {children}
      <ArrowUpRight width={12} height={12} className="text-white/50" />
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/10 bg-black px-8 pb-16 pt-16 md:px-16 lg:px-20">
      <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr] lg:gap-16">
        <div>
          <Link href="/" aria-label="Surgr home" className="inline-flex">
            <Image src="/brand/surgr-header.png" alt="Surgr" width={1086} height={362} className="h-14 w-auto" />
          </Link>
          <p className="mt-6 max-w-md font-body text-base font-light leading-relaxed text-white/75">
            A closed-loop safety layer for the operating room. Every verbal drug order is checked against its read-back, the WHO checklist ticks itself from speech, and Surgr speaks up the moment a loop does not close, then writes the audit record.
          </p>
        </div>

        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/50">On this page</div>
          <ul className="mt-6 space-y-4 font-body text-base text-white/85">
            {ON_THIS_PAGE.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="transition-colors hover:text-white">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/50">Surgr</div>
          <ul className="mt-6 space-y-4 font-body text-base text-white/85">
            <li>
              <Link href="/app" className="transition-colors hover:text-white">
                Launch app
              </Link>
            </li>
            <li>
              <ExternalLink href={GITHUB_URL}>Source on GitHub</ExternalLink>
            </li>
            <li>
              <ExternalLink href={HACKATHON_URL}>Voice Agent Hackathon</ExternalLink>
            </li>
            <li>
              <ExternalLink href="https://www.assemblyai.com">AssemblyAI</ExternalLink>
            </li>
          </ul>
        </div>
      </div>

    </footer>
  );
}
