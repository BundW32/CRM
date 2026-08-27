import { seite, h } from "../lib/seite.mjs";
import { wert } from "../lib/tokens.mjs";

const EIGENES_CSS = `
  .band { border-radius: var(--radius-lg); overflow: hidden; position: relative; margin-top: 20px; }
  .hero { min-height: 300px; display: flex; align-items: center; background: linear-gradient(120deg, #6d5c46 0%, #8a7357 55%, #a08a68 100%); }
  .hero .schleier { position: absolute; inset: 0; background: linear-gradient(to right, color-mix(in srgb, var(--color-wp-ink) 95%, transparent), color-mix(in srgb, var(--color-wp-ink) 70%, transparent) 55%, color-mix(in srgb, var(--color-wp-ink) 20%, transparent)); }
  .hero .inhalt { position: relative; padding: 44px 40px; max-width: 620px; }
  .hero .augenbrauePille { display: inline-flex; align-items: center; border-radius: 999px; border: 1px solid rgba(255,255,255,.3); background: rgba(255,255,255,.1); padding: 4px 12px; font-size: 11.5px; font-weight: 600; letter-spacing: .04em; color: #fff; margin-bottom: 18px; }
  .hero h3 { font-family: var(--font-mk); font-size: 34px; font-weight: 800; line-height: 1.12; color: #fff; margin: 0; text-wrap: balance; }
  .hero p { color: rgba(255,255,255,.85); font-size: 15.5px; line-height: 1.6; margin: 16px 0 0; max-width: 46ch; }
  .hero .aktionen { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
  .knopfHaupt { display: inline-flex; align-items: center; gap: 8px; border-radius: var(--radius-xl); background: var(--color-wp-accent); color: var(--color-wp-on-accent); padding: 10px 20px; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: var(--shadow-e1); }
  .knopfFoto { display: inline-flex; align-items: center; border-radius: var(--radius-xl); border: 1px solid rgba(255,255,255,.4); background: rgba(255,255,255,.1); padding: 10px 20px; font-size: 14px; font-weight: 600; color: #fff; text-decoration: none; }
  .kennzahl { position: absolute; right: 26px; bottom: 26px; display: flex; align-items: center; gap: 10px; border-radius: var(--radius-xl); border: 1px solid #e5e7eb; background: #fff; padding: 10px 14px; font-size: 13.5px; font-weight: 600; color: #1f2937; box-shadow: var(--shadow-e3); }
  .kennzahl .kaestchen { display: flex; height: 28px; width: 28px; align-items: center; justify-content: center; border-radius: var(--radius-md); background: var(--color-wp-accent-light); color: var(--color-wp-accent-ink); }
  .zahlenband { background: var(--color-wp-ink); padding: 40px; position: relative; overflow: hidden; }
  .zahlenband .licht1 { position: absolute; right: -60px; top: -60px; height: 200px; width: 200px; border-radius: 999px; background: color-mix(in srgb, var(--color-wp-accent) 15%, transparent); filter: blur(50px); }
  .zahlenband .licht2 { position: absolute; left: -60px; bottom: -80px; height: 200px; width: 200px; border-radius: 999px; background: color-mix(in srgb, var(--color-wp-primary) 50%, transparent); filter: blur(50px); }
  .zahlenband .gitter { position: relative; display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 26px; }
  .zahlenband .zahl { font-family: var(--font-display); font-size: 46px; font-weight: 800; letter-spacing: -.03em; color: var(--color-wp-accent-bright); margin: 0; line-height: 1; }
  .zahlenband .was { color: rgba(255,255,255,.8); font-size: 13.5px; line-height: 1.55; margin: 10px 0 0; }
  .abschluss { background: var(--color-wp-primary); border-radius: var(--radius-lg); padding: 48px 30px; text-align: center; position: relative; overflow: hidden; box-shadow: var(--shadow-e3); }
  .abschluss h3 { font-family: var(--font-mk); font-size: 27px; font-weight: 700; color: #fff; margin: 0; text-wrap: balance; }
  .abschluss p { color: rgba(255,255,255,.8); margin: 12px auto 0; max-width: 46ch; font-size: 15px; }
  .abschluss .klein { color: rgba(255,255,255,.6); font-size: 13.5px; margin-top: 22px; }
  .abschluss .klein a { color: var(--color-wp-accent-bright); font-weight: 500; }
  .fotoband { min-height: 190px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #5f5140, #7c6a52); }
  .fotoband .schleier { position: absolute; inset: 0; background: color-mix(in srgb, var(--color-wp-ink) 60%, transparent); }
  .fotoband h3 { position: relative; font-family: var(--font-mk); font-size: 25px; font-weight: 800; color: #fff; text-align: center; margin: 0; padding: 0 30px; text-wrap: balance; }
`;

const PFEIL = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

// Die Zahlen im Band sind Produkt- und Gesetzes-Fakten – keine Marketing-Zahlen.
const zahlen = [
  ["0 €", "Der Start: kostenlos einrichten, ohne Zahlungsdaten"],
  ["&lt; 9", "Einheiten: keine Zertifizierungspflicht für den Eigentümer-Verwalter (§ 19 WEG)"],
  ["100 %", "Ihrer Daten exportierbar – Journal und Kontoblatt als CSV, kein Lock-in"],
];

export function bauen(tokens) {
  const hero = h.abschnitt(
    "Hero",
    `    <div class="band hero">
      <div class="schleier"></div>
      <div class="inhalt">
        <span class="augenbrauePille">Selbstverwaltete WEG</span>
        <h3>Ihre Eigentümergemeinschaft, selbst verwaltet</h3>
        <p>Von der ersten Buchung über Versammlung und Beschluss bis zur revisionssicheren Jahresabrechnung.</p>
        <div class="aktionen">
          <a class="knopfHaupt" href="#">Kostenlos starten ${PFEIL}</a>
          <a class="knopfFoto" href="#">So funktioniert’s</a>
        </div>
      </div>
      <div class="kennzahl"><span class="kaestchen"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m5 12 5 5 9-10"/></svg></span>Ohne Zahlungsdaten</div>
    </div>
${h.notiz(
  "Das Foto füllt die ganze Sektion, der Text liegt darauf. Der Verlauf ist links dicht und gibt " +
    "das Bild nach rechts frei – so bleibt die Überschrift lesbar, ohne das Foto zuzudecken. Der " +
    "Ken-Burns-Zoom läuft über 20 Sekunden und ist kaum merklich; der Bildcontainer ist etwas " +
    "größer als der sichtbare Ausschnitt, damit beim Zoomen keine Kanten auftauchen.",
)}`,
    "Der erste Bildschirm: Augenbraue, Versprechen, ein Satz Erklärung, die eine Handlung. Auf " +
      "375 × 667 px liegt der Haupt-CTA ohne Scrollen im Bild – gemessen, nicht geschätzt.",
  );

  const band = h.abschnitt(
    "Zahlenband",
    `    <div class="band zahlenband">
      <div class="licht1"></div><div class="licht2"></div>
      <div class="gitter">
${zahlen
  .map(([z, w]) => `        <div><p class="zahl">${z}</p><p class="was">${w}</p></div>`)
  .join("\n")}
      </div>
    </div>
${h.notiz(
  "<strong>Dunkelgrün, nicht Grün – und das aus einem Grund.</strong> Die Zahlen stehen in Orange " +
    "darauf und erreichen auf <code>--color-wp-ink</code> 7,0:1 statt 5,7:1 auf " +
    "<code>--color-wp-primary</code>. Die Zahlen sind der Grund für dieses Band; die Fläche " +
    "richtet sich nach ihnen.",
)}
${h.notiz(
  "<strong>Keine Marketing-Zahlen.</strong> Vertrauens-Fakten sind Produkt- oder Gesetzes-Fakten: " +
    "kostenlos, ohne Zahlungsdaten, Paragrafenangaben, echte Zahlen aus dem Demo-Datenbestand. " +
    "Kein „500+ zufriedene Kunden“ – das Portal ist neu, und eine erfundene Zahl ist der " +
    "schnellste Weg, das Vertrauen zu verlieren, um das es hier geht.",
  "warnung",
)}`,
  );

  const rest = h.abschnitt(
    "Foto-Zwischenschnitt und Abschluss",
    `    <div class="band fotoband">
      <div class="schleier"></div>
      <h3>Der Wirtschaftsplan wird beschlossen, nicht beantragt</h3>
    </div>
    <div class="band abschluss" id="schluss-cta">
      <h3>In zehn Minuten eingerichtet</h3>
      <p>Legen Sie Ihre Gemeinschaft an und sehen Sie sich alles in Ruhe an. Kostenlos, ohne Zahlungsdaten.</p>
      <div style="margin-top:26px"><a class="knopfHaupt" href="#" style="padding:12px 24px;font-size:16px">Jetzt kostenlos starten ${PFEIL}</a></div>
      <p class="klein">Fragen vorab? <a href="#">Schreiben Sie uns</a></p>
    </div>
${h.notiz(
  "Der Abschluss trägt den Anker <code>#schluss-cta</code> – daran erkennt die mobile Leiste, " +
    "dass sie sich ausblenden darf. <strong>Die Fußzeile gehört mit in diesen Block</strong>, " +
    "sonst taucht die Leiste am Seitenende wieder auf.",
)}
${h.notiz(
  "Der Verweis geht in den Kontakt-Funnel, nicht in ein <code>mailto:</code>: Der Funnel fragt " +
    "das Anliegen ab und bestätigt den Eingang – ein <code>mailto:</code>-Link öffnet auf Geräten " +
    "ohne eingerichtetes Mail-Programm schlicht nichts.",
)}`,
    "Der Zwischenschnitt ist atmosphärisch und trägt genau einen Satz. Das Abschluss-Band steht " +
      "auf jeder öffentlichen Seite gleich und wiederholt die eine Handlung.",
  );

  return seite({
    gruppe: "Muster",
    name: "Bänder",
    untertitel: "Hero, Zahlenband, Zwischenschnitt, Abschluss",
    breite: 1280,
    hoehe: 2470,
    augenbraue: "Muster",
    titel: "Bänder",
    einleitung:
      "Die öffentlichen Seiten sind aus wenigen, ganzflächigen Bändern gebaut. Jedes hat eine " +
      "Aufgabe – und keins wiederholt die Aufgabe eines anderen.",
    inhalt: [hero, band, rest].join("\n"),
    quellen: [
      "components/marketing/site.tsx (MarketingHero, StatsBand, PhotoBand, CtaBand, FeatureSection)",
      "components/marketing/photo-hero.tsx (KenBurnsBackdrop)",
    ],
    tokens,
    eigenesCss: EIGENES_CSS,
  });
}
