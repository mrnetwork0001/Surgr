// Renders deck/surgr-deck.html to deck/surgr-deck.pdf (16:9, 1920x1080 per slide) and PNGs per slide.
// Usage: node deck/render.mjs  (needs Playwright with Chromium; set PLAYWRIGHT_IMPORT to its index.mjs if not resolvable)
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync } from "node:fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const pw = await import(process.env.PLAYWRIGHT_IMPORT || "playwright");
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("file://" + path.join(here, "surgr-deck.html"), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.pdf({ path: path.join(here, "surgr-deck.pdf"), width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
mkdirSync(path.join(here, "png"), { recursive: true });
const n = await page.locator("section.slide").count();
for (let i = 0; i < n; i++) {
  await page.locator("section.slide").nth(i).screenshot({ path: path.join(here, "png", `slide-${String(i + 1).padStart(2, "0")}.png`) });
}
console.log("rendered", n, "slides");
await browser.close();
