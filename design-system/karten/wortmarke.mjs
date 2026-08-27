import { seite, h } from "../lib/seite.mjs";
import { wert } from "../lib/tokens.mjs";

const EIGENES_CSS = `
  .wortmarke { display: inline-flex; align-items: center; gap: .625em; font-weight: 800; letter-spacing: -.025em; line-height: 1; }
  .wortmarke svg { height: 1em; width: 1em; flex-shrink: 0; }
  .schutzraum { position: relative; display: inline-block; padding: 1em; outline: 1px dashed rgba(0,54,48,.28); border-radius: 6px; }
  .schutzraum::after { content: "1 × Zeichenhöhe"; position: absolute; right: 8px; bottom: -20px; font-size: 10.5px; color: #9ca3af; letter-spacing: .04em; }
  .falsch { border: 1px solid #f3d3cd; background: #fdf4f2; border-radius: var(--radius-lg); padding: 18px; }
  .falsch .warum { font-size: 12.5px; color: #9b2f23; margin: 13px 0 0; }
  .falsch .schild { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #c23b2e; margin: 0 0 13px; }
  .groessen { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 34px; }
  .groessen figcaption { font-size: 11.5px; color: #9ca3af; margin-top: 11px; font-variant-numeric: tabular-nums; }
  .groessen figure { margin: 0; }
`;

// Das Bildzeichen: ein Quadrat, in ungleiche Anteile geteilt – wie eine
// Teilungserklärung ein Haus aufteilt. Nur Rechtecke, damit es bis auf
// Favicon-Größe und im Schwarzweiß-Druck lesbar bleibt.
function glyph(fest, akzent) {
  return `<svg viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="16" height="16" rx="2.5" fill="${fest}"/>
      <rect x="0" y="20" width="16" height="16" rx="2.5" fill="${fest}"/>
      <rect x="20" y="0" width="16" height="36" rx="2.5" fill="${akzent}"/>
    </svg>`;
}

function marke(tokens, { ton = "dark", groesse = "28px" } = {}) {
  const ink = wert(tokens, "--color-wp-ink");
  const akzent = wert(tokens, "--color-wp-accent");
  const fest = ton === "light" ? "#ffffff" : ink;
  const schrift = ton === "light" ? "#ffffff" : ink;
  return `<span class="wortmarke" style="font-size:${groesse};font-family:var(--font-display);color:${schrift}">
      ${glyph(fest, akzent)}
      <span>wegportal<span style="color:${akzent}">24</span></span>
    </span>`;
}

export function bauen(tokens) {
  const ink = wert(tokens, "--color-wp-ink");
  const akzent = wert(tokens, "--color-wp-accent");

  const zwei = h.abschnitt(
    "Zwei Fassungen",
    `    <div class="raster zwei">
      <div style="background:#faf8f4;border:1px solid #e5e7eb;border-radius:var(--radius-lg);padding:40px;text-align:center">
        ${marke(tokens, { ton: "dark", groesse: "30px" })}
        <p style="margin:22px 0 0;font-size:12.5px;color:#6b7280">Auf hellen Flächen: Kopfzeile, weiße Karten, Papier. <code>tone="dark"</code></p>
      </div>
      <div style="background:${ink};border-radius:var(--radius-lg);padding:40px;text-align:center">
        ${marke(tokens, { ton: "light", groesse: "30px" })}
        <p style="margin:22px 0 0;font-size:12.5px;color:rgba(255,255,255,.6)">Auf der dunkelgrünen Marken-Fläche: Fußzeile. <code style="background:rgba(255,255,255,.12);color:#fff">tone="light"</code></p>
      </div>
    </div>
${h.notiz(
  "Die beiden kleinen Anteile laufen in der Textfarbe mit; <strong>der große Anteil bleibt in " +
    "jedem Zusammenhang orange</strong>. Er ist die eigene Wohnung in der Gemeinschaft – die " +
    "Bedeutung des Zeichens hängt daran, nicht die Farbstimmung der Seite.",
)}`,
    "Das Bildzeichen zeigt Miteigentumsanteile: ein Quadrat, in ungleiche Anteile geteilt, so wie " +
      "eine Teilungserklärung ein Haus aufteilt. Es besteht bewusst nur aus Rechtecken – damit es " +
      "bis auf Favicon-Größe und im Schwarzweiß-Druck lesbar bleibt.",
  );

  const groessen = h.abschnitt(
    "Größen und Schutzraum",
    `${h.buehne(
      "",
      `<div class="groessen">
        <figure><div class="schutzraum">${marke(tokens, { groesse: "36px" })}</div><figcaption>36 px · Startseite, Fußzeile</figcaption></figure>
        <figure>${marke(tokens, { groesse: "20px" })}<figcaption>20 px · Kopfzeile ab sm</figcaption></figure>
        <figure>${marke(tokens, { groesse: "18px" })}<figcaption>18 px · Kopfzeile mobil</figcaption></figure>
        <figure><span class="wortmarke" style="font-size:32px">${glyph(ink, akzent)}</span><figcaption>Zeichen allein · Favicon, enge Stellen</figcaption></figure>
      </div>`,
    )}
${h.notiz(
  "Der Abstand ringsum beträgt mindestens die Höhe des Bildzeichens. Die Wortmarke ist " +
    "<strong>Text, kein Bild</strong>: Sie skaliert scharf, ist vorlesbar und braucht keine " +
    "zusätzliche Datei im Build. Der Name schreibt sich klein und ohne Punkt – " +
    "<code>wegportal24</code>, nie <code>WegPortal24</code> oder <code>wegportal24.de</code> " +
    "als Marke.",
)}`,
  );

  const nicht = h.abschnitt(
    "Was das Zeichen nicht darf",
    `    <div class="raster drei">
      <div class="falsch">
        <p class="schild">Nicht</p>
        <span class="wortmarke" style="font-size:24px;font-family:var(--font-display);color:${ink}">
          ${glyph(ink, "#2563eb")}
          <span>wegportal<span style="color:#2563eb">24</span></span>
        </span>
        <p class="warum">Umfärben. Der große Anteil ist orange, die 24 ist orange. Beides trägt die Marke.</p>
      </div>
      <div class="falsch">
        <p class="schild">Nicht</p>
        <span class="wortmarke" style="font-size:24px;font-family:Georgia,serif;color:${ink}">
          ${glyph(ink, akzent)}
          <span>wegportal<span style="color:${akzent}">24</span></span>
        </span>
        <p class="warum">Andere Schrift. Die Wortmarke steht in Plus Jakarta Sans, 800 – auch dort, wo die Seite Source Sans spricht.</p>
      </div>
      <div class="falsch">
        <p class="schild">Nicht</p>
        <span class="wortmarke" style="font-size:24px;font-family:var(--font-display);color:${ink};gap:2.4em">
          ${glyph(ink, akzent)}
          <span>wegportal<span style="color:${akzent}">24</span></span>
        </span>
        <p class="warum">Abstand verändern. Zeichen und Wort gehören zusammen; der Abstand ist auf die Schriftgröße gebunden.</p>
      </div>
    </div>
${h.notiz(
  "<strong>Auf den öffentlichen Seiten steht kein anderes Unternehmen.</strong> Erfinder des " +
    "Portals ist der Geschäftsführer der Betreiberin, einer Hausverwaltung – auf den Seiten heißt " +
    "das „die Verwaltung hinter wegportal24“, ohne Firma und ohne Namen. Wer die Plattform " +
    "betreibt, steht im Impressum, wo es nach § 5 DDG hingehört. Im Portal hinter dem Login gilt " +
    "ohnehin das Logo der jeweiligen Organisation.",
)}`,
  );

  return seite({
    gruppe: "Marke",
    name: "Wortmarke",
    untertitel: "Bildzeichen, Wortmarke, Schutzraum und die drei häufigen Fehler",
    breite: 1200,
    hoehe: 1580,
    augenbraue: "Marke",
    titel: "Wortmarke",
    einleitung:
      "Ein Quadrat, in ungleiche Anteile geteilt, daneben der Name. Mehr braucht die Marke nicht – " +
      "und weniger verträgt sie nicht.",
    inhalt: [zwei, groessen, nicht].join("\n"),
    quellen: ["components/marketing/wordmark.tsx", "components/marketing/brand.tsx"],
    tokens,
    eigenesCss: EIGENES_CSS,
  });
}
