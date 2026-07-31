// Aufnahme der Szenen.
//
//   node video/record.js             alle
//   node video/record.js erststart   nur eine (der Erststart braucht einen
//                                    eigenen Durchgang, siehe aufnehmen.sh)
//
// Jede Szene wird als eigener Clip aufgenommen und schreibt ihre Marken mit.
// Der Schnitt (compose.js) rechnet daraus die Schnittzeiten aus.
const fs = require("fs");
const path = require("path");
const { launch, BASE } = require("./lib/capture");
const { SCENES } = require("./scenes");

const OUT = path.join(__dirname, "out", "raw");

async function login(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', "admin@bundwimmobilien.de");
  await p.fill('input[name="password"]', "BundW-Start2026!");
  await p.click('button[type="submit"]');
  await p.waitForURL(/dashboard/, { timeout: 20000 });
  await p.waitForTimeout(1200);
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function main() {
  const only = process.argv[2];
  if (!only) fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await launch();
  const state = await login(browser);

  for (const n of only ? [only] : Object.keys(SCENES)) {
    if (!SCENES[n]) throw new Error(`unbekannte Szene: ${n}`);
    await SCENES[n](browser, state);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
