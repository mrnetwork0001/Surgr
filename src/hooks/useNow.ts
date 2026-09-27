"use client";
import { useEffect, useState } from "react";

/** Wall-clock that updates on an interval. Returns 0 until the first tick. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = window.setInterval(tick, intervalMs);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(first);
    };
  }, [intervalMs]);
  return now;
}
