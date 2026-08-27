import { seite, h } from "../lib/seite.mjs";
import { wert } from "../lib/tokens.mjs";

const EIGENES_CSS = `
  .muster { background: #fff; border: 1px solid #e5e7eb; padding: 20px; text-align: center; }
  .muster .form { height: 74px; background: var(--color-wp-primary-light); border: 1px solid rgba(0,54,48,.16); margin-bottom: 13px; }
  .muster b { display: block; font-size: 13px; font-weight: 600; color: var(--color-wp-ink); }
  .muster .token { display: inline-block; margin-top: 5px; }
  .muster p { font-size: 12.5px; color: #6b7280; margin: 8px 0 0; }
  .tiefe { background: #faf8f4; border-radius: var(--radius-lg); padding: 30px 20px; text-align: center; }
  .tiefe .karte { background: #fff; border-radius: var(--radius-lg); height: 82px; margin-bottom: 15px; border: 1px solid rgba(0,0,0,.04); }
  .tiefe b { display: block; font-size: 13px; font-weight: 600; color: var(--color-wp-ink); }
  .tiefe p { font-size: 12.5px; color: #6b7280; margin: 8px 0 0; }
  .flaechen { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid #e5e7eb; margin-top: 20px; }
  .flaechen > div { padding: 26px 22px; min-height: 168px; }
  .flaechen b { display: block; font-size: 14px; font-weight: 700; margin-bottom: 7px; }
  .flaechen p { font-size: 12.5px; margin: 9px 0 0; line-height: 1.5; }
`;

const radien = [
  ["--radius-sm", "Eingaben, Etiketten", "Alles, was in einer Zeile mit Text steht."],
  ["--radius-md", "Knöpfe, kleine Kacheln", "Die Standardrundung für Handlungen."],
  ["--radius-lg", "Karten", "Ein abgeschlossener Inhalt mit eigenem Rand."],
  ["--radius-xl", "Hero- und Akzentflächen", "Große Flächen, die den Blick halten sollen."],
];

const schatten = [
  ["--shadow-e1", "Ruhe", "Der Knopf und die Karte im Normalzustand. Kaum sichtbar – nur genug, um die Fläche vom Papier zu lösen."],
  ["--shadow-e2", "Berührung", "Hover auf Knopf und Karte, schwebende Illustrationsrahmen."],
  ["--shadow-e3", "Über allem", "Das Abschluss-Band, die schwebende Kennzahl-Karte im Hero. Höchstens einmal je Bildschirm."],
];

export function bauen(tokens) {
  const formen = h.abschnitt(
    "Rundungen",
    `    <div class="raster vier">
${radien
  .map(
    ([token, name, rolle]) => `      <div class="muster" style="border-radius:var(${token})">
        <div class="form" style="border-radius:var(${token})"></div>
        <b>${name}</b>
        <span class="token">${token}</span>
        <p>${rolle}</p>
        <p style="font-variant-numeric:tabular-nums;color:#9ca3af">${wert(tokens, token)}</p>
      </div>`,
  )
  .join("\n")}
    </div>
${h.notiz(
  "Vier Stufen, mehr nicht. Die Skala ist entstanden, weil vorher gemischte Werte im Umlauf waren " +
    "– <code>rounded-lg</code> neben <code>rounded-[10px]</code> neben <code>rounded-2xl</code>. " +
    "Wer eine fünfte Stufe braucht, braucht in Wahrheit meist eine der vier.",
)}`,
    "Je größer die Fläche, desto größer die Rundung. Das ist die ganze Regel – sie hält Knopf, " +
      "Karte und Hero-Fläche visuell in derselben Familie.",
  );

  const tiefe = h.abschnitt(
    "Tiefe",
    `    <div class="raster drei">
${schatten
  .map(
    ([token, name, rolle]) => `      <div class="tiefe">
        <div class="karte" style="box-shadow:var(${token})"></div>
        <b>${name}</b>
        <span class="token">${token}</span>
        <p>${rolle}</p>
      </div>`,
  )
  .join("\n")}
    </div>
${h.notiz(
  "Die Schatten sind warm getönt (<code>rgba(24,20,15,…)</code>), nicht neutralgrau. Ein grauer " +
    "Schatten auf dem Papierton <code>#faf8f4</code> sieht schmutzig aus; ein warmer sieht aus " +
    "wie Licht.",
)}`,
    "Drei Stufen. Ein Element steht ruhig, wird berührt, oder liegt über allem – dazwischen gibt " +
      "es nichts zu unterscheiden.",
  );

  const flaechen = h.abschnitt(
    "Die vier Flächen",
    `    <div class="flaechen">
      <div style="background:#faf8f4;color:#374151">
        <b style="color:var(--color-wp-ink)">Papier</b>
        <span class="token">.mk-light</span>
        <p>Der Grund der öffentlichen Seiten. Warmer Papierton mit zwei sehr schwachen
        Tönungen aus Grün und Orange in den oberen Ecken – man sieht sie nicht, man
        merkt nur, dass die Seite nicht klinisch weiß ist.</p>
      </div>
      <div style="background:#fff;color:#374151">
        <b style="color:var(--color-wp-ink)">Weiß</b>
        <span class="token">cardSurfaceClass</span>
        <p>Karten auf dem Papier. Der Unterschied zwischen <code>#faf8f4</code> und
        <code>#ffffff</code> ist klein genug, dass die Karte nicht springt, und groß
        genug, dass sie eine Karte ist.</p>
      </div>
      <div style="background:${wert(tokens, "--color-wp-ink")};color:rgba(255,255,255,.82)">
        <b style="color:#fff">Tinte</b>
        <span class="token" style="background:rgba(255,255,255,.12);color:#fff">--color-wp-ink</span>
        <p>Fußzeile, Zahlenband, Hero-Verlauf. Die dunkelste Fläche der Marke – und die
        einzige, auf der das Marken-Orange als Schrift stehen darf.</p>
      </div>
      <div style="background:${wert(tokens, "--color-shell")};color:rgba(255,255,255,.75)">
        <b style="color:#fff">Shell</b>
        <span class="token" style="background:rgba(255,255,255,.12);color:#fff">--color-shell</span>
        <p>Das Portal hinter dem Login. Warmes Dunkelbraun, nicht Schwarz, mit einem
        fixierten Verlauf über den ganzen Viewport – beim Scrollen entsteht so keine
        sichtbare Farbkante.</p>
      </div>
    </div>
${h.notiz(
  "<strong>Papier vorn, Shell hinten.</strong> Eine öffentliche Seite auf dunklem Grund oder " +
    "eine Portal-Ansicht auf hellem Papier ist kein Stilbruch, sondern eine falsche Ortsangabe: " +
    "Der Besucher liest daran ab, ob er noch vor der Tür steht oder schon drin ist.",
)}`,
  );

  return seite({
    gruppe: "Grundlagen",
    name: "Form und Tiefe",
    untertitel: "Vier Rundungen, drei Schatten, vier Flächen",
    breite: 1200,
    hoehe: 1820,
    augenbraue: "Grundlagen",
    titel: "Form und Tiefe",
    einleitung:
      "Rundung, Schatten und Fläche sagen zusammen, was ein Element ist: eine Handlung, ein " +
      "abgeschlossener Inhalt oder der Grund, auf dem beides liegt.",
    inhalt: [formen, tiefe, flaechen].join("\n"),
    quellen: ["portal/src/app/globals.css (@theme, .mk-light, .bw-shell-bg)", "components/ui.tsx"],
    tokens,
    eigenesCss: EIGENES_CSS,
  });
}
