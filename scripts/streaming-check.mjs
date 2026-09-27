// Verifies the streaming connection params Surgr uses are accepted (Begin arrives) and the session terminates cleanly.
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1).trim()]));
const key = env.ASSEMBLYAI_API_KEY;
const { KEYTERMS, STT_PROMPT } = await import("./_keyterms.mjs");

const tokRes = await fetch("https://streaming.assemblyai.com/v3/token?expires_in_seconds=120", { headers: { Authorization: key } });
const tok = await tokRes.json();
console.log("token:", tokRes.status, tok.token ? "ok" : JSON.stringify(tok));

const params = new URLSearchParams({
  token: tok.token, sample_rate: "16000", encoding: "pcm_s16le", speech_model: "universal-3-6-pro",
  format_turns: "true", speaker_labels: "true", max_speakers: "4", domain: "medical-v1",
  keyterms_prompt: JSON.stringify(KEYTERMS), prompt: STT_PROMPT, min_turn_silence: "800", max_turn_silence: "3600",
});
console.log("url length:", params.toString().length);
const ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${params}`);
ws.binaryType = "arraybuffer";
const events = [];
const done = new Promise((resolve) => {
  const timer = setTimeout(() => resolve("timeout"), 20000);
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    events.push(m.type === "Begin" ? `Begin ${JSON.stringify(m.configuration ?? {})}` : m.type === "Error" ? `Error ${JSON.stringify(m)}` : m.type);
    if (m.type === "Begin") {
      // 1 s of silence in 50 ms frames, then terminate
      const frame = new ArrayBuffer(1600);
      let n = 0;
      const iv = setInterval(() => { ws.send(frame); if (++n >= 20) { clearInterval(iv); ws.send(JSON.stringify({ type: "Terminate" })); } }, 50);
    }
    if (m.type === "Termination") { clearTimeout(timer); resolve("terminated"); }
  };
  ws.onerror = () => events.push("ws error");
  ws.onclose = (e) => { events.push(`close ${e.code} ${e.reason}`); clearTimeout(timer); resolve("closed"); };
});
console.log("result:", await done);
console.log("events:", events.join(" | "));
try { ws.close(); } catch {}
