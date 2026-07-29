// Hero-Schleife (~13 s): die Fassung, die fast jeder Besucher sieht.
//
//   PREVIEW_BASE_URL=http://127.0.0.1:3200 node video/hero-loop.js
//   VIDEO_NAME=hero-loop MANIFEST=manifest-loop.json node video/compose-werbevideo.mjs
//
// Läuft im Hero stumm im Autoplay. Niemand schaut 50 Sekunden Autoplay —
// dreizehn Sekunden Schleife halten den Blick. Deshalb kein Problem-Lösung-
// Bogen wie in der Vollversion, sondern: Aufhänger, ein einziger Beleg, Marke.
//
// Der Beleg ist die Jahresabrechnung. Sie ist die Pflicht aus § 28 WEG, vor der
// diese Zielgruppe am meisten Respekt hat — und sie entsteht hier mit einem
// Klick, live aus der Buchhaltung gerechnet. (Der Schnittplan sieht an dieser
// Stelle die KI-Szene vor; die braucht einen GEMINI_API_KEY und fällt ohne ihn
// aus, siehe Skill Abschnitt 5.)
//
// Schleifenschluss: Anfangs- und Endbild sind beide die dunkle Tafel. Ein
// Umschlag von hellem Produktbild auf dunkle Tafel wäre bei jedem Durchlauf
// sichtbar.
const fs = require("fs");
const path = require("path");
const {
  launch,
  newClip,
  installCursor,
  installOverlay,
  caption,
  moveCursor,
  clickAt,
  BASE,
} = require("./lib/capture");

const OUT = path.join(__dirname, "out", "raw-loop");
const CARD = "file://" + path.join(__dirname, "cards", "card.html");
const card = (t, kind = "hook") => `${CARD}?kind=${kind}&t=${encodeURIComponent(t)}`;
const WEG = process.env.VIDEO_WEG_ID || "cms4nld9h0009657dlsm04xkb";
const shots = [];

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

  // ── 1 · Aufhänger: die Lage des Zuschauers, nicht das Produkt ───────────
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
    await page.waitForTimeout(2500);
    end();
    await context.close();
    console.log("1 · Aufhänger");
  }

  // ── 2+3 · Der Beleg: ein Klick, und die Abrechnung steht ───────────────
  {
    const { context, page } = await newClip(browser, path.join(OUT, "02-abrechnung"), { storageState });
    const t0 = Date.now();
    await page.goto(`${BASE}/verwaltung/weg/${WEG}/jahresabrechnung`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await installOverlay(page);
    await installCursor(page);
    // Gerechnet wird das Jahr mit Buchungen — sonst steht im Bild eine
    // Abrechnung aus lauter Nullen.
    await page.fill('input[type="number"]', "2026");

    const endA = shot("02-abrechnung", t0, "klick");
    await caption(page, "Jahresabrechnung — auf Knopfdruck.", {
      keep: true,
      during: () => moveCursor(page, { x: 359, y: 325 }, { from: { x: 700, y: 560 } }),
    });
    await page.evaluate(() => window.__capHide());
    await page.waitForTimeout(240);
    await clickAt(page, 'button:has-text("Abrechnung anlegen")');
    // Zeiger ausblenden: Die App navigiert clientseitig, der synthetische
    // Zeiger überlebt den Seitenwechsel und stünde sonst ohne Aufgabe über
    // den Zahlen der fertigen Abrechnung.
    await page.evaluate(() => window.__curHide?.());
    await page.mouse.move(1279, 719);
    endA();

    // Die Rechenpause bleibt im Bild: Sie erzeugt die Erwartung, die das
    // Ergebnis trägt.
    await page.waitForURL(/jahresabrechnung\/[a-z0-9]+$/, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(850);
    await installOverlay(page);
    const endB = shot("02-abrechnung", t0, "ergebnis", { to: 1.07 });
    await page.waitForTimeout(250);
    await caption(page, "Gesamt- und Einzelabrechnung,|*centgenau geprüft.*");
    endB();
    await context.close();
    console.log("2+3 · Abrechnung");
  }

  // ── 4 · Marke: steht still, ist das Plakat und schließt die Schleife ────
  {
    const { context, page } = await newClip(browser, path.join(OUT, "03-cta"));
    const t0 = Date.now();
    await page.goto(card("Ihre Gemeinschaft.|*Ihre Zahlen.*", "cta"));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__play());
    await page.waitForTimeout(300);
    const end = shot("03-cta", t0, "cta");
    await page.waitForTimeout(3200);
    end();
    await context.close();
    console.log("4 · Endtafel");
  }

  await browser.close();

  for (const s of shots) {
    const dir = path.join(OUT, s.clip);
    s.file = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(".webm")));
  }
  const total = shots.reduce((sum, s) => sum + s.durMs, 0);
  fs.writeFileSync(path.join(__dirname, "out", "manifest-loop.json"), JSON.stringify(shots, null, 2));
  console.log(`\n${shots.length} Einstellungen, roh ${(total / 1000).toFixed(1)} s`);
  for (const s of shots) console.log(`  ${s.name.padEnd(12)} ${(s.durMs / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
