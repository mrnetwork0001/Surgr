# Surgr pitch deck

`surgr-deck.html` is the source (13 slides, 1920×1080). `surgr-deck.pdf` is the rendered submission deck; `png/` holds one PNG per slide for the video.

Re-render after editing the HTML:

```bash
PLAYWRIGHT_IMPORT=/path/to/node_modules/playwright/index.mjs node deck/render.mjs
```

Images in `img/` are captures from the running app (cockpit, Ask Surgr card, operative record) plus the wordmark.
