"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PCMPlayer, base64ToInt16, silenceBase64 } from "@/lib/audio";

export type VoiceStatus = "idle" | "connecting" | "ready" | "speaking" | "fallback" | "error";

interface Options {
  enabled: boolean;
  hasKey: boolean;
}

const AGENT_URL = "wss://agents.assemblyai.com/v1/ws";
/** Close the agent session after this long without an alert; it reconnects on the next alert. */
const IDLE_DISCONNECT_MS = 90_000;
const SYSTEM_PROMPT =
  "You are Surgr, the operating room safety alert voice. You are not a conversational assistant. You never greet, never ask questions and never add commentary. When you receive instructions to speak an alert, say the alert text exactly, word for word, in a calm, clear and urgent tone, then stop. If you hear audio without instructions, stay silent.";

/**
 * AssemblyAI Voice Agent session used as the OR loudspeaker. Surgr never sends the
 * room audio to it; it only asks the agent to speak alerts via `reply.create`.
 * Falls back to the browser's speechSynthesis when the agent is unavailable.
 */
export function useVoiceAgent({ enabled, hasKey }: Options) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [lastSpoken, setLastSpoken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const readyRef = useRef<Promise<WebSocket> | null>(null);
  const playerRef = useRef<PCMPlayer | null>(null);
  const keepaliveRef = useRef<number | null>(null);
  const queueRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const replyWaiters = useRef<{ onStarted: () => void; onDone: () => void } | null>(null);
  const enabledRef = useRef(enabled);
  const hasKeyRef = useRef(hasKey);
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    hasKeyRef.current = hasKey;
  }, [hasKey]);

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

  /** Tears the socket down without touching React state (safe inside effects). */
  const closeSocket = useCallback(() => {
    stopKeepalive();
    clearIdleTimer();
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
  }, [closeSocket]);

  /** (Re)arms the idle disconnect. Called on connect and after every spoken alert. */
  const touchIdle = useCallback(() => {
    clearIdleTimer();
    function arm() {
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        if (busyRef.current || queueRef.current.length > 0) {
          arm();
          return;
        }
        disconnect();
      }, IDLE_DISCONNECT_MS);
    }
    arm();
  }, [clearIdleTimer, disconnect]);

  const handleMessage = useCallback(
    (raw: string) => {
      let m: { type?: string } & Record<string, unknown>;
      try {
        m = JSON.parse(raw);
      } catch {
        return;
      }
      switch (m.type) {
        case "reply.started":
          setStatus("speaking");
          replyWaiters.current?.onStarted();
          break;
        case "reply.audio":
          if (typeof m.data === "string") getPlayer().enqueue(base64ToInt16(m.data));
          break;
        case "transcript.agent":
          if (typeof m.text === "string") setLastSpoken(m.text);
          break;
        case "reply.done":
          replyWaiters.current?.onDone();
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
    [getPlayer],
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
            input: { format: { encoding: "audio/pcm" } },
            output: { voice: data.voiceId ?? "george", format: { encoding: "audio/pcm" }, volume: 100 },
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
      };
      // Stream silence at real-time pace so the session behaves like an open call.
      const silence = silenceBase64(100, 24000);
      keepaliveRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input.audio", audio: silence }));
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
  }, [handleMessage, stopKeepalive, touchIdle]);

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
          void fallbackSpeak(text).then(resolve);
        }, 3500);
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
            instructions: `Speak the following text verbatim, exactly as written, and nothing else: "${text}"`,
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
  }, [closeSocket]);

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

  // A hidden tab should not keep a billable agent session open; it reconnects on the next alert.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && !busyRef.current) disconnect();
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

  return { status: enabled ? status : ("idle" as VoiceStatus), lastSpoken, error, speak, stop, warmUp, disconnect };
}
