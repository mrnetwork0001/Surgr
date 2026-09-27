# Surgr: Real-Time Operating Room Audio Compliance & Closed-Loop Surgical Copilot

## Executive Overview
**Surgr** is an operating room audio-compliance platform and real-time verbal safety copilot built for the **AssemblyAI Voice Agent Hackathon** on Lablab.ai ($10,000 Prize Pool).

Surgr solves a multi-billion dollar healthcare safety crisis—surgical errors and wrong-site operations—by integrating **AssemblyAI Real-Time WebSocket Streaming STT**, **Speaker Diarization**, and the **LeMUR LLM Audio Intelligence Engine**. Surgr listens to operating room microphones live, enforces WHO Surgical Safety Checklists, verifies closed-loop verbal read-backs between surgeons and anesthesiologists in real-time, and automatically generates audit-ready post-operative EHR reports.

---

## Technical Architecture & AssemblyAI Stack

```
+-------------------------------------------------------------------+
|               Ambient Operating Room Microphones                  |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|     AssemblyAI Real-Time Streaming WebSocket & Diarization      |
|    (Separating Surgeon, Anesthesiologist, and Scrub Nurse)       |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|        Closed-Loop Verbal Read-Back State Machine                 |
| (Verifying Drug Orders vs. Anesthesiologist Confirmation)        |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|      AssemblyAI LeMUR LLM Post-Op EHR Exporter                    |
|  (Audit-Ready Timestamped Hospital Records with Source Audio)    |
+-------------------------------------------------------------------+
```

### 1. AssemblyAI Real-Time Streaming & Diarization Layer
- **WebSocket Streaming:** Sub-second, low-latency audio transcription directly from ambient surgical room microphones.
- **Speaker Diarization:** Multi-speaker classification identifying and tagging the **Surgeon**, **Anesthesiologist**, and **Scrub Nurse** in real-time.

### 2. Closed-Loop Communication Verifier (Read-Back Engine)
- **Mechanism:** Listens for surgical drug orders (e.g. Surgeon: *"Administer 50mg Propofol"*).
- **Verification State Machine:** Expects the Anesthesiologist's explicit read-back (*"50mg Propofol confirmed"*).
- **Safety Interception:** If a dose is read back wrong or an order remains unconfirmed for >10 seconds, Surgr emits a sub-400ms audio warning into the operating room speaker.

### 3. WHO Surgical Safety Checklist Automation
- **Sign In / Time Out / Sign Out:** Automatically tracks and checks off mandatory WHO surgical checklist items as the team speaks them out loud.

### 4. AssemblyAI LeMUR Post-Op EHR Exporter
- **Role:** Uses AssemblyAI LeMUR LLM Q&A & Summarization to convert operating room audio transcripts into structured, audit-ready hospital EHR documentation where every line links to exact audio timestamps.

---

## UI/UX & Operating Room Cockpit Specification

- **Multi-Speaker Transcript Feed**: Color-coded real-time transcript sharding (Blue: Surgeon, Purple: Anesthesiologist, Green: Nurse).
- **Closed-Loop Order Board**: Live tracker of active verbal drug orders, confirmation status, and read-back timestamps.
- **WHO Checklist Gauge**: Automated checklist completion matrix.
- **Interactive OR Audio Simulator**: Controls allowing hackathon judges to trigger simulated surgical drug orders, test correct vs. incorrect read-backs, and export LeMUR EHR reports live.

---

## Setup & Environment
1. Configure `ASSEMBLYAI_API_KEY` in `.env.local`.
2. Run `npm install && npm run dev`.
