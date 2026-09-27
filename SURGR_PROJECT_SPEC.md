# Surgr: Real-Time Operating Room Audio Compliance & Closed-Loop Surgical Copilot

## Executive Overview
**Surgr** is an operating room audio-compliance platform and real-time verbal safety copilot built for the **AssemblyAI Voice Agent Hackathon** on Lablab.ai (Sept 1–30, 2026, $10,000 prize pool: $5k cash + $5k AssemblyAI credits).

Surgr solves a multi-billion dollar healthcare safety crisis—surgical errors, wrong-dose drug orders and wrong-site operations—by listening to operating room microphones live, enforcing WHO Surgical Safety Checklists, verifying closed-loop verbal read-backs between surgeons and anesthesiologists in real time, speaking a warning into the room when a read-back is missing or wrong, and automatically generating audit-ready post-operative EHR reports.

---

## Verified AssemblyAI Stack (checked against docs on 2026-09-27)

> LeMUR no longer appears in AssemblyAI's docs. Its role is now filled by the **LLM Gateway**. Spoken warnings use the new **Voice Agent API**. Do not build against LeMUR.

| Surgr layer | AssemblyAI product | Key parameters |
|---|---|---|
| Live OR transcription | Streaming STT v3, `wss://streaming.assemblyai.com/v3/ws` | `speech_model: "universal-3-6-pro"`, `sample_rate: 16000`, `format_turns: true` |
| Who is speaking | Streaming speaker labels (true mono diarization) | `speaker_labels: true`, `max_speakers: 4`; Turn gets `speaker_label`, words get `speaker` |
| Drug / dose accuracy | Streaming medical mode + keyterms | `domain: "medical-v1"`, `keyterms_prompt: [...]` (max 100 terms), `prompt: "..."` |
| Per-turn understanding | LLM Gateway, `https://llm-gateway.assemblyai.com/v1/chat/completions` (OpenAI-compatible) | Claude models (e.g. `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`), `response_format: json_schema`, `post_processing_steps: [{type: "json-repair"}]` |
| Spoken warning into the OR | Voice Agent API, `wss://agents.assemblyai.com/v1/ws` | `session.update` with inline config; force speech with `reply.create { instructions }` and `conversation.message { role: "system" }` |
| Browser auth | Temporary tokens minted server-side | `GET https://streaming.assemblyai.com/v3/token` and `GET https://agents.assemblyai.com/v1/token`, `expires_in_seconds` ≤ 600 |
| Post-op EHR report | LLM Gateway with structured outputs over the full timestamped transcript | Every line links to word `start`/`end` ms from the Turn messages |

Optional streaming extras worth demoing: `voice_focus: true` (background noise), `redact_pii: true` (patient names in the exported report), `llm_gateway` connection param (server-side LLM call on every formatted turn without a second round trip).

---

## Technical Architecture

```
+-------------------------------------------------------------------+
|        Ambient OR microphone (browser mic or simulated audio)      |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|   AssemblyAI Streaming v3: universal-3-6-pro + medical-v1 domain   |
|   speaker_labels (Surgeon / Anesthesiologist / Scrub Nurse)        |
|   keyterms_prompt (drug names, doses, checklist phrases)           |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|   Closed-Loop Read-Back State Machine (per formatted Turn)         |
|   LLM Gateway structured output -> {order | readback | checklist}  |
|   Deterministic matcher: drug + dose + unit + route + speaker role |
+---------------------------------+---------------------------------+
                  |                                   |
                  v                                   v
+-----------------------------+   +---------------------------------+
| Voice Agent API (warning    |   | LLM Gateway EHR Exporter        |
| speaker): reply.create with |   | (audit-ready JSON/PDF, each     |
| instructions on mismatch or |   | line linked to audio timestamps)|
| >10s unconfirmed order      |   +---------------------------------+
+-----------------------------+
```

### 1. Streaming & Diarization Layer
- **WebSocket streaming** from the browser using a temporary token (never the API key).
- **Speaker labels** arrive as letters (A, B, C). Surgr maps letters to roles the first time each speaker says a role phrase ("this is Dr. X, surgeon") or via a one-click role assignment in the cockpit. Turns under ~1 s come back as `PENDING`; overlapping speech is assigned to one speaker.
- **Medical mode** (`domain: "medical-v1"`) formats drug names generically with brand in parentheses and improves dose recognition. Recommended silence settings for clinicians: `min_turn_silence: 800`, `max_turn_silence: 3600`.

### 2. Closed-Loop Communication Verifier (Read-Back Engine)
- **Classify each formatted turn** with an LLM Gateway structured-output call into `drug_order`, `read_back`, `checklist_item`, `count`, or `other`, extracting `{drug, dose, unit, route, speaker_role}`.
- **State machine**: an open order expects a read-back from a different speaker within 10 s with matching drug and dose. Mismatch or timeout → `ALERT`.
- **Safety interception**: on `ALERT`, Surgr sends `reply.create` with explicit instructions to the Voice Agent session, which speaks the warning into the room (e.g. "Read-back mismatch: surgeon ordered fifty milligrams propofol, anesthesia confirmed fifteen. Please re-confirm."). Target under 400 ms from decision to first audio chunk.

### 3. WHO Surgical Safety Checklist Automation
- **Sign In / Time Out / Sign Out** phases with the standard items (patient identity, site, procedure, consent, allergies, antibiotic prophylaxis, instrument counts, specimen labelling).
- Items check off as the team speaks them; the copilot can prompt for skipped items at phase boundaries.

### 4. Post-Op EHR Exporter
- After `session.end`, Surgr sends the full transcript (with speaker roles and word timestamps) to the LLM Gateway with a JSON schema for an operative note: medications administered (with order and confirmation timestamps), checklist completion, alerts raised, and unresolved items.
- Export as JSON and a printable report; each entry carries the audio `start`/`end` ms so an auditor can jump to the exact moment.

---

## UI/UX & Operating Room Cockpit Specification

- **Multi-Speaker Transcript Feed**: color-coded real-time transcript (Blue: Surgeon, Purple: Anesthesiologist, Green: Nurse), partial turns shown faded, formatted turns solid.
- **Closed-Loop Order Board**: live tracker of active verbal drug orders, confirmation status, countdown to the 10 s deadline, and read-back timestamps.
- **WHO Checklist Gauge**: completion matrix per phase.
- **Alert Banner + Voice**: visual alert synchronized with the spoken warning from the Voice Agent.
- **Interactive OR Audio Simulator**: judges can play scripted scenarios (correct read-back, wrong dose, no read-back, skipped checklist item) through the pipeline without a live team in the room, then export the EHR report.

---

## Hackathon Submission Requirements (lablab.ai)
- Public GitHub repo, live app URL (Vercel), MP4 demo video ≤ 5 minutes, PDF slide deck, 16:9 cover image, short description ≤ 255 chars, long description ≥ 100 words.
- Judged on four equal criteria: Presentation, Business Value, Application of Technology, Originality. Slides should include TAM/SAM, revenue streams, competitor analysis, and future plans to score 4+ on Presentation and Business Value.
- Deadline: September 30, 2026.

---

## Setup & Environment
1. Configure `ASSEMBLYAI_API_KEY` in `.env.local`.
2. Run `npm install && npm run dev`.
