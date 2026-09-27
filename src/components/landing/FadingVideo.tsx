"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface Props {
  src: string | string[];
  className?: string;
  style?: CSSProperties;
  /** Rendered in place of the video when it fails to load. */
  fallback?: ReactNode;
}

/**
 * Atmospheric background video: fades in on loadeddata, fades out in the last
 * half second, then either replays (single source) or advances to the next clip.
 */
export default function FadingVideo({ src, className, style, fallback }: Props) {
  const sourcesKey = Array.isArray(src) ? src.join("|") : src;
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const sources = sourcesKey.split("|");
    let raf = 0;
    let fadingOut = false;

    const fadeTo = (target: number, ms: number) => {
      cancelAnimationFrame(raf);
      const from = parseFloat(video.style.opacity || "0");
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / ms);
        video.style.opacity = String(from + (target - from) * p);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const onLoaded = () => {
      fadingOut = false;
      fadeTo(1, 500);
      video.play().catch(() => undefined);
    };
    const onTime = () => {
      if (!fadingOut && Number.isFinite(video.duration) && video.duration - video.currentTime <= 0.55) {
        fadingOut = true;
        fadeTo(0, 550);
      }
    };
    const onEnded = () => {
      if (sources.length === 1) {
        video.currentTime = 0;
        fadingOut = false;
        video.play().catch(() => undefined);
        fadeTo(1, 500);
      } else {
        setIndex((i) => (i + 1) % sources.length);
      }
    };
    const onError = () => setFailed(true);

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    if (video.error) onError();
    else if (video.readyState >= 2) onLoaded();
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
    };
  }, [sourcesKey, index]);

  if (failed) {
    return <div className="absolute inset-0 z-0">{fallback}</div>;
  }

  const sources = sourcesKey.split("|");
  return (
    <video
      ref={ref}
      key={sources[index % sources.length]}
      src={sources[index % sources.length]}
      autoPlay
      muted
      playsInline
      preload="auto"
      className={className}
      style={{ opacity: 0, ...style }}
      onError={() => setFailed(true)}
    />
  );
}
