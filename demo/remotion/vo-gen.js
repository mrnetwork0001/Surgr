// Narration for the Surgr demo film, generated with ElevenLabs *with timestamps*, so every
// graphic is cued to the word that names it rather than hand-timed.
//   node vo-gen.js              all sections
//   VO_ONLY=03 node vo-gen.js   one section
// Writes public/vo/vNN.mp3 and src/vo/vNN.json. The key is read from an env file outside this repo.
const fs = require('fs')
const { tts } = require('./scripts/tts.cjs')

// Matilda: a calm, professional narrator, deliberately unlike Surgr's own alert voice.
const VOICE = process.env.NARRATOR_VOICE || 'XrExE9yKIg1WjnnlVkGX'

// "Surger" is a spelling for the voice only, so the name is said the way it is meant.
// "W H O" makes the voice spell the organisation instead of saying "who".
const SECTIONS = [
  ['00', "Surger. Every verbal order in the operating room, verified out loud."],
  ['01', "In surgery, drugs are ordered by voice. The surgeon asks for one hundred micrograms of fentanyl. Anesthesia hears ten. The rule is to read it back. But under pressure, it gets skipped, or misheard. And nothing beeps."],
  ['02', "About one in twenty surgical medication doses involves an error. Two thirds of serious incidents involve a communication breakdown. Aviation made read-backs mandatory. Operating rooms still run on memory."],
  ['03', "Surger listens to the room. Each order gets ten seconds to be read back. It checks drug, dose, unit and route. And the moment a loop stays open, it says so, out loud."],
  ['04', "Here is Surger, listening to a live microphone. Two synthetic clinician voices. Watch the dose."],
  ['05', "Speaker labels told the voices apart. Surger compared the dose, and only a correct read-back closed the loop."],
  ['06', "Now, an order that nobody answers."],
  ['07', "Ten seconds, and Surger calls it. The room can ask it questions too, answered through tool calls."],
  ['08', "The W H O surgical safety checklist is heard the same way. End a Time Out with items missing, and Surger lists them."],
  ['09', "When the case ends, the record is already written. Every order and alert, timestamped. Download a PDF, send it to Telegram, or hear the debrief."],
  ['10', "Under the hood, four AssemblyAI products in one loop. Streaming in medical mode, speaker labels, the LLM Gateway, and the Voice Agent API. Every integration verified against the live services."],
  ['11', "The anesthesiologist gets a second check before the dose goes in. Quality teams get closed-loop data for every room. Surger starts in simulation labs, then silent analytics, then live intervention. Priced per operating room."],
  ['12', "Aviation cockpits have mandatory read-backs, and a voice recorder. Operating rooms have neither. Surger gives them both."],
]

const only = process.env.VO_ONLY ? process.env.VO_ONLY.replace(/^v/, '') : null
const todo = SECTIONS.filter(([id]) => !only || id === only)
console.log('characters:', todo.reduce((n, s) => n + s[1].length, 0), 'in', todo.length, 'sections')
fs.mkdirSync('public/vo', { recursive: true })
fs.mkdirSync('src/vo', { recursive: true })
;(async () => {
  for (const [id, text] of todo) {
    try {
      const { audio, words } = await tts(text, VOICE)
      fs.writeFileSync(`public/vo/v${id}.mp3`, audio)
      fs.writeFileSync(`src/vo/v${id}.json`, JSON.stringify({ text, words }) + '\n')
      console.log(`${id}: ${(audio.length / 1024).toFixed(0)}kb, ${words.length} words, ends ${words.at(-1).e.toFixed(2)}s`)
    } catch (e) { console.error(`v${id}: ${e.message}`) }
  }
  const total = fs.readdirSync('src/vo').filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(`src/vo/${f}`, 'utf8')).words.at(-1).e).reduce((a, b) => a + b, 0)
  console.log(`total speech: ${total.toFixed(1)}s`)
})()
