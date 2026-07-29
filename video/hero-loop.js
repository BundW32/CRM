// Hero-Schleife (~10 s): stumm, endlos, auf der Startseite.
//
//   PREVIEW_BASE_URL=http://127.0.0.1:3200 node video/hero-loop.js
//   VIDEO_NAME=hero-loop MANIFEST=manifest-loop.json node video/compose-werbevideo.mjs
//
// Vier Beats ungleicher Länge, harte Schnitte, keine Karte am Anfang und keine
// am Ende:
//
//   A · 2,2 s  fertige Abrechnung, ruhig — darüber die Frage des Zuschauers
//   B · 3,5 s  der Klick, der sie erzeugt hat, mit Zufahrt auf den Knopf
//   C · 2,5 s  die Prüfzeile und die Summen, herangefahren
//   D · 1,8 s  zurück auf Vollbild — Auflösung
//
// Warum die Schleife dicht ist: A und D stammen aus **derselben ruhigen
// Aufnahme derselben Seite**. Der erste Frame von A zeigt die Einblendung noch
// nicht (sie blendet erst ein), der letzte Frame von D zeigt sie nicht mehr —
// beide Bilder sind identisch, die Naht ist unsichtbar.
//
// Kein Handlungsaufruf im Loop: Ein Knopf im Video ist nicht klickbar, und ein
// Logo-Endbild würde bei jedem Durchlauf sichtbar umschlagen. Der echte
// Handlungsaufruf steht daneben auf der Seite.
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

const OUT = path.join(__dirname, "out", "raw-loop");
const WEG = process.env.VIDEO_WEG_ID || "cms4nld9h0009657dlsm04xkb";
const shots = [];
const CLIP = "abrechnung";

// Eine Einstellung anmelden. `cutMs` ist die geplante Länge im fertigen Video,
// `push` die Zufahrt auf den gemessenen Kasten.
function beat(t0, name, opts) {
  shots.push({ clip: CLIP, name, atMs: Date.now() - t0, ...opts });
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
  const storageState = await boot.storageState();
  await boot.close();

  const { context, page } = await newClip(browser, path.join(OUT, CLIP), { storageState });
  const t0 = Date.now();
  await page.goto(`${BASE}/verwaltung/weg/${WEG}/jahresabrechnung`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await installOverlay(page);
  await installCursor(page);
  // Gerechnet wird das Jahr mit Buchungen — sonst steht im Bild eine
  // Abrechnung aus lauter Nullen.
  await page.fill('input[type="number"]', "2026");

  // ── B · Der Klick (wird im Schnitt an zweite Stelle gesetzt) ─────────────
  const knopf = await focusBox(page, 'button:has-text("Abrechnung anlegen")');
  const bStart = Date.now();
  await moveCursor(page, { x: knopf.x + knopf.w / 2, y: knopf.y + knopf.h / 2 }, { from: { x: 760, y: 600 } });
  const pushAt = Date.now() - bStart; // Zufahrt beginnt, wenn der Zeiger ankommt
  beat(bStart, "b-klick", { atMs: bStart - t0, cutMs: 3500, leadMs: 700, push: { box: knopf, to: 1.65, atMs: pushAt - 700 } });
  await highlight(page, knopf, 700);
  await clickAt(page, 'button:has-text("Abrechnung anlegen")');
  await page.evaluate(() => window.__curHide?.());
  await page.mouse.move(1279, 719);
  await page.waitForTimeout(500);

  await page.waitForURL(/jahresabrechnung\/[a-z0-9]+$/, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(900);
  await installOverlay(page);

  // ── D · Ruhe auf dem Ergebnis (Vollbild, ohne Text) ─────────────────────
  beat(t0, "d-ruhe", { cutMs: 1800, leadMs: 200 });
  await page.waitForTimeout(2400);

  // ── A · Dieselbe ruhige Aufnahme, darüber die Frage ──────────────────────
  beat(t0, "a-frage", { cutMs: 2600, leadMs: -700 });
  await caption(page, "Keine Verwaltung|für Ihre WEG?", { ms: 1300 });
  await page.waitForTimeout(700);

  // ── C · Prüfzeile und Summen, herangefahren ─────────────────────────────
  // Ein Kasten über beides statt Zufahrt plus Schwenk: zwei Bewegungen in
  // zweieinhalb Sekunden liest niemand mit.
  // Der Kasten umfasst die Prüfzeile und die beiden ersten Summen darunter.
  // Über die volle Breite wäre keine Zufahrt möglich — bei 16:9 schneidet jeder
  // Zoom jenseits von 1,1 etwas an, wenn der Kasten so breit ist wie das Bild.
  const pruef = await textBox(page, "Verteilung vollständig und centgenau — Summe der Einzelabrechnungen entspricht der Gesamtabrechnung.", {
    dx: -30,
    dy: -20,
    w: 580,
    h: 185,
  });
  const cStart = Date.now();
  beat(t0, "c-beleg", { cutMs: 2500, push: { box: pruef, to: 1.7, atMs: 250 } });
  await highlight(page, pruef, 900);
  await page.waitForTimeout(1400);
  void cStart;

  await context.close();
  await browser.close();

  // Reihenfolge im fertigen Video: Frage → Klick → Beleg → Auflösung.
  const order = ["a-frage", "b-klick", "c-beleg", "d-ruhe"];
  shots.sort((x, y) => order.indexOf(x.name) - order.indexOf(y.name));

  const dir = path.join(OUT, CLIP);
  const file = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(".webm")));
  for (const s of shots) s.file = file;

  fs.writeFileSync(path.join(__dirname, "out", "manifest-loop.json"), JSON.stringify(shots, null, 2));
  const total = shots.reduce((sum, s) => sum + s.cutMs, 0);
  console.log(`\n${shots.length} Beats · ${(total / 1000).toFixed(1)} s geplant`);
  for (const s of shots) console.log(`  ${s.name.padEnd(10)} ${(s.cutMs / 1000).toFixed(1)}s${s.push ? `  Zufahrt ${s.push.to}×` : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
