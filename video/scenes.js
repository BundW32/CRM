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

// Unterzeile einblenden — OHNE zu warten. Genau hier lag der Fehler von
// Fassung 2: `caption()` hielt den Ablauf für die volle Lesezeit an, also stand
// das Bild still, und erst danach begann die Bewegung. Jetzt läuft die Zeile
// mit, während der Spotlight wandert oder die Seite scrollt.
async function capAn(page, clock, text) {
  clock.mark("cap_an");
  await page.evaluate((t) => window.__cap(t), text);
  await page.waitForTimeout(350);          // nur das Einblenden abwarten
}

// Ausblenden, sobald die Lesezeit um ist — gemessen ab dem Einblenden.
async function capAus(page, clock, text, seitMs) {
  const noetig = Math.max(2000, Math.round((text.replace(/[*|]/g, "").length / 14) * 1000));
  const rest = noetig - seitMs;
  if (rest > 0) await page.waitForTimeout(rest);
  await page.evaluate(() => window.__capOff());
  await page.waitForTimeout(400);
  clock.mark("cap_aus");
}

// Jede Produktszene beginnt gleich: ankommen, Zeiger bereitstellen.
async function ankommen(page, clock, url, wartenMs = 600) {
  // Kurz halten! In Fassung 2 stand hier 1,5 s, dazu kam die Unterzeile — vor
  // der ersten Bewegung vergingen fast fünf Sekunden. Genau das war der Vorwurf
  // „fünf Sekunden dasselbe Bild, dann eine halbe Sekunde Spotlight".
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
      const T = "Das Portal sagt Ihnen, was *jetzt* dran ist.";
      await ankommen(page, clock, `${BASE}/dashboard`, 700);
      await capAn(page, clock, T);
      clock.mark("spot1");
      await spotlight(page, 'text=Rauchwarnmelder prüfen >> nth=0', { wait: 1050 });
      await spotlight(page, 'text=Jahresabrechnung 2025 erstellen', { wait: 1050 });
      clock.mark("spot3");
      await spotlight(page, 'text=Hausgeld-Rückstände offen', { wait: 1100 });
      await capAus(page, clock, T, 3550);
      await spotlightOff(page);
      clock.mark("spot_aus");
      await page.waitForTimeout(300);
    });
  },

  // ── 03 Erststart: durch die acht Schritte scrollen ───────────────────────
  // Der Zuschauer soll sehen, dass es wirklich acht sind und dass drei schon
  // erledigt sind — das geht nur, wenn die Liste sich bewegt.
  async erststart(browser, state) {
    await scene(browser, "03-erststart", state, async (page, clock) => {
      const T = "Acht Schritte. *Einer nach dem anderen.*";
      await ankommen(page, clock, `${BASE}/dashboard`, 700);
      await capAn(page, clock, T);
      clock.mark("spot");
      await spotlight(page, 'text=Unterlagen der bisherigen Verwaltung anfordern >> nth=0', { wait: 1200 });
      await spotlightOff(page);
      await capAus(page, clock, T, 1900);
      clock.mark("scroll_los");
      await scrollFahrt(page, 700, { ms: 1500, settle: 600 });
      clock.mark("unten");
      await page.waitForTimeout(500);
    });
  },

  // ── 04 Kommandopalette: Strg+K, tippen, springen ─────────────────────────
  // Der zweite WOW-Moment neben dem Assistenten: Eingabe → sofortiger Sprung.
  // Tippen ist im Video die stärkste Form von „hier passiert etwas".
  async palette(browser, state) {
    await scene(browser, "04-palette", state, async (page, clock) => {
      const T = "*Suchen* statt klicken.";
      await ankommen(page, clock, `${BASE}/dashboard`, 700);
      await capAn(page, clock, T);
      await page.waitForTimeout(1400);
      await capAus(page, clock, T, 1750);
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
      await ankommen(page, clock, `${BASE}/verwaltung/weg/${PID()}/wirtschaftsplan/${PLAN()}`, 800);
      const T = "Verteilt nach dem *richtigen Schlüssel.*";
      await capAn(page, clock, T);
      // Drei verschiedene Schlüssel in drei Zeilen — genau das ist der Punkt.
      clock.mark("spot1");
      await spotlight(page, 'tr:has-text("Müllabfuhr")', { wait: 1150 });
      await spotlight(page, 'tr:has-text("Treppenhausreinigung")', { wait: 1150 });
      await capAus(page, clock, T, 2650);
      await spotlightOff(page);
      clock.mark("scroll_los");
      await scrollFahrt(page, 620, { ms: 1400, settle: 500 });
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
      await ankommen(page, clock, `${BASE}/verwaltung/weg/${PID()}/hausgeld`, 700);
      const T = "Wer gezahlt hat — und *wer nicht.*";
      clock.mark("scroll_los");
      await scrollFahrt(page, 640, { ms: 1500, settle: 400 });
      clock.mark("liste");
      await capAn(page, clock, T);
      clock.mark("spot");
      await spotlight(page, 'tr:has-text("Summe")', { wait: 1500 });
      await capAus(page, clock, T, 1900);
      await spotlightOff(page);
      clock.mark("ende");
      await page.waitForTimeout(300);
    });
  },

  // ── 07 Versammlung: ein Tagesordnungspunkt wird verschoben ───────────────
  // Eine echte Änderung im Bild: Der Zeiger klickt den Pfeil, die Liste
  // sortiert sich sichtbar um. Nichts überzeugt so wie eine Oberfläche, die
  // auf eine Eingabe reagiert.
  async versammlung(browser, state) {
    await scene(browser, "07-versammlung", state, async (page, clock) => {
      await ankommen(page, clock, `${BASE}/versammlungen/${MEETING()}`, 800);
      const T = "Tagesordnung, *Punkt für Punkt.*";
      await capAn(page, clock, T);
      clock.mark("spot");
      await spotlight(page, 'text=TOP 2: Beschluss über die Jahresabrechnung (Abrechnungsspitze)', { wait: 1400 });
      await capAus(page, clock, T, 1800);
      await spotlightOff(page);
      clock.mark("scroll_los");
      await smoothScroll(page, 520, 900);
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

  // ── 07b Rollenwechsel: dieselbe WEG aus Sicht eines Miteigentümers ───────
  // Der verwaltende Eigentümer hat nur ein paar Rechte mehr — sichtbar an der
  // kürzeren Bereichsleiste. Für die Zielgruppe ist genau das die Beruhigung:
  // Die Gemeinschaft sieht mit, ohne dass jeder alles ändern kann.
  async rollen(browser) {
    fs.rmSync(path.join(OUT, "08-rollen"), { recursive: true, force: true });
    const { context, page, clock } = await newClip(browser, path.join(OUT, "08-rollen"), {});
    const T = "Und jeder Eigentümer *sieht mit.*";
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "eigentuemer@demo.de");
    await page.fill('input[name="password"]', "Demo-2026!");
    await page.waitForTimeout(400);
    await installCursor(page);
    clock.mark("anmelden");
    await moveAndClick(page, 'button[type="submit"]', { from: { x: 640, y: 320 } });
    await page.waitForURL(/dashboard/, { timeout: 20000 });
    await page.waitForTimeout(1100);
    clock.mark("drin");
    await installCaption(page);
    await capAn(page, clock, T);
    clock.mark("spot");
    await spotlight(page, "nav, aside >> nth=0", { wait: 1500, pad: 6 });
    await capAus(page, clock, T, 1900);
    await spotlightOff(page);
    clock.mark("ende");
    await page.waitForTimeout(300);
    clock.save();
    await context.close();
    console.log("fertig: 08-rollen");
  },

  // ── 09 KI-Assistent ──────────────────────────────────────────────────────
  async ki(browser, state) {
    await scene(browser, "09-ki", state, async (page, clock) => {
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
    fs.rmSync(path.join(OUT, "10-cta"), { recursive: true, force: true });
    const { context, page } = await newClip(browser, path.join(OUT, "10-cta"));
    await page.goto(card("Ihre Gemeinschaft.|*Ihre Zahlen.*", "cta"));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__play());
    await page.waitForTimeout(3200);
    await context.close();
    console.log("fertig: 10-cta");
  },
};

module.exports = { SCENES };
