// Legt die Daten an, die das Video zeigt — über die Oberfläche der App, nicht
// per SQL. So entstehen sie durch dieselbe Logik wie beim echten Nutzer;
// eingefügte Datenbankzeilen könnten Zustände erzeugen, die es real nie gibt.
//
//   node video/demo-vorbereiten.js
//
// Läuft vor der Aufnahme und wird selbst nicht gefilmt.
const { launch, BASE } = require("./lib/capture");

const PID = process.env.WEG_PROPERTY_ID;

const BESCHLUESSE = [
  {
    titel: "Wirtschaftsplan 2026",
    text: "Die Gemeinschaft beschließt den Wirtschaftsplan 2026 mit Gesamtausgaben von 15.000,00 € und die daraus abgeleiteten Vorschüsse je Einheit (§ 28 Abs. 1 WEG).",
  },
  {
    titel: "Erhaltungsrücklage: Zuführung erhöhen",
    text: "Die jährliche Zuführung zur Erhaltungsrücklage wird ab 2026 von 5.700,00 € auf 6.000,00 € erhöht.",
  },
  {
    titel: "Treppenhausreinigung neu vergeben",
    text: "Die Gemeinschaft beauftragt ab dem 1. April 2026 einen neuen Dienstleister für die Treppenhausreinigung zu monatlich 120,00 €.",
  },
];

async function main() {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();

  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', "admin@bundwimmobilien.de");
  await p.fill('input[name="password"]', "BundW-Start2026!");
  await p.click('button[type="submit"]');
  await p.waitForURL(/dashboard/);

  // ── Buchungen 2025 ───────────────────────────────────────────────────────
  // Ohne sie stünde in der Jahresabrechnung überall 0,00 € — der Seed bringt
  // nur Buchungen für 2026 mit. Eine Abrechnung voller Nullen sähe im Video
  // aus wie ein Fehler, nicht wie ein fertiges Dokument.
  const AUSGABEN = [
    ["2025-01-15", "4560,00", "Hausmeister", "Hausmeisterdienst Jahrespauschale 2025"],
    ["2025-02-10", "684,00", "Allgemeinstrom", "Allgemeinstrom Jahresrechnung 2025"],
    ["2025-03-05", "1026,00", "Müllabfuhr", "Abfallgebühren 2025"],
    ["2025-04-02", "912,00", "Gebäudeversicherung", "Gebäudeversicherung Beitrag 2025"],
    ["2025-05-20", "1368,00", "Treppenhausreinigung", "Treppenhausreinigung 2025"],
  ];
  await p.goto(`${BASE}/verwaltung/weg/${PID}/buchhaltung`, { waitUntil: "networkidle" });
  const schonGebucht = await p.locator("text=Hausmeisterdienst Jahrespauschale 2025").count();
  if (schonGebucht === 0) {
    for (const [datum, betrag, kostenart, text] of AUSGABEN) {
      await p.goto(`${BASE}/verwaltung/weg/${PID}/buchhaltung`, { waitUntil: "networkidle" });
      const form = p.locator('form:has(select[name="kind"])').first();
      await form.locator('select[name="kind"]').selectOption("AUSGABE");
      await form.locator('input[name="bookingDate"]').fill(datum);
      await form.locator('input[name="amount"]').fill(betrag);
      await form.locator('select[name="costTypeId"]').selectOption({ label: kostenart }).catch(() => {});
      await form.locator('input[name="text"], textarea[name="text"]').fill(text);
      await form.locator('button[type="submit"]').first().click();
      await p.waitForTimeout(1200);
      console.log("gebucht:", text);
    }
  } else {
    console.log("Buchungen 2025 existieren bereits");
  }

  // ── Jahresabrechnung 2025 ────────────────────────────────────────────────
  await p.goto(`${BASE}/verwaltung/weg/${PID}/jahresabrechnung`, { waitUntil: "networkidle" });
  const schonDa = await p.locator('a:has-text("2025")').count();
  if (schonDa === 0) {
    await p.fill('input[name="year"]', "2025");
    await p.click('button:has-text("Jahresabrechnung erstellen"), button[type="submit"]');
    await p.waitForTimeout(2500);
    console.log("Jahresabrechnung 2025 angelegt:", p.url());
  } else {
    console.log("Jahresabrechnung 2025 existiert bereits");
  }

  // ── Beschlusssammlung ────────────────────────────────────────────────────
  for (const b of BESCHLUESSE) {
    await p.goto(`${BASE}/beschluesse`, { waitUntil: "networkidle" });
    if (await p.locator(`text=${b.titel}`).count()) {
      console.log("Beschluss existiert:", b.titel);
      continue;
    }
    await p.fill('input[name="title"]', b.titel);
    await p.fill('textarea[name="description"]', b.text);
    await p.click('form:has(input[name="title"]) button[type="submit"]');
    await p.waitForTimeout(1500);
    console.log("Beschluss angelegt:", b.titel);
  }

  // ── Beschlüsse entscheiden ───────────────────────────────────────────────
  // Die Beschluss-Sammlung (§ 24 Abs. 7 WEG) führt nur ENTSCHIEDENE Beschlüsse
  // mit laufender Nummer. Offene stehen dort nicht — die Sammlung wäre sonst
  // leer, obwohl Beschlüsse angelegt sind.
  //
  // Die Karte ist ein DIV, kein li/article; deshalb wird hier nicht über die
  // Karte gesucht, sondern direkt über das Formular, das den Knopf trägt.
  for (let i = 0; i < BESCHLUESSE.length; i++) {
    await p.goto(`${BASE}/beschluesse`, { waitUntil: "networkidle" });
    const form = p.locator('form:has(button:has-text("Schließen"))').first();
    if (!(await form.count())) { console.log("nichts mehr zu entscheiden"); break; }
    await form.locator('select[name="result"]').selectOption("ANGENOMMEN").catch(() => {});
    await form.locator('button:has-text("Schließen")').click();
    await p.waitForTimeout(1600);
    console.log("Beschluss entschieden");
  }

  await ctx.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
