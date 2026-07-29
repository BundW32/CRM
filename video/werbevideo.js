// Werbevideo, Vollversion (~29 s): fünf Funktionen, Ergebnis zuerst.
//
//   PREVIEW_BASE_URL=http://127.0.0.1:3200 node video/werbevideo.js
//   PROGRESS=1 LOGO_FROM=8 node video/compose-werbevideo.mjs
//
// Dramaturgie:
//   0–3 s   Aufhänger: die **fertige** Abrechnung, darüber die Frage des
//           Zuschauers. Erst das Ergebnis, dann der Weg dorthin — eine
//           statische Texttafel am Anfang ist der größte Absprungpunkt.
//   3–29 s  Fünf Funktionen in ungleicher Länge, jede mit einer Zufahrt auf
//           genau das Element, das die Aussage beweist.
//   25–29 s Handlungsaufruf, steht still, wird zum Plakat.
//
// Nicht dreizehn Funktionen, sondern fünf: Vollständigkeit ist der Feind eines
// Werbevideos. Was hier fehlt (Stammdaten, CSV-Import, Versammlung, Vorgänge),
// steht auf der Seite — das Video ist der Beleg, nicht der Erklärbogen.
const fs = require("fs");
const path = require("path");
const {
  launch,
  newClip,
  installCursor,
  installOverlay,
  caption,
  focusBox,
  textBox,
  highlight,
  moveCursor,
  clickAt,
  BASE,
} = require("./lib/capture");

const OUT = path.join(__dirname, "out", "raw");
const CARD = "file://" + path.join(__dirname, "cards", "card.html");
const card = (t, kind = "hook") => `${CARD}?kind=${kind}&t=${encodeURIComponent(t)}`;
const WEG = process.env.VIDEO_WEG_ID || "cms4nld9h0009657dlsm04xkb";
const shots = [];

// Eine Einstellung anmelden: `cutMs` ist ihre Länge im fertigen Video, `push`
// die Zufahrt auf den gemessenen Kasten (Zoom rechnet der Schnitt daraus).
// Die Einstellung wird beim Beginn angemeldet und am Ende geschlossen: Länge
// und Zeitpunkt der Zufahrt werden **gemessen**, nicht geplant.
function beat(clip, t0, name, opts = {}) {
  const s = { clip, name, atMs: Date.now() - t0, ...opts };
  shots.push(s);
  const begin = Date.now();
  return {
    // Zufahrt beginnt jetzt — nachdem der Satz gelesen ist.
    pushNow(box, to) {
      s.push = { box, to, atMs: Date.now() - begin };
    },
    close(tailMs = 0) {
      s.cutMs = Date.now() - begin + tailMs;
    },
  };
}

// Eine Funktions-Einstellung: erst steht der Satz im Vollbild, dann fährt die
// Kamera auf den Beleg. Beides gleichzeitig geht nicht — die Einblendung liegt
// in der Aufnahme und würde von der Zufahrt mit angeschnitten.
async function funktion(page, clip, t0, name, text, box, to) {
  const b = beat(clip, t0, name);
  await caption(page, text);
  b.pushNow(box, to);
  await highlight(page, box, 1000);
  await page.waitForTimeout(600);
  b.close(-150);
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();

  const boot = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const bp = await boot.newPage();
  await bp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await bp.fill('input[name="email"]', "admin@bundwimmobilien.de");
  await bp.fill('input[name="password"]', "BundW-Start2026!");
  await bp.click('button[type="submit"]');
  await bp.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
  await bp.waitForTimeout(1000);
  await bp.goto(`${BASE}/verwaltung/weg/${WEG}/wirtschaftsplan`, { waitUntil: "networkidle" });
  const planHref = await bp.evaluate(
    () => document.querySelector('a[href*="/wirtschaftsplan/"]')?.getAttribute("href") ?? "",
  );
  const storageState = await boot.storageState();
  await boot.close();

  async function open(dir, url, opts = {}) {
    const { context, page } = await newClip(browser, path.join(OUT, dir), { storageState });
    const t0 = Date.now();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(opts.settle ?? 700);
    await installOverlay(page);
    if (opts.cursor !== false) await installCursor(page);
    return { context, page, t0 };
  }

  // ── 1+2+3 · Abrechnung: Aufhänger, Klick und Beleg aus einer Aufnahme ────
  {
    const { context, page, t0 } = await open("01-abrechnung", `${BASE}/verwaltung/weg/${WEG}/jahresabrechnung`);
    // Gerechnet wird das Jahr mit Buchungen — sonst steht im Bild eine
    // Abrechnung aus lauter Nullen.
    await page.fill('input[type="number"]', "2026");

    // Klick (im Schnitt an zweiter Stelle)
    const knopf = await focusBox(page, 'button:has-text("Abrechnung anlegen")');
    const bStart = Date.now();
    await moveCursor(page, { x: knopf.x + knopf.w / 2, y: knopf.y + knopf.h / 2 }, { from: { x: 780, y: 610 } });
    const pushAt = Date.now() - bStart;
    beat("01-abrechnung", t0, "f1-klick", {
      atMs: bStart - t0,
      cutMs: 4500,
      leadMs: 500,
      push: { box: knopf, to: 1.65, atMs: pushAt - 500 },
    });
    await caption(page, "Jahresabrechnung — auf Knopfdruck.", { keep: true, ms: 900 });
    await highlight(page, knopf, 600);
    await page.evaluate(() => window.__capHide());
    await clickAt(page, 'button:has-text("Abrechnung anlegen")');
    await page.evaluate(() => window.__curHide?.());
    await page.mouse.move(1279, 719);
    await page.waitForTimeout(600);

    await page.waitForURL(/jahresabrechnung\/[a-z0-9]+$/, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(900);
    await installOverlay(page);

    // Aufhänger: dieselbe ruhige Aufnahme des Ergebnisses, darüber die Frage
    beat("01-abrechnung", t0, "hook", { cutMs: 3000, leadMs: -600 });
    await caption(page, "Keine Verwaltung|für Ihre WEG?", { ms: 1500 });
    await page.waitForTimeout(400);

    // Beleg: Prüfzeile und die ersten Summen, herangefahren
    const pruef = await textBox(
      page,
      "Verteilung vollständig und centgenau — Summe der Einzelabrechnungen entspricht der Gesamtabrechnung.",
      { dx: -30, dy: -20, w: 580, h: 185 },
    );
    await funktion(page, "01-abrechnung", t0, "f2-beleg", "Gesamt- und Einzelabrechnung,|*centgenau geprüft.*", pruef, 1.7);
    await context.close();
    console.log("1–3 · Abrechnung");
  }

  // ── 4 · Hausgeld: wer gezahlt hat, und wer nicht ─────────────────────────
  {
    const { context, page, t0 } = await open("02-hausgeld", `${BASE}/verwaltung/weg/${WEG}/hausgeld`);
    // Zufahrt auf die Saldo-Spalte: dort stehen die roten Rückstände.
    const saldo = await textBox(page, "SALDO", { dx: -195, dy: -16, w: 340, h: 330 });
    await funktion(page, "02-hausgeld", t0, "f3-hausgeld", "Wer gezahlt hat — *und wer nicht.*", saldo, 1.7);
    await context.close();
    console.log("4 · Hausgeld");
  }

  // ── 5 · Wirtschaftsplan: der richtige Umlageschlüssel ────────────────────
  {
    const { context, page, t0 } = await open("03-plan", `${BASE}${planHref}`);
    const schluessel = await textBox(page, "UMLAGESCHLÜSSEL", { dx: -365, dy: -18, w: 800, h: 255 });
    await funktion(page, "03-plan", t0, "f4-plan", "Verteilt nach *MEA, Fläche, Personenzahl.*", schluessel, 1.5);
    await context.close();
    console.log("5 · Wirtschaftsplan");
  }

  // ── 6 · Beschluss-Sammlung: lückenlos nummeriert ─────────────────────────
  {
    const { context, page, t0 } = await open("04-beschluesse", `${BASE}/beschluesse/sammlung`);
    // Die fortlaufende Nummerierung ist der Beleg für „lückenlos" — der Kasten
    // umfasst deshalb die Titelzeilen, nicht die Zustands-Schilder rechts.
    const r1 = await focusBox(page, "text=Wirtschaftsplan 2026");
    const r3 = await focusBox(page, "text=Treppenhausanstrich 2026");
    const liste = {
      x: Math.max(0, r1.x - 24),
      y: Math.max(0, r1.y - 28),
      w: 780,
      h: Math.min(720 - Math.max(0, r1.y - 28), r3.y + r3.h + 30 - (r1.y - 28)),
    };
    await funktion(page, "04-beschluesse", t0, "f5-beschluss", "Beschluss-Sammlung: *lückenlos.*", liste, 1.5);
    await context.close();
    console.log("6 · Beschluss-Sammlung");
  }

  // ── 7 · Endtafel: steht still und wird zum Plakat ────────────────────────
  {
    const { context, page } = await newClip(browser, path.join(OUT, "05-cta"));
    const t0 = Date.now();
    await page.goto(card("Ihre Gemeinschaft.|*Ihre Zahlen.*", "cta"));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__play());
    await page.waitForTimeout(300);
    beat("05-cta", t0, "cta", { cutMs: 4000 });
    await page.waitForTimeout(4400);
    await context.close();
    console.log("7 · Endtafel");
  }

  await browser.close();

  // Reihenfolge im fertigen Video: Ergebnis, dann der Weg dorthin.
  const order = ["hook", "f1-klick", "f2-beleg", "f3-hausgeld", "f4-plan", "f5-beschluss", "cta"];
  shots.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  for (const s of shots) {
    const dir = path.join(OUT, s.clip);
    s.file = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(".webm")));
  }
  fs.writeFileSync(path.join(__dirname, "out", "manifest.json"), JSON.stringify(shots, null, 2));
  const total = shots.reduce((sum, s) => sum + s.cutMs, 0);
  console.log(`\n${shots.length} Einstellungen · ${(total / 1000).toFixed(1)} s geplant`);
  for (const s of shots) console.log(`  ${s.name.padEnd(13)} ${(s.cutMs / 1000).toFixed(1)}s${s.push ? "  Zufahrt" : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
