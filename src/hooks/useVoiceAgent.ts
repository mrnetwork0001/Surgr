"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PCMPlayer, Upsampler16to24, base64ToInt16, bytesToBase64, silenceBase64 } from "@/lib/audio";
import { SURGR_TOOLS } from "@/lib/agentTools";

export type VoiceStatus = "idle" | "connecting" | "ready" | "speaking" | "fallback" | "error";
export type AskState = "idle" | "listening" | "answering";
export type ToolHandler = (name: string, args: Record<string, unknown>) => unknown;

export interface AskExchange {
  question?: string;
  answer?: string;
  at: number;
}

interface Options {
  enabled: boolean;
  hasKey: boolean;
  /** Answers the agent's tool calls from live application state. */
  tools?: ToolHandler;
}

const AGENT_URL = "wss://agents.assemblyai.com/v1/ws";
/** The agent accepts 24 kHz PCM only; microphone chunks arrive at 16 kHz from the streaming worklet and are upsampled. */
const INPUT_SAMPLE_RATE = 24000;
/** Close the agent session after this long without an alert or question; it reconnects on demand. */
const IDLE_DISCONNECT_MS = 90_000;
/** A reply whose first words match this is the agent staying quiet; its audio is never played. */
const SILENT_REPLY = /^\s*[\[("']?\s*silent\b/i;
/** The agent's own transcription of the name; used to surface heard questions on the card. */
const WAKE_HEARD = /\b(?:surgr|surger|sergr|surgur|sirgr|sergei|sergey|sergio|surgeur)\b/i;

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** True when `text` begins like the last alert (first five words), i.e. the agent is reading an alert, not answering. */
function looksLikeAlert(text: string, alert: string): boolean {
  if (!alert) return false;
  const a = norm(alert).split(" ").slice(0, 5).join(" ");
  const t = norm(text).split(" ").slice(0, 5).join(" ");
  return a.length > 0 && (t.startsWith(a) || a.startsWith(t) && t.split(" ").length >= 3);
}

const SYSTEM_PROMPT = [
  "You are Surgr, the operating room's closed-loop safety copilot. You listen to the whole room continuously. You have exactly two jobs.",
  "1. When you receive instructions to announce an alert, speak the given text exactly, word for word, in a calm, clear, urgent tone, then stop.",
  "2. When a team member addresses you by name and asks about the current case, call a tool, then answer in one or two short sentences. Never invent orders, doses, times or checklist states. Say doses in words, for example 'one hundred micrograms fentanyl'. If a tool returns nothing relevant, say so plainly.",
  "Your name is Surgr, pronounced 'surger'; transcription may render it as Sergei, Sergey, Sergio, Surger or Surgeon at the start of a sentence. Treat those as your name only when the sentence is clearly addressed to you.",
  "SILENCE RULE: most of what you hear is the surgical team talking to each other: drug orders, read-backs, checklist statements, instrument requests. None of that is addressed to you. For any utterance that does not address you by name, your entire reply must be the single word: silent. No punctuation, no other words. Never greet, never acknowledge, never comment.",
].join(" ");

/**
 * AssemblyAI Voice Agent session used as the OR loudspeaker and as an assistant that can be
 * asked about the case. Surgr streams room audio to it only while a question gate is open.
 * Falls back to the browser's speechSynthesis for alerts when the agent is unavailable.
 */
export function useVoiceAgent({ enabled, hasKey, tools }: Options) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [lastSpoken, setLastSpoken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<AskState>("idle");
  const [exchange, setExchange] = useState<AskExchange | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const readyRef = useRef<Promise<WebSocket> | null>(null);
  const playerRef = useRef<PCMPlayer | null>(null);
  const keepaliveRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const queueRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const replyWaiters = useRef<{ onStarted: () => void; onDone: () => void } | null>(null);
  const enabledRef = useRef(enabled);
  const hasKeyRef = useRef(hasKey);
  const toolsRef = useRef<ToolHandler | undefined>(tools);
  const listeningRef = useRef(false);
  const askRef = useRef<AskState>("idle");
  const upsamplerRef = useRef(new Upsampler16to24());
  const replyInFlightRef = useRef(false);
  const pendingToolResults = useRef<string[]>([]);
  const touchIdleRef = useRef<(() => void) | null>(null);
  /** Audio of the current reply, held until its first words show whether the agent is answering or staying silent. */
  const replyAudioRef = useRef<{ decided: boolean; play: boolean; chunks: Int16Array[] }>({ decided: false, play: false, chunks: [] });
  /** The alert most recently requested with reply.create, so a late agent rendition is never mistaken for an answer. */
  const lastAlertRef = useRef<{ text: string; spokenByFallback: boolean }>({ text: "", spokenByFallback: false });
  const [suppressedReplies, setSuppressedReplies] = useState(0);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    hasKeyRef.current = hasKey;
  }, [hasKey]);
  useEffect(() => {
    toolsRef.current = tools;
  }, [tools]);

  const getPlayer = useCallback(() => {
    if (!playerRef.current) playerRef.current = new PCMPlayer(24000);
    return playerRef.current;
  }, []);

  const stopKeepalive = useCallback(() => {
    if (keepaliveRef.current !== null) {
      window.clearInterval(keepaliveRef.current);
      keepaliveRef.current = null;
    }
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const setAskState = useCallback((s: AskState) => {
    askRef.current = s;
    setAsk(s);
  }, []);

  /** Tears the socket down without touching React state (safe inside effects). */
  const closeSocket = useCallback(() => {
    stopKeepalive();
    clearIdleTimer();
    replyInFlightRef.current = false;
    replyAudioRef.current = { decided: false, play: false, chunks: [] };
    pendingToolResults.current = [];
    const ws = wsRef.current;
    wsRef.current = null;
    readyRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "session.end" }));
      } catch {
        /* ignore */
      }
      window.setTimeout(() => ws.close(), 500);
    } else {
      ws?.close();
    }
    replyWaiters.current?.onDone();
  }, [stopKeepalive, clearIdleTimer]);

  const disconnect = useCallback(() => {
    closeSocket();
    setStatus("idle");
    setAskState("idle");
  }, [closeSocket, setAskState]);

  /** (Re)arms the idle disconnect. Called on connect and after every spoken alert or answer. */
  const touchIdle = useCallback(() => {
    clearIdleTimer();
    function arm() {
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        if (busyRef.current || queueRef.current.length > 0 || listeningRef.current || askRef.current !== "idle") {
          arm();
          return;
        }
        disconnect();
      }, IDLE_DISCONNECT_MS);
    }
    arm();
  }, [clearIdleTimer, disconnect]);
  useEffect(() => {
    touchIdleRef.current = touchIdle;
  }, [touchIdle]);

  const sendJson = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const flushToolResults = useCallback(() => {
    for (const r of pendingToolResults.current) sendJson({ type: "tool.result", ...JSON.parse(r) });
    pendingToolResults.current = [];
  }, [sendJson]);

  const handleToolCall = useCallback(
    (callId: string, name: string, args: Record<string, unknown>) => {
      let result: unknown;
      let isError = false;
      try {
        result = toolsRef.current ? toolsRef.current(name, args) : { error: "no tools available" };
      } catch (e) {
        isError = true;
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      const payload = JSON.stringify({ call_id: callId, result: JSON.stringify(result ?? null), is_error: isError });
      if (replyInFlightRef.current) {
        pendingToolResults.current.push(payload);
        // Never hold a result for long; the agent apologises and moves on if it times out.
        window.setTimeout(() => {
          if (pendingToolResults.current.includes(payload)) {
            pendingToolResults.current = pendingToolResults.current.filter((p) => p !== payload);
            sendJson({ type: "tool.result", ...JSON.parse(payload) });
          }
        }, 1500);
      } else {
        sendJson({ type: "tool.result", ...JSON.parse(payload) });
      }
    },
    [sendJson],
  );

  const handleMessage = useCallback(
    (raw: string) => {
      let m: { type?: string } & Record<string, unknown>;
      try {
        m = JSON.parse(raw);
      } catch {
        return;
      }
      switch (m.type) {
        case "reply.started": {
          replyInFlightRef.current = true;
          // Alerts we requested play immediately; agent-initiated replies are held until their first words are known.
          const isAlert = !!replyWaiters.current;
          replyAudioRef.current = { decided: isAlert, play: isAlert, chunks: [] };
          if (isAlert) {
            setStatus("speaking");
            replyWaiters.current?.onStarted();
          }
          break;
        }
        case "reply.audio": {
          if (typeof m.data !== "string") break;
          const pcm = base64ToInt16(m.data);
          const r = replyAudioRef.current;
          if (!r.decided) r.chunks.push(pcm);
          else if (r.play) getPlayer().enqueue(pcm);
          break;
        }
        case "transcript.agent.delta": {
          const r = replyAudioRef.current;
          if (r.decided || typeof m.delta !== "string") break;
          const first = m.delta.trim();
          if (!first) break;
          r.decided = true;
          const alertRendition = looksLikeAlert(first, lastAlertRef.current.text);
          r.play = !SILENT_REPLY.test(first) && !(alertRendition && lastAlertRef.current.spokenByFallback);
          if (r.play) {
            setStatus("speaking");
            if (!alertRendition) setAskState("answering");
            for (const c of r.chunks) getPlayer().enqueue(c);
          } else {
            setSuppressedReplies((n) => n + 1);
          }
          r.chunks = [];
          break;
        }
        case "transcript.user":
          if (typeof m.text === "string" && (askRef.current !== "idle" || WAKE_HEARD.test(m.text))) {
            const q = m.text;
            setExchange((prev) => ({ question: q, answer: prev && prev.question === q ? prev.answer : undefined, at: Date.now() }));
          }
          break;
        case "transcript.agent": {
          if (typeof m.text !== "string") break;
          const a = m.text;
          const r = replyAudioRef.current;
          const isAlertText = looksLikeAlert(a, lastAlertRef.current.text);
          if (!r.decided) {
            // No deltas arrived for this reply; decide on the full text.
            r.decided = true;
            r.play = !SILENT_REPLY.test(a) && !(isAlertText && lastAlertRef.current.spokenByFallback);
            if (r.play) {
              setStatus("speaking");
              if (!isAlertText) setAskState("answering");
              for (const c of r.chunks) getPlayer().enqueue(c);
            } else {
              setSuppressedReplies((n) => n + 1);
            }
            r.chunks = [];
          }
          if (r.play) {
            setLastSpoken(a);
            if (!replyWaiters.current && !isAlertText) setExchange((prev) => ({ question: prev?.question, answer: a, at: Date.now() }));
          }
          break;
        }
        case "reply.done":
          replyInFlightRef.current = false;
          flushToolResults();
          if (replyWaiters.current) {
            replyWaiters.current.onDone();
          } else {
            setAskState("idle");
            setStatus((s) => (s === "speaking" ? "ready" : s));
            touchIdleRef.current?.();
          }
          replyAudioRef.current = { decided: false, play: false, chunks: [] };
          break;
        case "tool.call":
          if (typeof m.call_id === "string" && typeof m.name === "string") {
            handleToolCall(m.call_id, m.name, (m.arguments as Record<string, unknown>) ?? {});
          }
          break;
        case "session.error":
        case "error":
          setError(typeof m.message === "string" ? m.message : "Voice Agent error");
          replyWaiters.current?.onDone();
          break;
        default:
          break;
      }
    },
    [getPlayer, setAskState, flushToolResults, handleToolCall],
  );

  const connect = useCallback((): Promise<WebSocket> => {
    if (readyRef.current) return readyRef.current;
    setStatus("connecting");
    setError(null);
    const attempt = (async () => {
      const res = await fetch("/api/agent-token", { cache: "no-store" });
      const data = (await res.json()) as { token?: string; voiceId?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error ?? "Could not get a Voice Agent token");
      const ws = new WebSocket(`${AGENT_URL}?token=${encodeURIComponent(data.token)}`);
      wsRef.current = ws;
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("Could not connect to the Voice Agent"));
        ws.onclose = (ev) => reject(new Error(`Voice Agent closed (${ev.code}${ev.reason ? `: ${ev.reason}` : ""})`));
      });
      const ready = new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("Voice Agent did not become ready")), 8000);
        ws.onmessage = (ev) => {
          try {
            const m = JSON.parse(ev.data) as { type?: string; message?: string };
            if (m.type === "session.ready") {
              window.clearTimeout(timer);
              resolve();
            } else if (m.type === "session.error" || m.type === "error") {
              window.clearTimeout(timer);
              reject(new Error(m.message ?? "Voice Agent error"));
            }
          } catch {
            /* ignore */
          }
        };
      });
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            system_prompt: SYSTEM_PROMPT,
            input: { format: { encoding: "audio/pcm", sample_rate: INPUT_SAMPLE_RATE } },
            output: { voice: data.voiceId ?? "george", format: { encoding: "audio/pcm" }, volume: 100 },
            tools: SURGR_TOOLS,
          },
        }),
      );
      await ready;
      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") handleMessage(ev.data);
      };
      ws.onerror = () => setError("Voice Agent connection error");
      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        readyRef.current = null;
        stopKeepalive();
        replyWaiters.current?.onDone();
        setStatus("idle");
        setAskState("idle");
      };
      // Stream silence at real-time pace so the session behaves like an open call, except while the room is being forwarded.
      const silence = silenceBase64(100, INPUT_SAMPLE_RATE);
      keepaliveRef.current = window.setInterval(() => {
        if (!listeningRef.current && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input.audio", audio: silence }));
      }, 100);
      setStatus("ready");
      touchIdle();
      return ws;
    })();
    attempt.catch((e: unknown) => {
      readyRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    });
    readyRef.current = attempt;
    return attempt;
  }, [handleMessage, stopKeepalive, setAskState, touchIdle]);

  const fallbackSpeak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve();
          return;
        }
        setStatus("fallback");
        setLastSpoken(text);
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          setStatus((s) => (s === "fallback" ? "idle" : s));
          resolve();
        };
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.02;
        u.pitch = 0.95;
        u.onend = done;
        u.onerror = done;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        window.setTimeout(done, Math.max(4000, text.length * 90));
      }),
    [],
  );

  const speakOne = useCallback(
    async (text: string) => {
      if (!enabledRef.current) return;
      if (!hasKeyRef.current) return fallbackSpeak(text);
      let ws: WebSocket;
      try {
        ws = await connect();
      } catch {
        return fallbackSpeak(text);
      }
      if (ws.readyState !== WebSocket.OPEN) return fallbackSpeak(text);

      // A question to Surgr in progress finishes first; the alert follows immediately after.
      for (let waited = 0; askRef.current !== "idle" && waited < 8000; waited += 250) {
        await new Promise((r) => setTimeout(r, 250));
      }

      lastAlertRef.current = { text, spokenByFallback: false };
      await new Promise<void>((resolve) => {
        let started = false;
        let startTimer = 0;
        let doneTimer = 0;
        const finish = () => {
          window.clearTimeout(startTimer);
          window.clearTimeout(doneTimer);
          replyWaiters.current = null;
          resolve();
        };
        startTimer = window.setTimeout(() => {
          if (started) return;
          replyWaiters.current = null;
          lastAlertRef.current = { text, spokenByFallback: true };
          void fallbackSpeak(text).then(resolve);
        }, 6000);
        doneTimer = window.setTimeout(finish, 20000);
        replyWaiters.current = {
          onStarted: () => {
            started = true;
            window.clearTimeout(startTimer);
          },
          onDone: finish,
        };
        ws.send(
          JSON.stringify({
            type: "reply.create",
            instructions: `Announce this alert now. Speak the following text verbatim, exactly as written, and nothing else: "${text}"`,
          }),
        );
      });
      await getPlayer().drained();
      setStatus((s) => (s === "speaking" ? "ready" : s));
      touchIdle();
    },
    [connect, fallbackSpeak, getPlayer, touchIdle],
  );

  const drain = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const next = queueRef.current.shift();
        if (next) await speakOne(next);
      }
    } finally {
      busyRef.current = false;
    }
  }, [speakOne]);

  /** Queue an alert to be spoken. Safe to call from effects. */
  const speak = useCallback(
    (text: string) => {
      queueRef.current.push(text);
      void drain();
    },
    [drain],
  );

  /** Cuts any speech immediately: drops the queue, ends the agent reply and flushes scheduled audio. */
  const stop = useCallback(() => {
    queueRef.current = [];
    closeSocket();
    playerRef.current?.close();
    playerRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setStatus("idle");
    setAskState("idle");
  }, [closeSocket, setAskState]);

  /** Microphone chunks (16 kHz PCM16) from the streaming worklet, upsampled to 24 kHz and forwarded at real-time pace while listening. */
  const feedAudio = useCallback(
    (buf: ArrayBuffer) => {
      if (!listeningRef.current) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const up = upsamplerRef.current.convert(new Int16Array(buf));
      ws.send(JSON.stringify({ type: "input.audio", audio: bytesToBase64(new Uint8Array(up.buffer, up.byteOffset, up.byteLength)) }));
    },
    [],
  );

  /** Turns continuous room listening on or off (on while a live microphone session runs). */
  const setListening = useCallback(
    (on: boolean) => {
      if (listeningRef.current === on) return;
      listeningRef.current = on;
      if (on && enabledRef.current && hasKeyRef.current) connect().catch(() => undefined);
      if (!on) touchIdle();
    },
    [connect, touchIdle],
  );

  /** Marks that a question to Surgr was heard by the room transcript, so the card can show it while the agent works. */
  const noteQuestion = useCallback(
    (text: string) => {
      setExchange({ question: text, at: Date.now() });
      if (askRef.current === "idle") setAskState("listening");
      window.setTimeout(() => {
        if (askRef.current === "listening") setAskState("idle");
      }, 10_000);
    },
    [setAskState],
  );

  /** Manual trigger: asks the agent to answer the last thing said to it (for when the wake word was not recognised). */
  const startAsk = useCallback(async (): Promise<boolean> => {
    if (!enabledRef.current || !hasKeyRef.current) return false;
    let ws: WebSocket;
    try {
      ws = await connect();
    } catch {
      return false;
    }
    if (ws.readyState !== WebSocket.OPEN) return false;
    setAskState("listening");
    ws.send(JSON.stringify({ type: "reply.create", instructions: "A team member just asked you a question about the case. Answer it now using the tools; if nothing was asked, report the open orders." }));
    window.setTimeout(() => {
      if (askRef.current === "listening") setAskState("idle");
    }, 10_000);
    touchIdle();
    return true;
  }, [connect, setAskState, touchIdle]);

  const stopAsk = useCallback(() => {
    setAskState("idle");
  }, [setAskState]);

  const clearExchange = useCallback(() => setExchange(null), []);

  /** Call from a user gesture: unlocks audio playback and pre-connects the agent. */
  const warmUp = useCallback(() => {
    getPlayer().unlock();
    if (enabledRef.current && hasKeyRef.current) connect().catch(() => undefined);
  }, [connect, getPlayer]);

  useEffect(() => {
    if (!enabled) {
      queueRef.current = [];
      closeSocket();
    }
  }, [enabled, closeSocket]);

  // A hidden tab should not keep a billable agent session open unless the room is being listened to; it reconnects on the next alert.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && !busyRef.current && askRef.current === "idle" && !listeningRef.current) disconnect();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [disconnect]);

  useEffect(
    () => () => {
      closeSocket();
      playerRef.current?.close();
      playerRef.current = null;
    },
    [closeSocket],
  );

  return {
    status: enabled ? status : ("idle" as VoiceStatus),
    lastSpoken,
    error,
    speak,
    stop,
    warmUp,
    disconnect,
    ask,
    exchange,
    suppressedReplies,
    feedAudio,
    setListening,
    noteQuestion,
    startAsk,
    stopAsk,
    clearExchange,
  };
}
