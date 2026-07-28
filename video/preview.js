// Vorschau: ein senkrechter Schnitt durch die gesamte Kette.
// Zweck ist der Beweis der Technik und der Handschrift, nicht das fertige Bild.
//
//   node video/preview.js      (App muss auf PREVIEW_BASE_URL laufen)
//
// Ergebnis: video/out/raw/*.webm — daraus baut video/compose.sh den Schnitt.
const fs = require("fs");
const path = require("path");
const { launch, newClip, installCursor, moveCursor, clickAt, humanType, BASE } = require("./lib/capture");

const OUT = path.join(__dirname, "out", "raw");
const CARD = "file://" + path.join(__dirname, "cards", "card.html");
const card = (t, kind = "hook") => `${CARD}?kind=${kind}&t=${encodeURIComponent(t)}`;

const FRAGE = "Wann ist die nächste Eigentümerversammlung?";

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();

  // ── Anmeldung einmal, Zustand merken. Der Login gehört nicht ins Video. ──
  const boot = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const bp = await boot.newPage();
  await bp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await bp.fill('input[name="email"]', "admin@bundwimmobilien.de");
  await bp.fill('input[name="password"]', "BundW-Start2026!");
  await bp.click('button[type="submit"]');
  await bp.waitForURL(/dashboard|uebersicht|\/$/, { timeout: 20000 }).catch(() => {});
  await bp.waitForTimeout(1500);
  const storageState = await boot.storageState();
  console.log("angemeldet:", bp.url());
  await boot.close();

  // ── Klappe 1: Hook-Tafel ────────────────────────────────────────────────
  {
    const { context, page } = await newClip(browser, path.join(OUT, "01-hook"));
    await page.goto(card("Ihre WEG verwaltet sich|selbst. *Nicht allein.*"));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__play());
    await page.waitForTimeout(2600);
    await context.close();
    console.log("klappe 1 fertig");
  }

  // ── Klappe 2: die KI-Szene, echte App ───────────────────────────────────
  {
    const { context, page } = await newClip(browser, path.join(OUT, "02-ki"), { storageState });
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await installCursor(page);

    // Zeiger fährt zum Auslöser unten rechts und klickt.
    await moveCursor(page, { x: 1245, y: 685 }, { from: { x: 700, y: 420 } });
    await page.waitForTimeout(180);
    await clickAt(page, 'button[aria-label="Assistent öffnen"]');
    await page.waitForTimeout(900);

    // Frage tippen — mit Streuung, dann eine deutliche Pause vor dem Absenden.
    await page.evaluate(() => window.__curHide());
    await humanType(page, 'textarea', FRAGE);
    await page.waitForTimeout(700);
    await page.locator("textarea").press("Enter");

    // Denkpause und Antwort. Die Quellen sind der eigentliche Beleg.
    await page.waitForTimeout(4200);
    await context.close();
    console.log("klappe 2 fertig");
  }

  // ── Klappe 3: Endtafel, wird zum Plakat ─────────────────────────────────
  {
    const { context, page } = await newClip(browser, path.join(OUT, "03-cta"));
    await page.goto(card("Ihre Gemeinschaft.|*Ihre Zahlen.*", "cta"));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__play());
    await page.waitForTimeout(3000);
    await context.close();
    console.log("klappe 3 fertig");
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
