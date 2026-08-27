import { seite, h } from "../lib/seite.mjs";
import { wert } from "../lib/tokens.mjs";

const EIGENES_CSS = `
  .probe { border-bottom: 1px solid #eef0ee; padding: 18px 0; display: grid; grid-template-columns: 190px 1fr; gap: 24px; align-items: baseline; }
  .probe:last-child { border-bottom: 0; }
  .probe .angabe { font-size: 12px; color: #9ca3af; font-variant-numeric: tabular-nums; line-height: 1.45; }
  .probe .angabe b { display: block; color: var(--color-wp-ink); font-size: 12.5px; font-weight: 600; }
  .probe .text { color: var(--color-wp-ink); }
  .satz { max-width: 62ch; }
  .gegenprobe { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
  .gegenprobe > div { border: 1px solid #e5e7eb; border-radius: var(--radius-lg); padding: 20px; background: #fff; }
  .gegenprobe .zeile { font-size: 26px; font-weight: 700; letter-spacing: -.025em; color: var(--color-wp-ink); margin: 0 0 4px; }
  .gegenprobe p.wo { font-size: 12.5px; color: #6b7280; margin: 10px 0 0; }
`;

const groessen = [
  ["Seitentitel (H1)", "36–48 px · 800 · −0,02em", "font-size:40px;font-weight:800;letter-spacing:-.02em;line-height:1.1", "Ihre Eigentümergemeinschaft, selbst verwaltet"],
  ["Abschnitt (H2)", "24–30 px · 700", "font-size:28px;font-weight:700;letter-spacing:-.015em;line-height:1.2", "Wirtschaftsplan, Abrechnung, Beschluss"],
  ["Unterabschnitt (H3)", "18–20 px · 600", "font-size:19px;font-weight:600;line-height:1.3", "Was Sie im ersten Monat tun"],
  ["Vorspann", "17–18 px · 400 · 1,6", "font-size:17px;font-weight:400;line-height:1.6;color:#4b5563", "Von der ersten Buchung über Versammlung und Beschluss bis zur revisionssicheren Jahresabrechnung."],
  ["Fließtext", "15–16 px · 400 · 1,55", "font-size:15.5px;font-weight:400;line-height:1.6;color:#4b5563", "Der Wirtschaftsplan wird beschlossen, nicht beantragt – § 28 Absatz 1 WEG."],
  ["Augenbraue", "11–12 px · 600 · 0,18em · Versalien", "font-size:11.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--color-wp-accent-ink)", "So funktioniert’s"],
  ["Kleingedrucktes", "12,5–13 px · 400", "font-size:13px;color:#6b7280", "Alle Preise sind Bruttopreise inklusive Mehrwertsteuer."],
];

export function bauen(tokens) {
  const mk = wert(tokens, "--font-mk");
  const sans = wert(tokens, "--font-sans");
  const display = wert(tokens, "--font-display");

  const familien = h.abschnitt(
    "Zwei Schriftwelten, klar getrennt",
    `    <div class="gegenprobe">
      <div>
        <p class="zeile" style="font-family:var(--font-mk)">Source Sans 3</p>
        <span class="token">--font-mk</span>
        <p class="wo"><b>Die öffentlichen Seiten.</b> Startseite, Funktionen, Preise,
        So funktioniert’s, Rechtstexte. Es ist dieselbe Schrift, in der das Portal
        Wirtschaftsplan, Jahresabrechnung und Mahnungen setzt
        (<code>lib/documents/kit/fonts.ts</code>) – die Seite steht damit im Schriftbild
        der Papiere, die sie verspricht.</p>
      </div>
      <div>
        <p class="zeile" style="font-family:var(--font-display)">Plus Jakarta Sans</p>
        <span class="token">--font-display</span>
        <p class="wo"><b>Überschriften im Portal</b> hinter dem Login – und nur dort.
        Auf den Marken-Seiten hat sie nichts zu suchen.</p>
      </div>
      <div>
        <p class="zeile" style="font-family:var(--font-sans)">Inter</p>
        <span class="token">--font-sans</span>
        <p class="wo"><b>Fließtext im Portal</b> hinter dem Login. Tabellenziffern laufen
        überall auf <code>tabular-nums</code> – Beträge untereinander müssen fluchten.</p>
      </div>
    </div>
${h.notiz(
  "<strong>Die Falle:</strong> <code>h1, h2, h3</code> bekommen in <code>globals.css</code> " +
    "global die Display-Schrift zugewiesen. Ein Element-Selektor sticht die Vererbung von " +
    "<code>.mk-light</code> – die Überschriften der Marken-Seiten liefen deshalb einmal in " +
    "Plus Jakarta Sans, während der Fließtext daneben schon in Source Sans stand. Sichtbar " +
    "war das erst im direkten Vergleich. Die Gegenregel <code>.mk-light :is(h1,h2,h3)</code> " +
    "hält das gerade – <em>nicht entfernen</em>.",
  "warnung",
)}`,
    "Welche Schrift wo gilt, ist keine Geschmacksfrage: Die Trennung sagt dem Besucher, ob er vor " +
      "der Marke steht oder schon in seinem Portal arbeitet.",
  );

  const skala = h.abschnitt(
    "Größen",
    `    <div class="buehne">
${groessen
  .map(
    ([name, angabe, stil, text]) => `      <div class="probe">
        <div class="angabe"><b>${name}</b>${angabe}</div>
        <div class="text satz" style="font-family:var(--font-mk);${stil}">${text}</div>
      </div>`,
  )
  .join("\n")}
    </div>
${h.notiz(
  "Zeilenlänge höchstens rund 68 Zeichen. Auf den Marken-Seiten steht an den Stellen, an denen " +
    "eine Überschrift auf zwei Zeilen umbricht, <code>text-balance</code> – sonst hängt ein " +
    "einzelnes Wort in der zweiten Zeile.",
)}`,
    "Die Skala ist bewusst kurz. Sieben Rollen reichen für eine Produktseite; jede weitere Größe " +
      "ist eine Entscheidung, die später jemand anders anders trifft.",
  );

  const stapel = h.abschnitt(
    "Schriftschnitte und Auslieferung",
    `    <table>
      <thead><tr><th>Token</th><th>Wert</th><th>Schnitte im Build</th></tr></thead>
      <tbody>
        <tr><td><code>--font-mk</code></td><td>${mk}</td><td class="zahl">400, 600</td></tr>
        <tr><td><code>--font-sans</code></td><td>${sans}</td><td class="zahl">400, 500, 600, 700</td></tr>
        <tr><td><code>--font-display</code></td><td>${display}</td><td class="zahl">600, 700, 800</td></tr>
      </tbody>
    </table>
${h.notiz(
  "Alle Schriften liegen selbst gehostet als <code>woff2</code> unter " +
    "<code>portal/public/fonts/</code> – kein Google-CDN, damit keine IP-Adresse eines Besuchers " +
    "an einen Dritten geht, bevor er eingewilligt hat. <code>font-display: swap</code> verhindert " +
    "den Text-Blitz beim Laden.",
)}`,
  );

  return seite({
    gruppe: "Grundlagen",
    name: "Schrift",
    untertitel: "Source Sans 3 vorn, Inter und Jakarta hinter dem Login",
    breite: 1200,
    hoehe: 2160,
    augenbraue: "Grundlagen",
    titel: "Schrift",
    einleitung:
      "Die öffentlichen Seiten sprechen in derselben Schrift, in der das Portal später die " +
      "Abrechnung druckt. Das ist der ganze Trick: Wer die Seite liest, sieht schon, wie sein " +
      "Wirtschaftsplan aussehen wird.",
    inhalt: [familien, skala, stapel].join("\n"),
    quellen: [
      "portal/src/app/globals.css (@theme, @font-face, .mk-light)",
      "lib/documents/kit/fonts.ts",
    ],
    tokens,
    eigenesCss: EIGENES_CSS,
  });
}
