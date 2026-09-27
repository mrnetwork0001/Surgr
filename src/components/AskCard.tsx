"use client";
import type { Surgr } from "@/hooks/useSurgr";

/** Floating card showing the current "Ask Surgr" exchange: what was heard and what Surgr answered. */
export default function AskCard({ surgr }: { surgr: Surgr }) {
  const { ask, askExchange } = surgr;
  if (ask === "idle" && !askExchange) return null;
  return (
    <aside className={`ask-card ${ask !== "idle" ? "ask-card-active" : ""}`} aria-live="polite">
      <div className="ask-head">
        <span className="ask-title">Ask Surgr</span>
        <span className="ask-state">
          {ask === "listening" && (
            <>
              <span className="ask-dot" /> listening
            </>
          )}
          {ask === "answering" && "answering"}
          {ask === "idle" && "answered"}
        </span>
        <button className="deliver-toast-close" onClick={ask === "idle" ? surgr.clearAsk : surgr.stopAsk} aria-label={ask === "idle" ? "Dismiss" : "Stop listening"}>
          ×
        </button>
      </div>
      {askExchange?.question ? <div className="ask-q">“{askExchange.question}”</div> : ask === "listening" ? <div className="ask-q muted">Say your question, for example “Surgr, what is still open?”</div> : null}
      {askExchange?.answer && <div className="ask-a">{askExchange.answer}</div>}
    </aside>
  );
}
