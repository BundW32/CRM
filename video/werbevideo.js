// Werbevideo, Vollversion (~50 s): der Rundgang durch das Portal.
//
//   PREVIEW_BASE_URL=http://127.0.0.1:3200 node video/werbevideo.js
//
// Nimmt neun Einstellungen aus der laufenden App auf und schreibt neben den
// Rohaufnahmen eine Schnittliste (out/manifest.json). Die Liste hält für jede
// Einstellung fest, ab welcher Millisekunde der Aufnahme sie beginnt und wie
// lange sie steht — compose-werbevideo.mjs schneidet danach. Damit gibt es
// keine von Hand gepflegten Zeitmarken, die beim nächsten Lauf nicht mehr
// stimmen.
const fs = require("fs");
const path = require("path");
const {
  launch,
  newClip,
  installCursor,
  installOverlay,
  caption,
  holdMs,
  smoothScroll,
  moveCursor,
  clickAt,
  BASE,
} = require("./lib/capture");

const OUT = path.join(__dirname, "out", "raw");
const CARD = "file://" + path.join(__dirname, "cards", "card.html");
const card = (t, kind = "hook") => `${CARD}?kind=${kind}&t=${encodeURIComponent(t)}`;

const WEG = process.env.VIDEO_WEG_ID || "cms4nld9h0009657dlsm04xkb";
const shots = [];

// Eine Einstellung anmelden: Startzeit relativ zum Beginn der Aufnahme.
// `zoom` ist optional und wird erst beim Schnitt gerechnet — die Kamera fährt
// nur dorthin, wo der Blick gleich lesen muss.
function shot(clip, t0, name, zoom) {
  const at = Date.now() - t0;
  shots.push({ clip, name, atMs: at, zoom });
  return () => {
    shots[shots.length - 1].durMs = Date.now() - t0 - at;
  };
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();

  // ── Anmeldung einmal; der Login gehört nicht ins Video ───────────────────
  const boot = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const bp = await boot.newPage();
  await bp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await bp.fill('input[name="email"]', "admin@bundwimmobilien.de");
  await bp.fill('input[name="password"]', "BundW-Start2026!");
  await bp.click('button[type="submit"]');
  await bp.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
  await bp.waitForTimeout(1200);
  // Die Zwischenseiten-Verweise holen wir uns einmal, statt IDs fest zu verdrahten.
  await bp.goto(`${BASE}/verwaltung/weg/${WEG}/wirtschaftsplan`, { waitUntil: "networkidle" });
  const planHref = await bp.evaluate(
    () => document.querySelector('a[href*="/wirtschaftsplan/"]')?.getAttribute("href") ?? "",
  );
  await bp.goto(`${BASE}/versammlungen`, { waitUntil: "networkidle" });
  const meetingHref = await bp.evaluate(
    () => document.querySelector('a[href*="/versammlungen/"]')?.getAttribute("href") ?? "",
  );
  const storageState = await boot.storageState();
  await boot.close();
  console.log("angemeldet · Plan:", planHref, "· Versammlung:", meetingHref);

  // Öffnet eine Seite, wartet bis sie steht, und legt Zeiger und Einblendungen an.
  async function open(dir, url, opts = {}) {
    const { context, page } = await newClip(browser, path.join(OUT, dir), { storageState });
    // Die Aufzeichnung beginnt mit der Seite, nicht mit der ersten Aktion.
    // Alle Zeitmarken zählen deshalb ab hier — sonst schneidet der Schnitt vor
    // die Einblendung, und im Bild steht eine noch leere Seite.
    const t0 = Date.now();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(opts.settle ?? 700);
    await installOverlay(page);
    if (opts.cursor !== false) await installCursor(page);
    return { context, page, t0 };
  }

  // ── 1 · Hook: das Problem, nicht die Lösung ─────────────────────────────
  {
    const { context, page } = await newClip(browser, path.join(OUT, "01-hook"));
    const t0 = Date.now();
    await page.goto(card("Keine Verwaltung|für Ihre WEG?"));
    await page.waitForTimeout(400);
    // 300 ms Vorlauf: Die Zeilen sind schon im Bild, wenn die Einstellung
    // beginnt. Sonst startet die Schleife auf einer leeren Tafel.
    await page.evaluate(() => window.__play());
    await page.waitForTimeout(300);
    const end = shot("01-hook", t0, "hook");
    await page.waitForTimeout(2900);
    end();
    await context.close();
    console.log("1 · Hook");
  }

  // ── 2 · Stammdaten: das Fundament, geprüft ──────────────────────────────
  {
    const { context, page, t0 } = await open("02-stammdaten", `${BASE}/verwaltung/weg/${WEG}/stammdaten`);
    // Zufahrt auf die Vollständigkeitsprüfung: dort steht der Beleg, dass die
    // Anteile aufgehen — das ist die Angst dieser Zielgruppe, nicht die Tabelle.
    const end = shot("02-stammdaten", t0, "stammdaten", { to: 1.07 });
    await caption(page, "Einheiten und Anteile:|einmal erfasst, überall gerechnet.", {
      during: () => smoothScroll(page, 300, 850),
    });
    end();
    await context.close();
    console.log("2 · Stammdaten");
  }

  // ── 3+4 · Wirtschaftsplan: Verteilung und Hausgeld je Einheit ───────────
  {
    const { context, page, t0 } = await open("03-plan", `${BASE}${planHref}`);
    const endA = shot("03-plan", t0, "plan-schluessel", null);
    await caption(page, "Der Wirtschaftsplan verteilt nach|*MEA, Fläche und Personenzahl.*");
    endA();
    const endB = shot("03-plan", t0, "plan-hausgeld");
    await caption(page, "Hausgeld je Einheit —|*centgenau, zwölf Raten.*", {
      during: () => smoothScroll(page, 590, 900),
    });
    endB();
    await context.close();
    console.log("3+4 · Wirtschaftsplan");
  }

  // ── 5 · Buchhaltung: getrennte Rücklage, Bankauszug als CSV ─────────────
  {
    const { context, page, t0 } = await open("04-buchhaltung", `${BASE}/verwaltung/weg/${WEG}/buchhaltung`);
    const endA = shot("04-buchhaltung", t0, "konten", { to: 1.06 });
    await caption(page, "Erhaltungsrücklage strikt getrennt.");
    endA();
    const endB = shot("04-buchhaltung", t0, "csv");
    await caption(page, "Kontoauszug als CSV einlesen —|ohne Bankanbindung.", {
      during: () => smoothScroll(page, 820, 900),
    });
    endB();
    await context.close();
    console.log("5 · Buchhaltung");
  }

  // ── 6 · Hausgeld: Rückstände und Mahnwesen ──────────────────────────────
  {
    const { context, page, t0 } = await open("05-hausgeld", `${BASE}/verwaltung/weg/${WEG}/hausgeld`);
    const endA = shot("05-hausgeld", t0, "rueckstand", { to: 1.08 });
    await caption(page, "Wer gezahlt hat — *und wer nicht.*");
    endA();
    const endB = shot("05-hausgeld", t0, "mahnung");
    // Der Zeiger fährt auf das Mahnwesen und hält dort — geklickt wird nicht:
    // ein erzeugter Brief wäre eine zweite Bewegung im selben Bild.
    await caption(page, "Zahlungserinnerung als fertiger Brief.", {
      during: async () => {
        await moveCursor(page, { x: 1150, y: 288 }, { from: { x: 640, y: 560 } });
        await page.evaluate(() => window.__pulseAt(1150, 288));
      },
    });
    endB();
    await context.close();
    console.log("6 · Hausgeld");
  }

  // ── 7 · Jahresabrechnung: ein Klick, live gerechnet ─────────────────────
  {
    const { context, page, t0 } = await open("06-abrechnung", `${BASE}/verwaltung/weg/${WEG}/jahresabrechnung`);
    // Das Formular schlägt das Vorjahr vor; gerechnet wird das Jahr mit
    // Buchungen — sonst steht im Bild eine Abrechnung aus lauter Nullen.
    await page.fill('input[type="number"]', "2026");
    const endA = shot("06-abrechnung", t0, "abr-klick");
    await caption(page, "Jahresabrechnung — auf Knopfdruck.", {
      keep: true,
      during: () => moveCursor(page, { x: 359, y: 325 }, { from: { x: 700, y: 560 } }),
    });
    await page.evaluate(() => window.__capHide());
    await page.waitForTimeout(260);
    await clickAt(page, 'button:has-text("Abrechnung anlegen")');
    // Zeiger ausblenden: Die App navigiert clientseitig, der synthetische
    // Zeiger überlebt den Seitenwechsel und stünde sonst ohne Aufgabe über
    // den Zahlen der fertigen Abrechnung.
    await page.evaluate(() => window.__curHide?.());
    await page.mouse.move(1279, 719);
    endA();
    // Die Rechenpause gehört ins Bild: Sie erzeugt die Erwartung, die das
    // Ergebnis trägt.
    await page.waitForURL(/jahresabrechnung\/[a-z0-9]+$/, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(900);
    await installOverlay(page);
    const endB = shot("06-abrechnung", t0, "abr-ergebnis", { to: 1.07 });
    await page.waitForTimeout(250);
    await caption(page, "Gesamt- und Einzelabrechnung,|*centgenau geprüft.*");
    endB();
    await context.close();
    console.log("7 · Jahresabrechnung");
  }

  // ── 8 · Versammlung und Beschluss-Sammlung ──────────────────────────────
  {
    const { context, page, t0 } = await open("07-versammlung", `${BASE}${meetingHref}`);
    const endA = shot("07-versammlung", t0, "versammlung");
    await caption(page, "Versammlung mit Tagesordnung.", {
      during: () => smoothScroll(page, 150, 800),
    });
    endA();
    await context.close();
    console.log("8a · Versammlung");
  }
  {
    const { context, page, t0 } = await open("08-beschluesse", `${BASE}/beschluesse/sammlung`);
    const endA = shot("08-beschluesse", t0, "beschluesse", { to: 1.06 });
    await caption(page, "Beschluss-Sammlung: *lückenlos.*");
    endA();
    await context.close();
    console.log("8b · Beschluss-Sammlung");
  }

  // ── 9 · Vorgänge: der Alltag zwischen den Versammlungen ─────────────────
  {
    const { context, page, t0 } = await open("09-vorgaenge", `${BASE}/vorgaenge`);
    const endA = shot("09-vorgaenge", t0, "vorgaenge");
    await caption(page, "Schäden melden, Status verfolgen.");
    endA();
    await context.close();
    console.log("9 · Vorgänge");
  }

  // ── 10 · Endtafel: sie steht still und wird zum Plakat ──────────────────
  {
    const { context, page } = await newClip(browser, path.join(OUT, "10-cta"));
    const t0 = Date.now();
    await page.goto(card("Ihre Gemeinschaft.|*Ihre Zahlen.*", "cta"));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__play());
    await page.waitForTimeout(300);
    const end = shot("10-cta", t0, "cta");
    await page.waitForTimeout(3600);
    end();
    await context.close();
    console.log("10 · Endtafel");
  }

  await browser.close();

  // Die Aufnahmedateien tragen zufällige Namen — hier den echten Pfad je Clip
  // nachtragen, damit der Schnitt nichts suchen muss.
  for (const s of shots) {
    const dir = path.join(OUT, s.clip);
    s.file = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(".webm")));
  }
  const total = shots.reduce((sum, s) => sum + s.durMs, 0);
  fs.writeFileSync(path.join(__dirname, "out", "manifest.json"), JSON.stringify(shots, null, 2));
  console.log(`\n${shots.length} Einstellungen, roh ${(total / 1000).toFixed(1)} s`);
  for (const s of shots) console.log(`  ${s.name.padEnd(18)} ${(s.durMs / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
