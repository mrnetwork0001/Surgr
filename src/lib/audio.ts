/** Browser-side PCM helpers for the Voice Agent (24 kHz mono 16-bit) and the streaming mic. */

export function base64ToInt16(b64: string): Int16Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

let silenceCache: Record<number, string> = {};
/** Base64 PCM16 silence of the given duration at the given sample rate. */
export function silenceBase64(ms: number, sampleRate = 24000): string {
  const key = ms * 100000 + sampleRate;
  if (!silenceCache[key]) {
    const samples = Math.round((sampleRate * ms) / 1000);
    silenceCache[key] = bytesToBase64(new Uint8Array(samples * 2));
  }
  return silenceCache[key];
}

export function resetSilenceCache() {
  silenceCache = {};
}

/** Gapless scheduler for streamed PCM16 chunks. */
export class PCMPlayer {
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private readonly sampleRate: number;

  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Call from a user gesture so playback is allowed later. */
  unlock() {
    this.ensure();
  }

  enqueue(pcm: Int16Array) {
    if (pcm.length === 0) return;
    const ctx = this.ensure();
    const buffer = ctx.createBuffer(1, pcm.length, this.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 32768;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime + 0.02, this.nextTime);
    src.start(startAt);
    this.nextTime = startAt + buffer.duration;
  }

  /** Milliseconds of audio still scheduled. */
  remainingMs(): number {
    if (!this.ctx) return 0;
    return Math.max(0, (this.nextTime - this.ctx.currentTime) * 1000);
  }

  async drained(): Promise<void> {
    const ms = this.remainingMs();
    if (ms > 0) await new Promise((r) => setTimeout(r, ms + 50));
  }

  stop() {
    this.nextTime = 0;
  }

  close() {
    void this.ctx?.close();
    this.ctx = null;
    this.nextTime = 0;
  }
}
