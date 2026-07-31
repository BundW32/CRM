// Die Szenen — reine Aufnahmen der App.
//
// Was hier NICHT mehr passiert: Unterzeilen einblenden und Spotlights zeichnen.
// Beides war bis Fassung 3 ins Browserbild eingebrannt und hatte zwei Fehler
// zur Folge, die im fertigen Video sichtbar waren:
//
//   * Die Unterzeile klebte am Seiteninhalt und wurde von jeder Kamerafahrt
//     mitbeschnitten — Text lief aus dem Bild.
//   * Der Spotlight lief über CSS-Übergänge und wurde mit schwankender Bildrate
//     aufgenommen: sichtbar ruckelig.
//
// Beides gehört in die Nachbearbeitung. Die Aufnahme merkt sich nur noch die
// Rechtecke der Ziele (`zielBox`) und die Zeitpunkte (`clock.mark`); gezeichnet
// wird in Remotion, Bild für Bild.
//
// Im Bild bleiben nur Dinge, die es ohne Aufnahme nicht gäbe: der Mauszeiger,
// das Tippen, das Scrollen, die Reaktionen der Oberfläche.
const fs = require("fs");
const path = require("path");
const {
  newClip, installCursor, moveCursor, moveAndClick, humanType,
  zielBox, scrollFahrt, smoothScroll, BASE,
} = require("./lib/capture");

const OUT = path.join(__dirname, "out", "raw");

const PID = () => process.env.WEG_PROPERTY_ID;
const PLAN = () => process.env.WEG_PLAN_ID;
const MEETING = () => process.env.WEG_MEETING_ID;
const STATEMENT = () => process.env.WEG_STATEMENT_ID;

const FRAGE = "Wann ist die nächste Eigentümerversammlung?";

async function scene(browser, name, state, fn) {
  fs.rmSync(path.join(OUT, name), { recursive: true, force: true });
  const { context, page, clock } = await newClip(browser, path.join(OUT, name), { storageState: state });
  await fn(page, clock);
  clock.save();
  await context.close();
  console.log("fertig:", name);
}

async function ankommen(page, clock, url, wartenMs = 600) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(wartenMs);
  await installCursor(page);
  clock.mark("bereit");
}

const SCENES = {
  // ── 02 Jahresfahrplan ────────────────────────────────────────────────────
  // Drei Ziele, über die das Licht später wandert. Die Aufnahme steht dabei
  // ruhig — die Bewegung entsteht in der Nachbearbeitung und ist dort
  // bildgenau statt browserabhängig.
  async fahrplan(browser, state) {
    await scene(browser, "02-fahrplan", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/dashboard`, 700);
      // Immer die ganze Zeilenkarte (li), nicht den Textknoten: Ein Rahmen um
      // 172 Pixel Überschrift sieht aus wie ein Fehler, nicht wie Betonung.
      await zielBox(page, clock, "z1", 'li:has-text("Rauchwarnmelder prüfen")');
      await zielBox(page, clock, "z2", 'li:has-text("Jahresabrechnung 2025 erstellen")');
      await zielBox(page, clock, "z3", 'li:has-text("Hausgeld-Rückstände offen")');
      await page.waitForTimeout(4200);
      clock.mark("ende");
    });
  },

  // ── 05 Wirtschaftsplan ──────────────────────────────────────────────────
  async wirtschaftsplan(browser, state) {
    await scene(browser, "05-wirtschaftsplan", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/verwaltung/weg/${PID()}/wirtschaftsplan/${PLAN()}`, 800);
      await zielBox(page, clock, "muell", 'tr:has-text("Müllabfuhr")');
      await zielBox(page, clock, "treppe", 'tr:has-text("Treppenhausreinigung")');
      await page.waitForTimeout(3000);
      clock.mark("scroll_los");
      await scrollFahrt(page, 620, { ms: 1400, settle: 500 });
      clock.mark("unten");
      await page.waitForTimeout(1800);
      clock.mark("ende");
    });
  },

  // ── 06 Hausgeld ─────────────────────────────────────────────────────────
  async hausgeld(browser, state) {
    await scene(browser, "06-hausgeld", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/verwaltung/weg/${PID()}/hausgeld`, 700);
      clock.mark("scroll_los");
      await scrollFahrt(page, 640, { ms: 1500, settle: 400 });
      clock.mark("liste");
      await zielBox(page, clock, "summe", 'tr:has-text("Summe")');
      await page.waitForTimeout(3000);
      clock.mark("ende");
    });
  },

  // ── 07 Versammlung: Tagesordnung, dann sortiert ein Klick sie um ────────
  async versammlung(browser, state) {
    await scene(browser, "07-versammlung", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/versammlungen/${MEETING()}`, 800);
      await zielBox(page, clock, "top2", 'li:has-text("TOP 2:"), div:has-text("TOP 2:") >> nth=-1');
      await page.waitForTimeout(2600);
      clock.mark("scroll_los");
      await smoothScroll(page, 520, 900);
      await page.waitForTimeout(400);
      clock.mark("reihenfolge");
      await moveAndClick(page, 'li:has-text("Verschiedenes") button[aria-label*="oben"], ' +
        'li:has-text("Verschiedenes") button:has(svg)', { from: { x: 640, y: 300 } })
        .catch(() => page.waitForTimeout(400));
      await page.waitForTimeout(1700);
      clock.mark("ende");
    });
  },

  // ── 10 Jahresabrechnung: Abrechnungsspitze je Einheit, dann das PDF ──────
  async jahresabrechnung(browser, state) {
    await scene(browser, "10-jahresabrechnung", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/verwaltung/weg/${PID()}/jahresabrechnung/${STATEMENT()}`, 900);
      clock.mark("scroll_los");
      await scrollFahrt(page, 780, { ms: 1500, settle: 500 });
      clock.mark("spitze");
      await zielBox(page, clock, "spitze", 'tr:has-text("WE 01, EG links")');
      await page.waitForTimeout(2600);
      // Der Klick auf „PDF" öffnet die Einzelabrechnung als fertiges Dokument.
      clock.mark("pdf_klick");
      await moveAndClick(page, 'tr:has-text("WE 01, EG links") a:has-text("PDF")',
        { from: { x: 700, y: 300 } }).catch(() => {});
      await page.waitForTimeout(3200);
      clock.mark("ende");
    });
  },

  // ── 11 Beschluss-Sammlung: nummeriert, mit PDF-Export ───────────────────
  async sammlung(browser, state) {
    await scene(browser, "11-sammlung", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/beschluesse/sammlung`, 900);
      await zielBox(page, clock, "eintrag", 'li:has-text("Wirtschaftsplan 2026"), div:has-text("Nr. 3") >> nth=-1').catch(() => {});
      await page.waitForTimeout(2400);
      clock.mark("export");
      await moveAndClick(page, 'a:has-text("Als PDF exportieren"), button:has-text("Als PDF exportieren")',
        { from: { x: 640, y: 400 } }).catch(() => {});
      await page.waitForTimeout(2800);
      clock.mark("ende");
    });
  },

  // ── 12 Handy: dieselbe Abrechnung als PDF auf dem Telefon ───────────────
  // Eigene Aufnahmegröße: 390×844 wie ein Telefon, aufgenommen in doppelter
  // Auflösung. Im Schnitt sitzt das Bild in einem Telefonrahmen.
  async handy() {
    fs.rmSync(path.join(OUT, "12-handy"), { recursive: true, force: true });
    // Eigener Browser ohne den erzwungenen Skalierungsfaktor — sonst rechnet
    // die Seite mit ~780 Pixeln Breite und zeigt das Desktop-Layout.
    const { launchHandy } = require("./lib/capture");
    const browser = await launchHandy();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      // Aufnahmegröße = CSS-Größe des Fensters. Mit doppelter Größe blieb das
      // Bild rechts leer: Der Kontext-Skalierungsfaktor schlägt nicht auf die
      // Aufzeichnung durch, die Seite landete in der linken Hälfte.
      // Im Schnitt wird das Telefon ohnehin auf ~305 Pixel Breite gezeigt,
      // also verliert die Aufnahme dabei nichts.
      recordVideo: { dir: path.join(OUT, "12-handy"), size: { width: 390, height: 844 } },
      locale: "de-DE", timezoneId: "Europe/Berlin",
      isMobile: true, hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const { clock: uhr } = require("./lib/capture");
    const clock = uhr(path.join(OUT, "12-handy"));
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "eigentuemer@demo.de");
    await page.fill('input[name="password"]', "Demo-2026!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 20000 });
    await page.waitForTimeout(1200);
    clock.mark("drin");
    // Bewusst die Übersicht und das Menü statt der Finanzseite: Deren
    // Hausgeld-Tabelle ist breiter als 390 Pixel und wird am rechten Rand
    // abgeschnitten — im Video sieht das nach Fehler aus, obwohl die Tabelle
    // dort nur seitlich scrollt.
    await page.waitForTimeout(1400);
    clock.mark("uebersicht");
    await installCursor(page);
    await moveAndClick(page, 'button:has-text("Menü")', { from: { x: 195, y: 420 } }).catch(() => {});
    await page.waitForTimeout(1500);
    clock.mark("menue");
    await moveAndClick(page, 'a:has-text("Beschlüsse")', { from: { x: 60, y: 120 } }).catch(() => {});
    await page.waitForTimeout(2200);
    clock.mark("ende");
    clock.save();
    await context.close();
    await browser.close();
    console.log("fertig: 12-handy");
  },

  // ── 08 Rollenwechsel: dieselbe WEG aus Sicht einer Miteigentümerin ──────
  async rollen(browser) {
    fs.rmSync(path.join(OUT, "08-rollen"), { recursive: true, force: true });
    const { context, page, clock } = await newClip(browser, path.join(OUT, "08-rollen"), {});
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "eigentuemer@demo.de");
    await page.fill('input[name="password"]', "Demo-2026!");
    await page.waitForTimeout(400);
    await installCursor(page);
    await moveAndClick(page, 'button[type="submit"]', { from: { x: 640, y: 320 } });
    await page.waitForURL(/dashboard/, { timeout: 20000 });
    await page.waitForTimeout(1000);
    clock.mark("drin");
    await zielBox(page, clock, "menue", "aside, nav >> nth=0");
    await page.waitForTimeout(3000);
    clock.mark("ende");
    clock.save();
    await context.close();
    console.log("fertig: 08-rollen");
  },

  // ── 09 KI-Assistent ─────────────────────────────────────────────────────
  async ki(browser, state) {
    await scene(browser, "09-ki", state, async (page, clock) => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      await page.waitForTimeout(900);
      await installCursor(page);
      clock.mark("zeiger_los");
      await moveCursor(page, { x: 1245, y: 685 }, { from: { x: 690, y: 400 } });
      await page.waitForTimeout(140);
      await page.evaluate(([x, y]) => window.__pulseAt(x, y), [1245, 685]);
      await page.waitForTimeout(130);
      await page.locator('button[aria-label="Assistent öffnen"]').click();
      await page.waitForTimeout(850);
      clock.mark("offen");
      await zielBox(page, clock, "widget", '[role="dialog"]');
      await page.evaluate(() => window.__curHide());
      await humanType(page, "textarea", FRAGE);
      await page.waitForTimeout(650);
      clock.mark("getippt");
      await page.locator("textarea").press("Enter");
      await page.waitForTimeout(2500);
      clock.mark("antwort");
      // Die Quellen-Chips unter der Antwort — der eigentliche Beleg. Zwei
      // Rechtecke, weil die Chips Geschwister sind: Der Schnitt bildet daraus
      // die Vereinigung. Ein `nth=-1` erwischte vorher nur den unteren.
      await zielBox(page, clock, "quelle1", '[role="dialog"] a:has-text("Versammlung") >> nth=0').catch(() => {});
      await zielBox(page, clock, "quelle2", '[role="dialog"] a:has-text("Bedienhilfe") >> nth=-1').catch(() => {});
      await page.waitForTimeout(2400);
      clock.mark("ende");
    });
  },
};

module.exports = { SCENES };
