// Nimmt eine CSS-Animation Bild für Bild auf. Die Animationen werden angehalten
// und je Frame exakt positioniert – dadurch ist die Aufnahme deterministisch und
// unabhängig davon, wie schnell der Rechner rendert.
//
//   node capture.mjs intro.html frames/intro 4.2 30
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [file, outDir, durStr, fpsStr] = process.argv.slice(2);
if (!file || !outDir) {
  console.error("Aufruf: node capture.mjs <datei.html> <ausgabeordner> [sekunden] [fps]");
  process.exit(1);
}
const duration = Number(durStr ?? 4);
const fps = Number(fpsStr ?? 30);
const frames = Math.round(duration * fps);
const out = path.resolve(outDir);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
await page.goto(new URL(file, import.meta.url).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

for (let i = 0; i < frames; i++) {
  const t = (i / fps) * 1000;
  await page.evaluate((ms) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = ms;
    }
  }, t);
  await page.screenshot({ path: path.join(out, `f${String(i).padStart(4, "0")}.png`) });
}

await browser.close();
console.log(`${frames} Bilder in ${out}`);
