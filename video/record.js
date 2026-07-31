// Aufnahme aller Szenen der Endfassung.
//
//   node video/record.js            alle Szenen
//   node video/record.js erststart  nur diese eine (für den zweiten Durchgang,
//                                   in dem die Einrichtung unvollständig ist)
//
// Jede Szene wird als eigener Clip aufgenommen. Der Schnitt (video/compose.sh)
// nimmt daraus Ausschnitte — deshalb hält jede Szene am Ende bewusst still.
const fs = require("fs");
const path = require("path");
const {
  launch, newClip, installCursor, moveCursor, clickAt, humanType,
  installCaption, caption, smoothScroll, BASE,
} = require("./lib/capture");

const OUT = path.join(__dirname, "out", "raw");
const CARD = "file://" + path.join(__dirname, "cards", "card.html");
const card = (t, kind = "hook") => `${CARD}?kind=${kind}&t=${encodeURIComponent(t)}`;

const PID = process.env.WEG_PROPERTY_ID;
const PLAN = process.env.WEG_PLAN_ID;
const MEETING = process.env.WEG_MEETING_ID;
const FRAGE = "Wann ist die nächste Eigentümerversammlung?";

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

// Jede Szene: Seite öffnen, zur Ruhe kommen lassen, Unterzeile, dann still halten.
async function scene(browser, name, state, fn) {
  const { context, page, clock } = await newClip(browser, path.join(OUT, name), { storageState: state });
  await fn(page, clock);
  clock.save();
  await context.close();
  console.log("fertig:", name);
}

// Unterzeile zeigen, stehen lassen, ausblenden — und dabei mitschreiben, wann
// sie sichtbar war. „ruhe" markiert den Zeitpunkt, ab dem das Bild frei ist:
// erst danach darf eine Zoomfahrt in den Ausschnitt gehen.
async function untertitel(page, clock, text, ruheMs = 1500) {
  clock.mark("cap_an");
  await caption(page, text, { keep: true });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__capOff());
  await page.waitForTimeout(450);          // Ausblenden abwarten
  clock.mark("cap_aus");
  await page.waitForTimeout(ruheMs);
  clock.mark("ruhe");
}

const SCENES = {
  // ── 01 Hook-Tafel ────────────────────────────────────────────────────────
  async hook(browser) {
    const { context, page } = await newClip(browser, path.join(OUT, "01-hook"));
    await page.goto(card("Keine Hausverwaltung gefunden?|Die *Pflichten* bleiben."));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__play());
    await page.waitForTimeout(3400);
    await context.close();
    console.log("fertig: 01-hook");
  },

  // ── 02 Jahresfahrplan: was ist jetzt dran ───────────────────────────────
  async fahrplan(browser, state) {
    await scene(browser, "02-fahrplan", state, async (page, clock) => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1600);
      await installCaption(page);
      clock.mark("ruhig");
      await untertitel(page, clock, "Das Portal sagt Ihnen, was *jetzt* dran ist.", 2200);
    });
  },

  // ── 03 Geführter Erststart (Einrichtung unvollständig!) ─────────────────
  async erststart(browser, state) {
    await scene(browser, "03-erststart", state, async (page, clock) => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      await installCaption(page);
      clock.mark("ruhig");
      await untertitel(page, clock, "Acht Schritte. *Einer nach dem anderen.*", 2200);
    });
  },

  // ── 04 Wirtschaftsplan: Verteilung nach dem richtigen Schlüssel ─────────
  async wirtschaftsplan(browser, state) {
    await scene(browser, "04-wirtschaftsplan", state, async (page, clock) => {
      await page.goto(`${BASE}/verwaltung/weg/${PID}/wirtschaftsplan/${PLAN}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1600);
      await installCaption(page);
      clock.mark("ruhig");
      // Ruhe für die Zufahrt auf die Spalte „Umlageschlüssel", bevor gescrollt
      // wird: der Ausschnitt braucht ein Fenster ohne Unterzeile und ohne Bewegung.
      await untertitel(page, clock, "Verteilt nach dem *richtigen Schlüssel.*", 2800);
      await smoothScroll(page, 430, 1000);
      clock.mark("gescrollt");
      await page.waitForTimeout(2200);
    });
  },

  // ── 05 Hausgeld: wer hat gezahlt, wer nicht ─────────────────────────────
  async hausgeld(browser, state) {
    await scene(browser, "05-hausgeld", state, async (page, clock) => {
      await page.goto(`${BASE}/verwaltung/weg/${PID}/hausgeld`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      await smoothScroll(page, 620, 900);
      await page.waitForTimeout(900);
      await installCaption(page);
      clock.mark("ruhig");
      await untertitel(page, clock, "Wer gezahlt hat — und *wer nicht.*", 2400);
    });
  },

  // ── 06 Versammlung: Tagesordnung mit Paragraphen ────────────────────────
  async versammlung(browser, state) {
    await scene(browser, "06-versammlung", state, async (page, clock) => {
      await page.goto(`${BASE}/versammlungen/${MEETING}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1600);
      await installCaption(page);
      clock.mark("ruhig");
      await untertitel(page, clock, "Beschlüsse, *die halten.*", 2400);
    });
  },

  // ── 07 KI-Assistent: der Beleg ──────────────────────────────────────────
  async ki(browser, state) {
    await scene(browser, "07-ki", state, async (page, clock) => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1400);
      await installCursor(page);
      clock.mark("zeiger_los");
      await moveCursor(page, { x: 1245, y: 685 }, { from: { x: 690, y: 400 } });
      await page.waitForTimeout(160);
      await clickAt(page, 'button[aria-label="Assistent öffnen"]');
      await page.waitForTimeout(900);
      clock.mark("offen");
      await page.evaluate(() => window.__curHide());
      await humanType(page, "textarea", FRAGE);
      await page.waitForTimeout(700);          // Pause vor dem Absenden
      clock.mark("getippt");
      await page.locator("textarea").press("Enter");
      await page.waitForTimeout(2600);         // Denkpause + Antwort erscheint
      clock.mark("antwort");
      await page.waitForTimeout(2600);         // Stillstand auf der Antwort
    });
  },

  // ── 08 Endtafel ─────────────────────────────────────────────────────────
  async cta(browser) {
    const { context, page } = await newClip(browser, path.join(OUT, "08-cta"));
    await page.goto(card("Ihre Gemeinschaft.|*Ihre Zahlen.*", "cta"));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__play());
    await page.waitForTimeout(3400);
    await context.close();
    console.log("fertig: 08-cta");
  },
};

async function main() {
  const only = process.argv[2];
  if (!only) fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await launch();
  const state = await login(browser);

  const names = only ? [only] : Object.keys(SCENES);
  for (const n of names) {
    if (!SCENES[n]) throw new Error(`unbekannte Szene: ${n}`);
    await SCENES[n](browser, state);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
