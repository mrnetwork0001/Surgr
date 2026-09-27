// Verifies the Voice Agent path Surgr uses: token -> ws -> session.update -> session.ready -> reply.create -> audio.
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1).trim()]));
const key = env.ASSEMBLYAI_API_KEY;
if (!key) throw new Error("no key");

const tokRes = await fetch("https://agents.assemblyai.com/v1/token?expires_in_seconds=120", { headers: { Authorization: `Bearer ${key}` } });
const tok = await tokRes.json();
console.log("token:", tokRes.status, tok.token ? "ok" : JSON.stringify(tok));

const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(tok.token)}`);
const events = [];
let audioBytes = 0;
let agentText = "";
const done = new Promise((resolve) => {
  const timer = setTimeout(() => resolve("timeout"), 25000);
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === "reply.audio") audioBytes += Buffer.from(m.data, "base64").length;
    else events.push(m.type + (m.message ? `: ${m.message}` : ""));
    if (m.type === "transcript.agent") agentText = m.text;
    if (m.type === "session.ready") {
      ws.send(JSON.stringify({ type: "reply.create", instructions: 'Speak this safety alert verbatim, exactly as written, and nothing else: "Safety alert. Read-back dose mismatch. The surgeon ordered 100 micrograms fentanyl. Anesthesia read back 10 micrograms. Please stop and re-confirm."' }));
    }
    if (m.type === "reply.done") { clearTimeout(timer); ws.send(JSON.stringify({ type: "session.end" })); }
    if (m.type === "session.ended") resolve("ended");
  };
  ws.onerror = () => { events.push("ws error"); };
  ws.onclose = (e) => { events.push(`close ${e.code} ${e.reason}`); clearTimeout(timer); resolve("closed"); };
});
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "session.update", session: { system_prompt: "You are Surgr, the operating room safety alert voice. You never greet or add commentary. When instructed, speak the alert text exactly, then stop.", input: { format: { encoding: "audio/pcm" } }, output: { voice: "george", format: { encoding: "audio/pcm" }, volume: 100 } } }));
};
const result = await done;
console.log("result:", result);
console.log("events:", events.join(" | "));
console.log("agent said:", JSON.stringify(agentText));
console.log("audio bytes:", audioBytes, `(~${(audioBytes / 2 / 24000).toFixed(1)} s at 24 kHz)`);
try { ws.close(); } catch {}
