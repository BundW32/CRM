// Gemeinsamer Rahmen aller Vorschau-Seiten.
//
// Jede erzeugte Datei steht für sich: Die Tokens werden als `:root`-Block
// hineingeschrieben, es gibt keinen Verweis auf ein gemeinsames Stylesheet.
// Das ist Absicht — die Dateien werden einzeln in ein Claude-Design-Projekt
// hochgeladen und dort einzeln gerendert; eine fehlende Nachbardatei würde
// sonst eine leere Karte ergeben. Die eine Kopie, die dabei entsteht, ist
// erzeugt und nicht getippt: Sie kann nicht auseinanderlaufen, weil sie bei
// jedem `node design-system/bauen.mjs` neu aus `globals.css` kommt.

import { wert } from "./tokens.mjs";

/** Die Tokens, die eine Vorschau-Seite braucht, als `:root`-Block. */
function tokenBlock(tokens) {
  const gebraucht = [...tokens.keys()].filter(
    (name) =>
      name.startsWith("--color-") ||
      name.startsWith("--font-") ||
      name.startsWith("--radius-") ||
      name.startsWith("--shadow-") ||
      name.startsWith("--ease-"),
  );
  return gebraucht.map((name) => `    ${name}: ${tokens.get(name)};`).join("\n");
}

/** Schriftschnitte – relativ zur Vorschau-Datei, mit tragfähigem Ersatz. */
function schriftBlock(tiefe) {
  const auf = "../".repeat(tiefe);
  return ["400", "600"]
    .map(
      (schnitt) => `  @font-face {
    font-family: "Source Sans 3";
    font-style: normal;
    font-weight: ${schnitt};
    font-display: swap;
    src: url("${auf}schrift/sourcesans-${schnitt}.woff2") format("woff2");
  }`,
    )
    .join("\n");
}

const RAHMEN_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 40px 32px 56px;
    background: #faf8f4;
    background-image:
      radial-gradient(90% 60% at 85% -10%, rgba(246,144,24,.10) 0%, rgba(246,144,24,0) 55%),
      radial-gradient(80% 55% at 0% -5%, rgba(0,54,48,.07) 0%, rgba(0,54,48,0) 60%);
    color: #374151;
    font-family: var(--font-mk);
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  .bogen { max-width: 1120px; margin: 0 auto; }
  .kopf { margin-bottom: 40px; }
  .kopf h1 {
    font-family: var(--font-mk);
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -.02em;
    line-height: 1.15;
    color: var(--color-wp-ink);
    margin: 0;
  }
  .kopf p { margin: 10px 0 0; max-width: 62ch; color: #4b5563; }
  .augenbraue {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--color-wp-accent-ink);
    margin: 0 0 10px;
  }
  section { margin-top: 40px; }
  section > h2 {
    font-family: var(--font-mk);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--color-wp-ink);
    margin: 0 0 4px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(0,36,31,.14);
  }
  section > h2 + .hinleitung { margin-top: 14px; }
  .hinleitung { max-width: 68ch; color: #4b5563; margin: 14px 0 20px; }
  .raster { display: grid; gap: 16px; margin-top: 20px; }
  .raster.zwei { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .raster.drei { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .raster.vier { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
  .feld {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: var(--radius-lg);
    padding: 18px;
    box-shadow: var(--shadow-e1);
  }
  .feld > h3 {
    font-family: var(--font-mk);
    font-size: 14px;
    font-weight: 600;
    color: var(--color-wp-ink);
    margin: 0 0 6px;
  }
  .feld p { margin: 0; font-size: 13.5px; color: #6b7280; }
  code, .token {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--color-wp-primary);
    background: rgba(0,54,48,.06);
    border-radius: 5px;
    padding: 1px 5px;
  }
  .notiz {
    margin-top: 20px;
    border-left: 3px solid var(--color-wp-accent);
    background: var(--color-wp-accent-light);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    padding: 13px 16px;
    font-size: 13.5px;
    color: #4b3a22;
    max-width: 78ch;
  }
  .notiz strong { color: var(--color-wp-ink); }
  .notiz code { background: rgba(0,36,31,.08); }
  .warnung { border-left-color: #c23b2e; background: #fbe7e3; color: #6b241b; }
  .warnung strong { color: #7f2318; }
  .buehne {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: var(--radius-lg);
    padding: 26px;
    margin-top: 20px;
  }
  .buehne.dunkel { background: var(--color-wp-ink); border-color: rgba(255,255,255,.10); }
  .buehne.papier { background: #faf8f4; }
  .beschriftung {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #9ca3af;
    margin: 0 0 14px;
  }
  .buehne.dunkel .beschriftung { color: rgba(255,255,255,.45); }
  .reihe { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
  table { border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 13.5px; }
  th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  th {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #9ca3af;
  }
  td.zahl { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .marke {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 600;
    border-radius: 999px;
    padding: 2px 9px;
    white-space: nowrap;
  }
  .marke.gut { background: #e4f2ea; color: #14603f; }
  .marke.schwach { background: #fdf0df; color: #8a5209; }
  .marke.schlecht { background: #fbe7e3; color: #9b2f23; }
  .quelle {
    margin-top: 52px;
    padding-top: 16px;
    border-top: 1px solid rgba(0,36,31,.12);
    font-size: 12.5px;
    color: #9ca3af;
  }
  .quelle strong { color: #6b7280; font-weight: 600; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      transition-duration: .01ms !important;
    }
  }
`;

/**
 * Baut eine vollständige Vorschau-Seite.
 *
 * `gruppe` landet im `@dsCard`-Marker in der ersten Zeile – daraus baut die
 * Design-System-Ansicht ihre Abschnitte.
 */
export function seite({
  gruppe,
  name,
  untertitel = "",
  breite = 1200,
  hoehe = 900,
  tiefe = 1,
  augenbraue,
  titel,
  einleitung = "",
  inhalt,
  quellen = [],
  tokens,
  eigenesCss = "",
}) {
  const markerTeile = [
    `group="${gruppe}"`,
    `name="${name}"`,
    untertitel ? `subtitle="${untertitel}"` : "",
    `width="${breite}"`,
    `height="${hoehe}"`,
  ].filter(Boolean);

  const quellenZeile = quellen.length
    ? `<p class="quelle"><strong>Im Code:</strong> ${quellen
        .map((q) => `<code>${q}</code>`)
        .join(" · ")}<br>Erzeugt von <code>design-system/bauen.mjs</code> – nicht von Hand ändern.</p>`
    : "";

  return `<!-- @dsCard ${markerTeile.join(" ")} -->
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titel} – wegportal24</title>
<style>
  :root {
${tokenBlock(tokens)}
  }
${schriftBlock(tiefe)}
${RAHMEN_CSS}
${eigenesCss}
</style>
</head>
<body>
<div class="bogen">
  <header class="kopf">
    <p class="augenbraue">${augenbraue}</p>
    <h1>${titel}</h1>
    ${einleitung ? `<p>${einleitung}</p>` : ""}
  </header>
${inhalt}
  ${quellenZeile}
</div>
</body>
</html>
`;
}

/** Kleine Helfer, damit die Karten-Dateien lesbar bleiben. */
export const h = {
  abschnitt: (titel, inhalt, hinleitung = "") =>
    `  <section>
    <h2>${titel}</h2>
    ${hinleitung ? `<p class="hinleitung">${hinleitung}</p>` : ""}
${inhalt}
  </section>`,
  notiz: (inhalt, art = "") => `    <p class="notiz ${art}">${inhalt}</p>`,
  buehne: (beschriftung, inhalt, art = "") =>
    `    <div class="buehne ${art}">
      ${beschriftung ? `<p class="beschriftung">${beschriftung}</p>` : ""}
      ${inhalt}
    </div>`,
};

export { wert };
