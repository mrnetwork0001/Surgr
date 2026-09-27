/**
 * AudioWorklet: converts the microphone's Float32 stream to 16-bit PCM at the
 * target sample rate (16 kHz for AssemblyAI streaming) in ~50 ms chunks.
 * Also reports an RMS level every ~100 ms for the UI meter.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.target = opts.targetSampleRate || 16000;
    this.chunkSamples = Math.round((this.target * (opts.chunkMs || 50)) / 1000);
    this.ratio = sampleRate / this.target;
    this.pending = new Float32Array(0);
    this.pos = 0;
    this.out = new Int16Array(this.chunkSamples);
    this.outLen = 0;
    this.levelAcc = 0;
    this.levelCount = 0;
    this.levelEvery = Math.round(this.target / 10);
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;

    const merged = new Float32Array(this.pending.length + input.length);
    merged.set(this.pending, 0);
    merged.set(input, this.pending.length);

    let pos = this.pos;
    while (pos + 1 < merged.length) {
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const s = merged[idx] * (1 - frac) + merged[idx + 1] * frac;
      const clamped = Math.max(-1, Math.min(1, s));
      this.out[this.outLen++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      this.levelAcc += clamped * clamped;
      this.levelCount++;
      if (this.outLen === this.chunkSamples) {
        const buf = this.out.buffer.slice(0);
        this.port.postMessage({ type: "audio", buffer: buf }, [buf]);
        this.outLen = 0;
      }
      if (this.levelCount >= this.levelEvery) {
        this.port.postMessage({ type: "level", rms: Math.sqrt(this.levelAcc / this.levelCount) });
        this.levelAcc = 0;
        this.levelCount = 0;
      }
      pos += this.ratio;
    }
    const consumed = Math.floor(pos);
    this.pending = merged.subarray(Math.min(consumed, merged.length)).slice();
    this.pos = pos - consumed;
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
