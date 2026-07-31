// Holt die PDFs, die das Video zeigt, und rendert die erste Seite als Bild.
//
// Warum nicht einfach abfilmen: Ein Klick auf einen PDF-Link führt den Browser
// in Chromiums PDF-Anzeige — und die lässt sich mit Playwright nicht
// aufnehmen, die Aufzeichnung bricht ab. Das hier gezeigte Bild ist trotzdem
// echt: Es ist genau das PDF, das die App ausliefert, nur als Seitenbild.
//
//   node video/pdf-bilder.js
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { BASE } = require("./lib/capture");

// Eigener Start statt lib/capture.launch(): Für die PDF-Anzeige werden
// ES-Module von file:// geladen, und die blockiert Chromium ohne diesen
// Schalter stillschweigend — die Seite lädt, das Modul nie.
const launch = () => chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--allow-file-access-from-files", "--hide-scrollbars"],
});

const ZIEL = path.join(__dirname, "remotion", "public", "pdf");

const PDFS = [
  { name: "einzelabrechnung", pfad: () => `/verwaltung/weg/${process.env.WEG_PROPERTY_ID}/jahresabrechnung/${process.env.WEG_STATEMENT_ID}/pdf` },
  { name: "sammlung", pfad: () => `/beschluesse/sammlung/export?objekt=${process.env.WEG_PROPERTY_ID}` },
  { name: "wirtschaftsplan", pfad: () => `/verwaltung/weg/${process.env.WEG_PROPERTY_ID}/wirtschaftsplan/${process.env.WEG_PLAN_ID}/pdf` },
];

async function main() {
  fs.mkdirSync(ZIEL, { recursive: true });
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1250 } });
  const p = await ctx.newPage();

  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', "admin@bundwimmobilien.de");
  await p.fill('input[name="password"]', "BundW-Start2026!");
  await p.click('button[type="submit"]');
  await p.waitForURL(/dashboard/);

  for (const { name, pfad } of PDFS) {
    // Über fetch AUS DER SEITE heraus, nicht über p.request: Nur so gehen die
    // Sitzungs-Cookies mit. Der eigenständige Request-Kontext bekam die
    // Login-Seite als HTML zurück — und die ist kein PDF.
    const b64 = await p.evaluate(async (url) => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok || !(r.headers.get("content-type") || "").includes("pdf")) return null;
      const buf = new Uint8Array(await r.arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
      return btoa(s);
    }, BASE + pfad());
    if (!b64) { console.log("übersprungen (kein PDF):", name); continue; }
    const daten = Buffer.from(b64, "base64");
    fs.writeFileSync(path.join(ZIEL, `${name}.pdf`), daten);

    // Erste Seite über pdf.js zeichnen und abfotografieren. Die Anzeige läuft
    // in einer eigenen lokalen Seite, weil Chromiums eingebaute PDF-Anzeige
    // sich nicht abgreifen lässt.
    const viewer = await ctx.newPage();
    await viewer.goto("file://" + path.join(__dirname, "pdfview", "index.html"));
    // Das Modul lädt asynchron — ohne dieses Warten ist __render noch undefiniert.
    await viewer.waitForFunction(() => typeof window.__render === "function", null, { timeout: 15000 });
    const groesse = await viewer.evaluate(
      ([b64, scale]) => window.__render(b64, scale),
      [daten.toString("base64"), 2.2],
    ).catch((e) => { console.log("Render-Fehler:", name, String(e).slice(0, 140)); return null; });
    if (groesse) {
      await viewer.locator("#c").screenshot({ path: path.join(ZIEL, `${name}.png`) });
      console.log("PDF-Seite gerendert:", name, groesse.join("×"));
    }
    await viewer.close();
  }

  await ctx.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
