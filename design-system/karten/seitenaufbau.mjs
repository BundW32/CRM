import { seite, h } from "../lib/seite.mjs";

const EIGENES_CSS = `
  .leiter { counter-reset: stufe; border: 1px solid #e5e7eb; border-radius: var(--radius-lg); overflow: hidden; background: #fff; margin-top: 20px; }
  .stufe { display: grid; grid-template-columns: 52px 1fr 240px; gap: 20px; padding: 16px 20px; border-bottom: 1px solid #f3f4f6; align-items: start; }
  .stufe:last-child { border-bottom: 0; }
  .stufe .nr {
    display: flex; align-items: center; justify-content: center; height: 30px; width: 30px;
    border-radius: 999px; background: var(--color-wp-primary-light); color: var(--color-wp-primary);
    font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .stufe.oben .nr { background: var(--color-wp-accent); color: var(--color-wp-on-accent); }
  .stufe b { display: block; font-size: 14.5px; font-weight: 600; color: var(--color-wp-ink); margin-bottom: 4px; }
  .stufe p { margin: 0; font-size: 13px; color: #6b7280; }
  .stufe .baustein { font-size: 12px; color: #9ca3af; line-height: 1.7; }
  .regel { border-left: 3px solid var(--color-wp-primary); background: #fff; border: 1px solid #e5e7eb; border-left: 3px solid var(--color-wp-primary); border-radius: 0 var(--radius-lg) var(--radius-lg) 0; padding: 17px 20px; }
  .regel h3 { margin: 0 0 7px; font-size: 14px; font-weight: 600; color: var(--color-wp-ink); }
  .regel p { margin: 0; font-size: 13px; color: #6b7280; }
  .regel.rot { border-left-color: var(--color-critical); }
  .pruef { background: var(--color-wp-ink); border-radius: var(--radius-lg); padding: 22px 24px; margin-top: 20px; }
  .pruef p.was { margin: 0 0 12px; font-size: 12px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.45); }
  .pruef pre { margin: 0; overflow-x: auto; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.65; color: #f3f4f6; }
  .pruef .folge { margin: 15px 0 0; font-size: 13px; color: rgba(255,255,255,.7); }
`;

const elemente = [
  ["1", "Sprechende URLs", "<code>/funktionen/hausgeld</code>, nicht <code>/f/12</code>. Die Adresse sagt, worum es geht – für den Besucher wie für die Suchmaschine.", "App-Router-Pfade"],
  ["2", "Logo oben links", "Wortmarke in der Kopfzeile, verlinkt auf die Startseite. Auf jeder Breite an derselben Stelle.", "<code>MarketingHeader</code><br><code>Wordmark</code>"],
  ["3", "SEO-Titel", "Die Überschrift nennt das Problem in den Worten, mit denen Betroffene danach suchen – „Keine Hausverwaltung gefunden?“", "<code>&lt;h1&gt;</code> im Hero<br><code>metadata</code>"],
  ["4", "Haupt-CTA", "Die eine Handlung. Läuft eine Willkommensaktion, nimmt der Knopf den Code mit – wer hier klickt, muss ihn nicht abschreiben.", "<code>wpButtonClass</code><br><code>registrierenLink()</code>"],
  ["5", "Vertrauens-Fakten", "Produkt- und Gesetzesfakten statt Sternen: kostenlos, ohne Bank-API, nach §§ 19, 24, 28 WEG.", "Liste im Hero"],
  ["6", "Das Produkt in Bewegung", "Der Scroll-Aufbau – das Comic-Haus, das sich beim Scrollen zusammensetzt. Es ist <em>das</em> Bewegtbild-Element der Startseite und bleibt.", "<code>ScrollyBuild</code>"],
  ["7", "Nutzen-Karten", "Sechs Karten, jede mit einem Weg auf ihre Unterseite. Keine Sackgassen.", "Karten + <code>Reveal</code>"],
  ["8", "Stimmen", "Drei Rollen in direkter Ansprache – „Sie übernehmen das Amt“. Keine erfundenen Namen, Fotos oder Sterne.", "Rollen-Karten"],
  ["9", "FAQ", "Natives <code>&lt;details&gt;</code>. Kein Client-JS, kein Accordion-Paket.", "<code>&lt;details&gt;</code>"],
  ["10", "Abschluss-CTA", "Dieselbe Handlung wie oben, jetzt mit dem Wissen von der ganzen Seite. Trägt den Anker <code>#schluss-cta</code>.", "<code>CtaBand</code>"],
  ["11", "Fußzeile", "Kontakt und Rechtliches. Sie bleibt im Anker-Block, damit die mobile Leiste am Seitenende nicht wieder auftaucht.", "<code>MarketingFooter</code>"],
];

const regeln = [
  [
    "Keine erfundenen Kundenstimmen",
    "Das Portal ist neu. Der Stimmen-Slot wird mit Rollen in direkter Ansprache gefüllt, nie mit erfundenen Namen, Fotos oder Sternen – und auch nicht mit erzählten Einzelpersonen („Die Eigentümerin, die …“). Ein Fallbericht über eine Person, die es nicht gibt, ist eine erfundene Referenz.",
    "rot",
  ],
  [
    "Jede Funktionsbehauptung ist am Code geprüft",
    "Bevor eine Zusage auf die Seite kommt, wird sie im Code nachgesehen. Paragrafen nur, wenn sie stimmen.",
    "rot",
  ],
  [
    "Nur selbstverwaltete WEGs ansprechen",
    "Die Registrierung kennt genau einen Kontotyp, serverseitig erzwungen. Die Seiten bieten nichts anderes an.",
    "",
  ],
  [
    "Preise haben eine Quelle",
    "<code>app/preise/preise-daten.ts</code>. Beide Tarife je Einheit und Monat, alle Zugänge immer inklusive, Bruttopreise, keine Mindestlaufzeit. Die Brutto-Transparenz ist ein Verkaufsargument – „10 € sind bei uns 10 €“ –, kein Detail.",
    "",
  ],
  [
    "Herkunft ohne Namen",
    "Auf den Seiten steht weder Firma noch Person, nur „die Verwaltung hinter wegportal24“. Namen stehen im Impressum, wo sie nach § 5 DDG hingehören.",
    "",
  ],
  [
    "Kein ShadCN, keine UI-Bibliothek",
    "Das Repo hat eigene Bausteine und harte ESLint-Regeln gegen Nachbauten. Der Rahmen wird mit <code>components/marketing/*</code> umgesetzt.",
    "",
  ],
];

export function bauen(tokens) {
  const rahmen = h.abschnitt(
    "Der 11-Elemente-Rahmen",
    `    <div class="leiter">
${elemente
  .map(
    ([nr, titel, text, baustein]) => `      <div class="stufe${Number(nr) <= 5 ? " oben" : ""}">
        <span class="nr">${nr}</span>
        <div><b>${titel}</b><p>${text}</p></div>
        <div class="baustein">${baustein}</div>
      </div>`,
  )
  .join("\n")}
    </div>
${h.notiz(
  "<strong>Der Aufbau ist zweimal entschieden worden.</strong> Ein „Dokument“-Layout aus " +
    "Haarlinien und Marginalspalten wurde verworfen; verbindlich ist dieser Rahmen. Wer ihn " +
    "erneut ändern will, fragt zuerst.",
  "warnung",
)}
${h.notiz(
  "Die orange markierten Elemente 1–5 liegen im ersten Bildschirm. Auf 375 × 667 px muss der " +
    "Haupt-CTA ohne Scrollen im Bild liegen – mit Playwright gemessen " +
    "(<code>getBoundingClientRect().bottom ≤ 667</code>), nicht abgeschätzt.",
)}`,
    "Er gilt für die Startseite, <code>/preise</code>, alle <code>/funktionen/*</code> und " +
      "<code>/so-funktionierts</code>. Die Reihenfolge ist die Reihenfolge, in der jemand eine " +
      "Entscheidung trifft.",
  );

  const inhalt = h.abschnitt(
    "Inhaltsregeln",
    `    <div class="raster zwei">
${regeln
  .map(
    ([titel, text, art]) =>
      `      <div class="regel ${art}"><h3>${titel}</h3><p>${text}</p></div>`,
  )
  .join("\n")}
    </div>`,
    "Sie sind nicht verhandelbar. Jede von ihnen steht dort, weil ihr Gegenteil einmal " +
      "vorgeschlagen oder gebaut wurde.",
  );

  const pruefung = h.abschnitt(
    "Der Prüfbefehl",
    `    <div class="pruef">
      <p class="was">Vor und nach jeder Änderung</p>
      <pre>npx --yes impeccable@latest detect \\
  portal/src/app/page.tsx \\
  portal/src/app/preise \\
  portal/src/app/funktionen \\
  portal/src/app/so-funktionierts \\
  portal/src/components/marketing</pre>
      <p class="folge">Auf diesen fünf Pfaden gilt: <strong style="color:#fff">null Befunde</strong>. Danach <code style="background:rgba(255,255,255,.12);color:#fff">npm run pruefung</code> im Ordner <code style="background:rgba(255,255,255,.12);color:#fff">portal</code> – und ansehen.</p>
    </div>
${h.notiz(
  "<code>globals.css</code> ist vom Detektor ausgenommen: Die dortigen Resttreffer betreffen das " +
    "ganze Portal, nicht diese Seiten.",
)}
${h.notiz(
  "<strong>Ansehen heißt wirklich ansehen.</strong> <code>next dev</code> funktioniert in diesem " +
    "Repo nicht – die Content-Security-Policy verbietet <code>eval</code>. Es gilt " +
    "<code>APP_MODE=weg next build &amp;&amp; next start</code>.",
)}`,
    "Ein Detektor, der offline aus einem npm-Paket läuft und die typischen Stilbrüche meldet: " +
      "Sprungkurven, <code>animate-bounce</code>, verirrte Farbwerte.",
  );

  return seite({
    gruppe: "Muster",
    name: "Seitenaufbau",
    untertitel: "Elf Elemente, sechs Inhaltsregeln, ein Prüfbefehl",
    breite: 1200,
    hoehe: 2750,
    augenbraue: "Muster",
    titel: "Seitenaufbau",
    einleitung:
      "Jede öffentliche Seite folgt demselben Rahmen. Das ist keine Bequemlichkeit: Wer zum " +
      "ersten Mal hier ist, sucht auf der zweiten Seite an der Stelle, an der er es auf der " +
      "ersten gefunden hat.",
    inhalt: [rahmen, inhalt, pruefung].join("\n"),
    quellen: [
      "portal/src/app/page.tsx (Elemente 1–11 im Code benannt)",
      ".claude/skills/marken-seiten/SKILL.md",
      "app/preise/preise-daten.ts",
    ],
    tokens,
    eigenesCss: EIGENES_CSS,
  });
}
