"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import BlurText from "./BlurText";
import FadingVideo from "./FadingVideo";
import ORBackdrop from "./ORBackdrop";
import { ArrowUpRight, ClipboardIcon, ClockIcon, Play } from "./Icons";

/** Optional atmospheric MP4 (e.g. a generated operating-room clip). Empty = animated OR backdrop. */
const HERO_VIDEO = "";
export const GITHUB_URL = "https://github.com/mrnetwork0001/Surgr";
export const HACKATHON_URL = "https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon";
/** Set to the recorded demo once it exists; the "Watch the demo" link is hidden until then. */
const DEMO_VIDEO_URL = "";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Capabilities", href: "#capabilities" },
  { label: "How it works", href: "#how" },
  { label: "Product", href: "#product" },
  { label: "Scenarios", href: "#scenarios" },
];

const blurIn = (delay: number) => ({
  initial: { filter: "blur(10px)", opacity: 0, y: 20 },
  animate: { filter: "blur(0px)", opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: "easeOut" as const, delay },
});

export default function Hero({ image }: { image?: string }) {
  return (
    <section className="relative h-screen overflow-hidden bg-black">
      {HERO_VIDEO ? (
        <FadingVideo
          src={HERO_VIDEO}
          className="absolute left-1/2 top-0 z-0 -translate-x-1/2 object-cover object-top"
          style={{ width: "120%", height: "120%" }}
          fallback={<ORBackdrop variant="hero" image={image} />}
        />
      ) : (
        <div className="absolute inset-0 z-0">
          <ORBackdrop variant="hero" image={image} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/30 via-transparent to-black/60" />

      <div className="relative z-10 flex h-full flex-col">
        <header className="fixed top-4 left-0 right-0 z-50 flex items-center justify-between px-8 lg:px-16">
          <Link href="/" aria-label="Surgr home" className="liquid-glass flex h-12 w-12 items-center justify-center rounded-full font-heading text-2xl italic text-white">
            S
          </Link>
          <nav className="liquid-glass hidden items-center rounded-full px-1.5 py-1.5 md:flex" aria-label="Sections">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="px-3 py-2 font-body text-sm font-medium text-white/90 transition-colors hover:text-white">
                {l.label}
              </a>
            ))}
          </nav>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-4 pt-24 text-center">
          <BlurText
            as="h1"
            text="Every Verbal Order in the OR, Verified Out Loud"
            className="max-w-4xl font-heading text-7xl italic leading-[0.82] tracking-[-3px] text-white md:text-8xl md:tracking-[-4px] lg:max-w-5xl lg:text-[7rem] lg:tracking-[-5px]"
          />

          <motion.p {...blurIn(0.8)} className="mt-6 max-w-3xl font-body text-base font-light leading-snug text-white/95 md:text-lg lg:text-xl">
            Surgr listens to the operating room, checks each drug order against its read-back in real time, tracks the WHO Surgical Safety Checklist as the team speaks it, and speaks up the moment a loop does not close.
          </motion.p>

          <motion.div {...blurIn(1.1)} className="mt-8 flex items-center gap-7">
            <Link href="/app" className="liquid-glass-strong flex items-center gap-2 rounded-full px-6 py-3 font-body text-base font-medium text-white transition-transform hover:scale-[1.03] active:scale-[0.97]">
              Launch app <ArrowUpRight width={18} height={18} />
            </Link>
            {DEMO_VIDEO_URL ? (
              <a href={DEMO_VIDEO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-body text-base font-medium text-white/90 transition-colors hover:text-white">
                <Play width={15} height={15} /> Watch the demo
              </a>
            ) : (
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-body text-base font-medium text-white/90 transition-colors hover:text-white">
                <Play width={15} height={15} /> See the source
              </a>
            )}
          </motion.div>

          <motion.div {...blurIn(1.3)} className="mt-10 hidden flex-wrap justify-center gap-4 sm:flex [@media(max-height:780px)]:hidden">
            <div className="liquid-glass w-[236px] rounded-[1.25rem] p-5 text-left">
              <ClockIcon className="text-white/90" />
              <div className="mt-4 font-heading text-4xl italic leading-none tracking-[-1px] text-white">10 s</div>
              <div className="mt-2 font-body text-xs text-white/80">Read-back window on every verbal drug order</div>
            </div>
            <div className="liquid-glass w-[236px] rounded-[1.25rem] p-5 text-left">
              <ClipboardIcon className="text-white/90" />
              <div className="mt-4 font-heading text-4xl italic leading-none tracking-[-1px] text-white">21</div>
              <div className="mt-2 font-body text-xs text-white/80">WHO checklist items tracked from speech</div>
            </div>
          </motion.div>
        </div>

        <motion.div {...blurIn(1.4)} className="flex flex-col items-center gap-4 pb-8">
          <div className="liquid-glass rounded-full px-4 py-1.5 font-body text-xs text-white/90 md:text-sm">
            Built on AssemblyAI. Every integration verified against the live services.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 md:gap-x-16">
            {["Streaming", "Speaker Labels", "LLM Gateway", "Voice Agent"].map((name) => (
              <span key={name} className="font-heading text-2xl italic tracking-tight text-white md:text-3xl">
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
