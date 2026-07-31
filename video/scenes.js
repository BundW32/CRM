// Die Szenen der Endfassung.
//
// Leitgedanke nach der ersten Fassung: Die KI-Szene wirkte, weil dort etwas
// PASSIERT — ein Zeiger fährt, jemand tippt, eine Antwort erscheint. Alle
// anderen Szenen waren Standbilder mit einem Hauch Zoom und damit tot.
// Deshalb gilt jetzt für jede Szene:
//
//   * Der Zuschauer sieht eine Hand arbeiten: Zeiger, Klick, Tastenkürzel.
//   * Seitenwechsel passieren im Bild, nicht zwischen zwei Schnitten. Dadurch
//     fühlt sich das Video wie EINE Sitzung an und nicht wie eine Sammlung
//     zusammenhangloser Bildschirmfotos.
//   * Bewegung im Bild statt Bewegung der Kamera: Scrollfahrten mit
//     Tempowechsel, Spotlight auf die entscheidende Zeile. Ein Spotlight
//     erzeugt den Blickfang, für den man sonst so stark zoomen müsste, dass
//     die Beschriftungen wegfallen.
const fs = require("fs");
const path = require("path");
const {
  newClip, installCursor, moveCursor, moveAndClick, humanType,
  installCaption, caption, spotlight, spotlightOff, scrollFahrt, smoothScroll, BASE,
} = require("./lib/capture");

const OUT = path.join(__dirname, "out", "raw");
const CARD = "file://" + path.join(__dirname, "cards", "card.html");
const card = (t, kind = "hook") => `${CARD}?kind=${kind}&t=${encodeURIComponent(t)}`;

const PID = () => process.env.WEG_PROPERTY_ID;
const PLAN = () => process.env.WEG_PLAN_ID;
const MEETING = () => process.env.WEG_MEETING_ID;

const FRAGE = "Wann ist die nächste Eigentümerversammlung?";

async function scene(browser, name, state, fn) {
  // Ordner leeren: Playwright legt je Lauf eine neue Datei an, und ein
  // Einzellauf hätte sonst zwei Aufnahmen nebeneinander — der Schnitt griffe
  // dann womöglich die alte.
  fs.rmSync(path.join(OUT, name), { recursive: true, force: true });
  const { context, page, clock } = await newClip(browser, path.join(OUT, name), { storageState: state });
  await fn(page, clock);
  clock.save();
  await context.close();
  console.log("fertig:", name);
}

// Unterzeile zeigen und wieder ausblenden, mit Marken für den Schnitt.
async function untertitel(page, clock, text, ruheMs = 1200) {
  clock.mark("cap_an");
  await caption(page, text, { keep: true });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__capOff());
  await page.waitForTimeout(450);
  clock.mark("cap_aus");
  await page.waitForTimeout(ruheMs);
}

// Jede Produktszene beginnt gleich: ankommen, Zeiger bereitstellen.
async function ankommen(page, clock, url, wartenMs = 1500) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(wartenMs);
  await installCursor(page);
  await installCaption(page);
  clock.mark("bereit");
}

const SCENES = {
  // ── 01 Hook ──────────────────────────────────────────────────────────────
  async hook(browser) {
    fs.rmSync(path.join(OUT, "01-hook"), { recursive: true, force: true });
    const { context, page } = await newClip(browser, path.join(OUT, "01-hook"));
    await page.goto(card("Keine Hausverwaltung gefunden?|Die *Pflichten* bleiben."));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__play());
    await page.waitForTimeout(3200);
    await context.close();
    console.log("fertig: 01-hook");
  },

  // ── 02 Jahresfahrplan: der Spotlight wandert die Liste hinunter ──────────
  // Statt eines Zooms auf einen Punkt wandert das Licht über drei Zeilen —
  // überfällig, überfällig, in einem Tag. Das erzählt die Dringlichkeit,
  // ohne dass ein Wort nötig wäre.
  async fahrplan(browser, state) {
    await scene(browser, "02-fahrplan", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/dashboard`, 1700);
      await untertitel(page, clock, "Das Portal sagt Ihnen, was *jetzt* dran ist.", 400);

      clock.mark("spot1");
      await spotlight(page, 'a:has-text("Rauchwarnmelder prüfen"), div:has-text("Rauchwarnmelder prüfen") >> nth=-1', { wait: 900 });
      clock.mark("spot2");
      await spotlight(page, 'text=Jahresabrechnung 2025 erstellen', { wait: 900 });
      clock.mark("spot3");
      await spotlight(page, 'text=Hausgeld-Rückstände offen', { wait: 1100 });
      await spotlightOff(page);
      clock.mark("spot_aus");
      await page.waitForTimeout(700);
    });
  },

  // ── 03 Erststart: durch die acht Schritte scrollen ───────────────────────
  // Der Zuschauer soll sehen, dass es wirklich acht sind und dass drei schon
  // erledigt sind — das geht nur, wenn die Liste sich bewegt.
  async erststart(browser, state) {
    await scene(browser, "03-erststart", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/dashboard`, 1600);
      await untertitel(page, clock, "Acht Schritte. *Einer nach dem anderen.*", 300);
      clock.mark("spot");
      await spotlight(page, 'text=Unterlagen der bisherigen Verwaltung anfordern >> nth=0', { wait: 1100 });
      await spotlightOff(page);
      clock.mark("scroll_los");
      await scrollFahrt(page, 700, { ms: 1900, settle: 900 });
      clock.mark("unten");
      await page.waitForTimeout(900);
    });
  },

  // ── 04 Kommandopalette: Strg+K, tippen, springen ─────────────────────────
  // Der zweite WOW-Moment neben dem Assistenten: Eingabe → sofortiger Sprung.
  // Tippen ist im Video die stärkste Form von „hier passiert etwas".
  async palette(browser, state) {
    await scene(browser, "04-palette", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/dashboard`, 1500);
      await untertitel(page, clock, "*Suchen* statt klicken.", 200);

      clock.mark("strg_k");
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(750);
      clock.mark("offen");
      // „Muster" trifft die Daten, nicht nur die Menüpunkte — die Palette
      // durchsucht für Verwalter auch den Bestand. Genau das ist der Effekt:
      // Der Zuschauer sieht, dass gesucht und nicht geblättert wird.
      await humanType(page, 'input[aria-label="Suchbegriff"]', "Musterstraße");
      await page.waitForTimeout(900);
      clock.mark("getippt");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2200);
      clock.mark("gesprungen");
      await page.waitForTimeout(1200);
    });
  },

  // ── 05 Wirtschaftsplan: Spotlight auf die Schlüssel, dann Scrollfahrt ────
  async wirtschaftsplan(browser, state) {
    await scene(browser, "05-wirtschaftsplan", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/verwaltung/weg/${PID()}/wirtschaftsplan/${PLAN()}`, 1600);
      await untertitel(page, clock, "Verteilt nach dem *richtigen Schlüssel.*", 300);

      // Drei verschiedene Schlüssel in drei Zeilen — genau das ist der Punkt.
      clock.mark("spot1");
      await spotlight(page, 'tr:has-text("Müllabfuhr")', { wait: 1000 });
      clock.mark("spot2");
      await spotlight(page, 'tr:has-text("Treppenhausreinigung")', { wait: 1000 });
      await spotlightOff(page);

      clock.mark("scroll_los");
      await scrollFahrt(page, 620, { ms: 1700, settle: 700 });
      clock.mark("unten");
      await page.evaluate(() => window.__cap("Daraus entsteht das *Hausgeld je Einheit.*"));
      await page.waitForTimeout(2600);
      await page.evaluate(() => window.__capOff());
      await page.waitForTimeout(700);
      clock.mark("ende");
    });
  },

  // ── 06 Hausgeld: Scrollfahrt auf die Rückstandsliste, Spotlight auf die Summe ─
  async hausgeld(browser, state) {
    await scene(browser, "06-hausgeld", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/verwaltung/weg/${PID()}/hausgeld`, 1300);
      clock.mark("scroll_los");
      await scrollFahrt(page, 640, { ms: 1800, settle: 800 });
      clock.mark("liste");
      await untertitel(page, clock, "Wer gezahlt hat — und *wer nicht.*", 300);
      clock.mark("spot");
      await spotlight(page, 'tr:has-text("Summe")', { wait: 1400 });
      await spotlightOff(page);
      clock.mark("ende");
      await page.waitForTimeout(600);
    });
  },

  // ── 07 Versammlung: ein Tagesordnungspunkt wird verschoben ───────────────
  // Eine echte Änderung im Bild: Der Zeiger klickt den Pfeil, die Liste
  // sortiert sich sichtbar um. Nichts überzeugt so wie eine Oberfläche, die
  // auf eine Eingabe reagiert.
  async versammlung(browser, state) {
    await scene(browser, "07-versammlung", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/versammlungen/${MEETING()}`, 1600);
      await untertitel(page, clock, "Tagesordnung, *Punkt für Punkt.*", 300);

      clock.mark("spot");
      await spotlight(page, 'text=TOP 2: Beschluss über die Jahresabrechnung (Abrechnungsspitze)', { wait: 1300 });
      await spotlightOff(page);

      clock.mark("scroll_los");
      await smoothScroll(page, 520, 1100);
      await page.waitForTimeout(500);
      clock.mark("reihenfolge");
      // Den dritten Punkt nach oben holen — sichtbare Wirkung eines Klicks.
      await moveAndClick(page, 'li:has-text("Verschiedenes") button[aria-label*="oben"], ' +
        'li:has-text("Verschiedenes") button:has(svg)', { from: { x: 640, y: 300 } })
        .catch(async () => {
          // Fällt die Umsortierung aus, bleibt die Szene trotzdem brauchbar.
          await page.waitForTimeout(400);
        });
      await page.waitForTimeout(1800);
      clock.mark("ende");
    });
  },

  // ── 08 KI-Assistent ──────────────────────────────────────────────────────
  async ki(browser, state) {
    await scene(browser, "08-ki", state, async (page, clock) => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1400);
      await installCursor(page);
      clock.mark("zeiger_los");
      await moveCursor(page, { x: 1245, y: 685 }, { from: { x: 690, y: 400 } });
      await page.waitForTimeout(160);
      await page.evaluate(([x, y]) => window.__pulseAt(x, y), [1245, 685]);
      await page.waitForTimeout(130);
      await page.locator('button[aria-label="Assistent öffnen"]').click();
      await page.waitForTimeout(900);
      clock.mark("offen");
      await page.evaluate(() => window.__curHide());
      await humanType(page, "textarea", FRAGE);
      await page.waitForTimeout(700);
      clock.mark("getippt");
      await page.locator("textarea").press("Enter");
      await page.waitForTimeout(2600);
      clock.mark("antwort");
      await page.waitForTimeout(2600);
    });
  },

  // ── 09 Endtafel ──────────────────────────────────────────────────────────
  async cta(browser) {
    fs.rmSync(path.join(OUT, "09-cta"), { recursive: true, force: true });
    const { context, page } = await newClip(browser, path.join(OUT, "09-cta"));
    await page.goto(card("Ihre Gemeinschaft.|*Ihre Zahlen.*", "cta"));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__play());
    await page.waitForTimeout(3200);
    await context.close();
    console.log("fertig: 09-cta");
  },
};

module.exports = { SCENES };
