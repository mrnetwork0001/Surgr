"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Props {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "p";
  /** Stagger between words, in ms. */
  delay?: number;
  align?: "center" | "start";
}

/** Word-by-word blur-in that triggers when the element scrolls into view. */
export default function BlurText({ text, className, as = "p", delay = 100, align = "center" }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as;
  const words = text.split(" ");
  return (
    <Tag
      ref={ref as never}
      className={className}
      style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", rowGap: "0.1em" }}
    >
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          style={{ display: "inline-block", marginRight: "0.28em" }}
          initial={{ filter: "blur(10px)", opacity: 0, y: 50 }}
          animate={inView ? { filter: "blur(0px)", opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.7, delay: (i * delay) / 1000, ease: "easeOut" }}
        >
          {word}
        </motion.span>
      ))}
    </Tag>
  );
}
