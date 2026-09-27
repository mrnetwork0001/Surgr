"use client";
import type { ReactNode } from "react";
import BlurText from "./BlurText";
import FadingVideo from "./FadingVideo";
import { ClipboardIcon, ShieldCheckIcon, WaveIcon } from "./Icons";
import ORBackdrop from "./ORBackdrop";

/** Optional atmospheric MP4. Empty = animated OR backdrop. */
const CAPABILITIES_VIDEO = "";

const CARDS: { title: string; icon: ReactNode; tags: string[]; body: string }[] = [
  {
    title: "Verify",
    icon: <ShieldCheckIcon />,
    tags: ["Drug", "Dose", "Unit conversion", "Route"],
    body: "Every verbal order gets ten seconds to be read back. Drug, dose, unit and route are compared, so 0.1 mg and 100 mcg agree while rocuronium and succinylcholine do not.",
  },
  {
    title: "Checklist",
    icon: <ClipboardIcon />,
    tags: ["Sign In", "Time Out", "Sign Out", "21 items"],
    body: "The WHO Surgical Safety Checklist ticks itself as the team speaks. A phase that ends with gaps, or an incision called without a Time Out, raises an alert.",
  },
  {
    title: "Speak & record",
    icon: <WaveIcon />,
    tags: ["Voice Agent", "Under 1 s", "EHR export", "Timestamps"],
    body: "Alerts are spoken into the room word for word through AssemblyAI's Voice Agent, and every order, item and event lands in an audit-ready record linked to the audio.",
  },
];

export default function Capabilities({ image }: { image?: string }) {
  return (
    <section id="capabilities" className="relative min-h-screen overflow-hidden bg-black">
      {CAPABILITIES_VIDEO ? (
        <FadingVideo src={CAPABILITIES_VIDEO} className="absolute inset-0 z-0 h-full w-full object-cover" fallback={<ORBackdrop variant="capabilities" image={image} />} />
      ) : (
        <div className="absolute inset-0 z-0">
          <ORBackdrop variant="capabilities" image={image} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-black/10 to-black/60" />

      <div className="relative z-10 flex min-h-screen flex-col px-8 pt-24 pb-10 md:px-16 lg:px-20">
        <div className="mb-auto">
          <div className="mb-6 font-body text-sm text-white/80">{"// Capabilities"}</div>
          <BlurText
            as="h2"
            align="start"
            text="Listens, verifies, speaks up"
            className="max-w-[11ch] font-heading text-6xl italic leading-[0.9] tracking-[-3px] text-white md:text-7xl lg:text-[6rem]"
          />
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {CARDS.map((c) => (
            <article key={c.title} className="liquid-glass flex min-h-[360px] flex-col rounded-[1.25rem] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="liquid-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.75rem] text-white">{c.icon}</div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {c.tags.map((t) => (
                    <span key={t} className="liquid-glass whitespace-nowrap rounded-full px-3 py-1 font-body text-[11px] text-white/90">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-1" />
              <h3 className="font-heading text-3xl italic leading-none tracking-[-1px] text-white md:text-4xl">{c.title}</h3>
              <p className="mt-3 max-w-[32ch] font-body text-sm font-light leading-snug text-white/90">{c.body}</p>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
