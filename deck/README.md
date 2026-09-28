# Surgr pitch deck

Two sources, same 13 slides:

- `surgr-deck.pptx` — the editable deck (16:9, 13.33 × 7.5 in). Open it in PowerPoint, Keynote or Google Slides (File → Import) and edit freely. The wordmark is a fixed 1.6-inch image in the same place on every slide. Speaker notes on each slide carry the talking points.
- `surgr-deck.html` → `surgr-deck.pdf` — the web-styled render (Instrument Serif and Barlow), plus `png/` with one PNG per slide for the video.

Rebuild after editing:

```bash
node deck/build-pptx.mjs                                             # writes deck/surgr-deck.pptx (needs the pptxgenjs dev dependency)
PLAYWRIGHT_IMPORT=/path/to/node_modules/playwright/index.mjs node deck/render.mjs   # writes deck/surgr-deck.pdf and png/
```

Fonts in the .pptx are Cambria (italic headings), Calibri (body) and Courier New (labels), which ship with Office and Google Slides. Install Instrument Serif and Barlow and change the font names in `build-pptx.mjs` to match the website exactly.

Images in `img/` are captures from the running app (cockpit, Ask Surgr card, operative record), the wordmark, and four rendered glow backgrounds.
