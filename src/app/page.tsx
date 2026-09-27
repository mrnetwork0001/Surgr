import Image from "next/image";
import Link from "next/link";
import LandingDemo from "@/components/landing/LandingDemo";
import styles from "./landing.module.css";

const GITHUB_URL = "https://github.com/mrnetwork0001/surgr";

const STATS = [
  {
    value: "1 in 20",
    label: "perioperative medication administrations involve an error or adverse drug event",
    source: "Nanji et al., Anesthesiology, 2016",
  },
  {
    value: "11% → 7%",
    label: "major complications after adopting the WHO Surgical Safety Checklist; deaths fell from 1.5% to 0.8%",
    source: "Haynes et al., NEJM, 2009",
  },
  {
    value: "~2 in 3",
    label: "sentinel events involve a breakdown in team communication",
    source: "The Joint Commission",
  },
  {
    value: "310M+",
    label: "major operations are performed worldwide every year",
    source: "Weiser et al., 2016",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Listen",
    body: "Room audio streams to AssemblyAI at 16 kHz. Medical mode gets drug names and doses right, and speaker labels tell the surgeon, anesthesiologist and nurse apart on a single microphone.",
  },
  {
    n: "02",
    title: "Understand",
    body: "A deterministic classifier parses orders, read-backs and checklist statements in under a millisecond. Utterances it cannot settle go to the LLM Gateway under a strict JSON schema.",
  },
  {
    n: "03",
    title: "Intervene",
    body: "Every order gets ten seconds to be read back. Wrong dose, wrong drug, wrong route or silence, and Surgr speaks the alert into the room through the Voice Agent API.",
  },
  {
    n: "04",
    title: "Document",
    body: "An operative communication record where every medication, checklist item and safety event links to the exact second in the audio. JSON export and print view included.",
  },
];

const FEATURES = [
  {
    title: "Closed-loop verification",
    body: "Drug, dose, unit and route are compared, not just keywords. 0.1 mg and 100 mcg are the same dose; rocuronium and succinylcholine are not.",
  },
  {
    title: "Self-read-back detection",
    body: "A confirmation has to come from the person giving the drug, not the person who ordered it. Surgr knows who is speaking.",
  },
  {
    title: "WHO checklist, hands-free",
    body: "21 items across Sign In, Time Out and Sign Out are ticked from speech. An incision called without a Time Out is a critical alert.",
  },
  {
    title: "Spoken alerts, not dashboards",
    body: "Nobody in an operating room is watching a screen. Alerts are spoken word for word within a second, then logged.",
  },
  {
    title: "Audit-ready record",
    body: "Closed-loop rate, mean read-back latency, missed checklist items and safety events, each row linked back to its audio timestamp.",
  },
  {
    title: "Degrades gracefully",
    body: "The rules engine and the simulator run without a single cloud call. LLM budget is tracked and never blocks the safety loop.",
  },
];

const STACK = [
  {
    name: "Streaming STT v3",
    tag: "universal-3-6-pro · medical-v1",
    body: "Sub-second transcripts from the room microphone. Medical mode formats drug names and doses; keyterms boost 48 operating room drugs and checklist phrases.",
  },
  {
    name: "Speaker labels",
    tag: "true diarization",
    body: "One microphone, three roles. Speaker embeddings separate the team in real time, so a read-back from the wrong person is caught.",
  },
  {
    name: "LLM Gateway",
    tag: "JSON-schema outputs",
    body: "Structured classification for the utterances rules cannot settle, and the narrative sections of the operative record.",
  },
  {
    name: "Voice Agent API",
    tag: "reply.create",
    body: "Surgr's voice in the room. Alerts are spoken verbatim through a persistent agent session, with browser speech as a fallback.",
  },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo} aria-label="Surgr home">
            <span className={styles.logoMark} aria-hidden>
              <svg viewBox="0 0 64 64" width="22" height="22">
                <polyline points="10,34 20,34 25,22 32,46 39,28 43,34 54,34" fill="none" stroke="#071018" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Surgr
          </Link>
          <nav className={styles.navLinks} aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#product">Product</a>
            <a href="#stack">Built on AssemblyAI</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
          <Link href="/app" className={`${styles.btn} ${styles.btnPrimary} ${styles.navCta}`}>
            Launch app
          </Link>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}>
                <span className={styles.eyebrowDot} /> AssemblyAI Voice Agent Hackathon · 2026
              </div>
              <h1 className={styles.h1}>
                Every verbal order in the OR, <span className={styles.accent}>verified out loud.</span>
              </h1>
              <p className={styles.lead}>
                Surgr listens to the operating room, checks each drug order against its read-back in real time, tracks the WHO Surgical Safety Checklist as the team speaks it, and says something the moment a loop does not close.
              </p>
              <div className={styles.ctas}>
                <Link href="/app" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}>
                  Launch app
                  <span aria-hidden>→</span>
                </Link>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={`${styles.btn} ${styles.btnGhost} ${styles.btnLarge}`}>
                  View source
                </a>
              </div>
              <p className={styles.note}>Runs in Chrome or Edge. No install. Scripted OR scenarios are built in if you do not have an operating room handy.</p>
            </div>
            <div className={styles.heroDemo}>
              <LandingDemo />
            </div>
          </div>
        </section>

        <section className={styles.stats} aria-label="Why this matters">
          <div className={styles.statsGrid}>
            {STATS.map((s) => (
              <div key={s.value} className={styles.stat}>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
                <div className={styles.statSource}>{s.source}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.kicker}>How it works</div>
            <h2 className={styles.h2}>Listen, understand, intervene, document.</h2>
            <p className={styles.sub}>Four stages, one loop. The first three run in real time; the fourth is ready the moment the patient leaves the room.</p>
          </div>
          <div className={styles.steps}>
            {STEPS.map((s) => (
              <div key={s.n} className={styles.step}>
                <div className={styles.stepNum}>{s.n}</div>
                <h3 className={styles.h3}>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="product" className={`${styles.section} ${styles.product}`}>
          <div className={styles.sectionHead}>
            <div className={styles.kicker}>The cockpit</div>
            <h2 className={styles.h2}>One screen for the whole room. Nobody has to look at it.</h2>
            <p className={styles.sub}>The display exists for the circulating nurse, the debrief and the audit. The alerts are spoken. The record writes itself.</p>
          </div>
          <div className={styles.frame}>
            <Image
              src="/screenshots/cockpit-alert.png"
              alt="Surgr cockpit showing a live transcript colour-coded by role, a fentanyl order flagged as a dose mismatch, and the WHO checklist"
              width={1600}
              height={1000}
              priority={false}
              className={styles.shot}
            />
          </div>
          <div className={styles.callouts}>
            <div className={styles.callout}>
              <strong>Transcript by role.</strong> Surgeon, anesthesiologist and nurse in their own colours, with every order and read-back tagged.
            </div>
            <div className={styles.callout}>
              <strong>Order board.</strong> A ten-second countdown per order. Mismatches go red and stay red until a correct read-back arrives.
            </div>
            <div className={styles.callout}>
              <strong>Checklist that ticks itself.</strong> Sign In, Time Out and Sign Out complete from speech, and a phase that ends with gaps raises an alert.
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.kicker}>What it catches</div>
            <h2 className={styles.h2}>Built around the errors that actually happen.</h2>
          </div>
          <div className={styles.features}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.feature}>
                <h3 className={styles.h3}>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="stack" className={`${styles.section} ${styles.stackSection}`}>
          <div className={styles.sectionHead}>
            <div className={styles.kicker}>Built on AssemblyAI</div>
            <h2 className={styles.h2}>Four products, one safety loop.</h2>
            <p className={styles.sub}>Every integration below was verified against the live services: a streaming session with medical mode and speaker labels, a Voice Agent reply spoken verbatim, and JSON-schema outputs from the LLM Gateway.</p>
          </div>
          <div className={styles.stack}>
            {STACK.map((s) => (
              <div key={s.name} className={styles.stackCard}>
                <div className={styles.stackName}>{s.name}</div>
                <div className={styles.stackTag}>{s.tag}</div>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
          <div className={styles.flow} aria-label="Data flow">
            <span>Room mic</span>
            <i />
            <span>Streaming STT</span>
            <i />
            <span>Rules + LLM Gateway</span>
            <i />
            <span>Read-back state machine</span>
            <i />
            <span>Voice Agent · EHR record</span>
          </div>
        </section>

        <section className={styles.ctaBand}>
          <div className={styles.ctaInner}>
            <div>
              <div className={styles.kicker}>Try it in sixty seconds</div>
              <h2 className={styles.h2}>Hear Surgr catch a wrong dose.</h2>
              <ol className={styles.tryList}>
                <li>Launch the app and turn your sound on.</li>
                <li>Play <em>Dose mismatch</em> in the simulator, or start a live session and speak an order.</li>
                <li>Export the EHR report and follow a timestamp back into the transcript.</li>
              </ol>
            </div>
            <Link href="/app" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}>
              Launch app <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <div className={styles.footerBrand}>Surgr</div>
            <p className={styles.disclaimer}>
              Surgr is a hackathon prototype built for the AssemblyAI Voice Agent Hackathon on lablab.ai. It is not a medical device and does not replace clinical judgement or institutional safety protocols.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://www.assemblyai.com" target="_blank" rel="noopener noreferrer">
              AssemblyAI
            </a>
            <a href="https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon" target="_blank" rel="noopener noreferrer">
              Hackathon
            </a>
            <Link href="/app">Launch app</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
