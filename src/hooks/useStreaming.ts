"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { KEYTERMS, STT_PROMPT } from "@/lib/keyterms";
import type { TranscriptTurn, Word } from "@/lib/types";

export type SttStatus = "idle" | "connecting" | "listening" | "closed" | "error";

interface StreamingTurnMessage {
  type: "Turn";
  turn_order: number;
  turn_is_formatted: boolean;
  end_of_turn: boolean;
  transcript: string;
  end_of_turn_confidence?: number;
  speaker_label?: string;
  speaker_confidence?: number;
  words?: { text: string; start: number; end: number; confidence: number; word_is_final?: boolean; speaker?: string }[];
}

interface Options {
  onTurn: (turn: TranscriptTurn) => void;
  onSessionStart?: () => void;
}

const STREAMING_URL = "wss://streaming.assemblyai.com/v3/ws";
/** If a formatted final never arrives, promote the unformatted end-of-turn after this delay. */
const FORMAT_GRACE_MS = 1500;

/**
 * Browser microphone -> AssemblyAI Streaming v3 (universal-3-6-pro, medical mode,
 * speaker labels, keyterms). The API key stays on the server; the browser uses a
 * short-lived token from /api/token.
 */
export function useStreaming({ onTurn, onSessionStart }: Options) {
  const [status, setStatus] = useState<SttStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const onTurnRef = useRef(onTurn);
  const onStartRef = useRef(onSessionStart);
  const graceTimers = useRef(new Map<number, number>());
  const finalized = useRef(new Set<number>());

  useEffect(() => {
    onTurnRef.current = onTurn;
  }, [onTurn]);
  useEffect(() => {
    onStartRef.current = onSessionStart;
  }, [onSessionStart]);

  const teardownAudio = useCallback(() => {
    for (const t of graceTimers.current.values()) window.clearTimeout(t);
    graceTimers.current.clear();
    if (nodeRef.current) {
      nodeRef.current.port.onmessage = null;
      nodeRef.current.disconnect();
      nodeRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => undefined);
      ctxRef.current = null;
    }
    setLevel(0);
  }, []);

  const emitTurn = useCallback((msg: StreamingTurnMessage, forceFinal: boolean) => {
    const words: Word[] = (msg.words ?? []).map((w) => ({
      text: w.text,
      start: w.start,
      end: w.end,
      confidence: w.confidence,
      speaker: w.speaker,
    }));
    const isFinal = forceFinal || (msg.end_of_turn && msg.turn_is_formatted);
    if (isFinal) finalized.current.add(msg.turn_order);
    onTurnRef.current({
      id: `live-${msg.turn_order}`,
      turnOrder: msg.turn_order,
      source: "live",
      text: msg.transcript,
      isFinal,
      speakerLabel: msg.speaker_label ?? "PENDING",
      speakerConfidence: msg.speaker_confidence,
      words,
      startMs: words[0]?.start ?? 0,
      endMs: words.length ? words[words.length - 1].end : 0,
      receivedAt: Date.now(),
    });
  }, []);

  const handleMessage = useCallback(
    (raw: string) => {
      let msg: { type?: string } & Record<string, unknown>;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      switch (msg.type) {
        case "Begin":
          setSessionId(typeof msg.id === "string" ? msg.id : null);
          break;
        case "Turn": {
          const t = msg as unknown as StreamingTurnMessage;
          if (finalized.current.has(t.turn_order)) return;
          const pending = graceTimers.current.get(t.turn_order);
          if (pending !== undefined) {
            window.clearTimeout(pending);
            graceTimers.current.delete(t.turn_order);
          }
          if (t.end_of_turn && !t.turn_is_formatted) {
            emitTurn(t, false);
            const timer = window.setTimeout(() => {
              graceTimers.current.delete(t.turn_order);
              if (!finalized.current.has(t.turn_order)) emitTurn(t, true);
            }, FORMAT_GRACE_MS);
            graceTimers.current.set(t.turn_order, timer);
          } else {
            emitTurn(t, false);
          }
          break;
        }
        case "Termination":
          setStatus("closed");
          break;
        case "Error":
          setError(typeof msg.error === "string" ? msg.error : "Streaming error");
          setStatus("error");
          break;
        default:
          break;
      }
    },
    [emitTurn],
  );

  const stop = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "Terminate" }));
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) ws.close();
      }, 1500);
    } else {
      ws?.close();
    }
    teardownAudio();
    setStatus((s) => (s === "error" ? s : "closed"));
  }, [teardownAudio]);

  const start = useCallback(async () => {
    if (wsRef.current) return;
    setError(null);
    setStatus("connecting");
    finalized.current.clear();
    let ws: WebSocket | null = null;
    try {
      const res = await fetch("/api/token", { cache: "no-store" });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error ?? "Could not get a streaming token");

      const params = new URLSearchParams({
        token: data.token,
        sample_rate: "16000",
        encoding: "pcm_s16le",
        speech_model: "universal-3-6-pro",
        format_turns: "true",
        speaker_labels: "true",
        max_speakers: "4",
        domain: "medical-v1",
        keyterms_prompt: JSON.stringify(KEYTERMS),
        prompt: STT_PROMPT,
        min_turn_silence: "800",
        max_turn_silence: "3600",
      });
      ws = new WebSocket(`${STREAMING_URL}?${params.toString()}`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      const socket = ws;
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error("Could not connect to AssemblyAI streaming"));
        socket.onclose = (ev) => reject(new Error(`Streaming connection closed (${ev.code}${ev.reason ? `: ${ev.reason}` : ""})`));
      });
      socket.onmessage = (ev) => {
        if (typeof ev.data === "string") handleMessage(ev.data);
      };
      socket.onerror = () => {
        setError("Streaming connection error");
        setStatus("error");
      };
      socket.onclose = (ev) => {
        if (wsRef.current !== socket) return;
        wsRef.current = null;
        teardownAudio();
        if (ev.code !== 1000 && ev.code !== 1005) setError(`Streaming closed (${ev.code}${ev.reason ? `: ${ev.reason}` : ""})`);
        setStatus((s) => (s === "error" ? s : "closed"));
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      let ctx: AudioContext;
      try {
        ctx = new AudioContext({ sampleRate: 16000 });
      } catch {
        ctx = new AudioContext();
      }
      ctxRef.current = ctx;
      await ctx.audioWorklet.addModule("/pcm-processor.js");
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pcm-processor", {
        processorOptions: { targetSampleRate: 16000, chunkMs: 50 },
      });
      node.port.onmessage = (e: MessageEvent<{ type: string; buffer?: ArrayBuffer; rms?: number }>) => {
        const d = e.data;
        if (d?.type === "audio" && d.buffer) {
          if (socket.readyState === WebSocket.OPEN) socket.send(d.buffer);
        } else if (d?.type === "level" && typeof d.rms === "number") {
          const rms = d.rms;
          setLevel((prev) => (Math.abs(prev - rms) > 0.005 ? rms : prev));
        }
      };
      source.connect(node);
      node.connect(ctx.destination);
      nodeRef.current = node;
      if (ctx.state === "suspended") await ctx.resume();
      setStatus("listening");
      onStartRef.current?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
      if (wsRef.current === ws) wsRef.current = null;
      ws?.close();
      teardownAudio();
    }
  }, [handleMessage, teardownAudio]);

  useEffect(
    () => () => {
      wsRef.current?.close();
      wsRef.current = null;
      teardownAudio();
    },
    [teardownAudio],
  );

  return { status, error, level, sessionId, start, stop };
}
