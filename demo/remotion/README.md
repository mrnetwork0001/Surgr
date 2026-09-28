# The Surgr demo film

A four-and-a-half-minute film, rendered with [Remotion](https://remotion.dev), that starts with the problem and ends on the product in use. Every app shot is a real recording of the cockpit running against the live AssemblyAI services. Nothing on screen in the live segments is mocked.

## How the live take works

The browser's microphone is `public/voices/take.wav`: eight lines for a surgeon, an anesthesiologist and a scrub nurse, generated with three distinct ElevenLabs voices and laid out with pauses sized for Surgr's alerts. Chrome plays it as a fake capture device, so:

- AssemblyAI Streaming (medical mode, speaker labels) transcribes it live and separates the three voices;
- the cockpit opens orders, raises the dose-mismatch, no-read-back and Time Out alerts, and ticks the checklist on its own;
- the Voice Agent speaks each alert and answers "Surgr, what is still open?" through its tools.

Surgr's own voice in the film is the Voice Agent's audio, rebuilt from the websocket messages the page received, placed at the moment it arrived. The film says plainly that the clinicians are synthetic voices, and every cut in a live segment shows how many seconds of network waiting it removed.

## Pipeline

| Stage | Command | What it does |
|---|---|---|
| Narration | `npm run vo` | Thirteen lines to ElevenLabs with word timestamps (`public/vo/`, `src/vo/`). "Surger" is a spelling for the voice only. |
| The take | `npm run voices` | The clinicians' lines in three voices, assembled into `public/voices/take.wav` with `src/take.json`. |
| Sound | `npm run sfx` | Effects and a four-minute music bed from ElevenLabs' sound and music endpoints (`public/sfx/`). |
| Capture | `npm run capture` | Drives the production build with Playwright, the take as the microphone. Writes `public/clips/*.mp4` (3200x1800), `public/agent/*.wav` (Surgr's voice and the aligned take) and `src/clips.json` (every cockpit event and element rectangle over time). |
| Timing | `npx tsx scripts/timeline.ts` | Prints scene starts and the live cut points. |
| Render | `npm run render` | 1920x1080 H.264, then loudness to -14 LUFS without touching the video stream. |

`src/beats.ts` derives the live cuts, audible ranges, captions and camera views from `clips.json`, so re-filming the take re-times the film with no hand edits. Camera views end in the gaps between the cockpit's panels so nothing is cut mid-word.

## Running it

```bash
npm install
npm run vo && npm run voices && npm run sfx      # once; ElevenLabs key read from an env file outside the repo
(cd ../.. && npm run build && npx next start -p 3002) &
npm run capture                                   # APP_URL=... to film another deployment
npm run render
```

The capture needs a steady connection; on a slow one the script refuses to record an empty take rather than guessing.
