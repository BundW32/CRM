import { seite, h } from "../lib/seite.mjs";
import { wert } from "../lib/tokens.mjs";

const EIGENES_CSS = `
  .bahn { position: relative; height: 56px; background: #faf8f4; border-radius: var(--radius-md); border: 1px solid #eef0ee; overflow: hidden; }
  .laeufer { position: absolute; top: 12px; left: 10px; width: 32px; height: 32px; border-radius: var(--radius-md); }
  .laeufer.richtig { background: var(--color-wp-accent); animation: laufRichtig 2.6s var(--ease-mk-out) infinite; }
  .laeufer.falsch { background: #c23b2e; animation: laufFalsch 2.6s cubic-bezier(.34,1.56,.64,1) infinite; }
  @keyframes laufRichtig { 0%,8% { transform: translateX(0); } 55%,100% { transform: translateX(var(--weg, 320px)); } }
  @keyframes laufFalsch  { 0%,8% { transform: translateX(0); } 55%,100% { transform: translateX(var(--weg, 320px)); } }
  .vergleich { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 20px; margin-top: 20px; }
  .vergleich > div { border: 1px solid #e5e7eb; border-radius: var(--radius-lg); padding: 20px; background: #fff; }
  .vergleich h3 { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--color-wp-ink); }
  .vergleich .kurve { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11.5px; color: #6b7280; margin: 0 0 15px; }
  .vergleich p.warum { font-size: 13px; color: #6b7280; margin: 14px 0 0; }
  .dauern td.zahl { color: var(--color-wp-ink); font-weight: 600; }
`;

const dauern = [
  ["80–160 ms", "Zustandswechsel", "Hover, Fokus, Aufklappen eines Menüs. So kurz, dass es sich wie eine Reaktion anfühlt und nicht wie eine Animation."],
  ["180–260 ms", "Etwas erscheint", "Kurzmeldung, Schublade, ausklappende Karte. Lang genug, dass das Auge dem Weg folgen kann."],
  ["500–600 ms", "Abschnitt blendet ein", "Die Reveals beim Scrollen. Sie laufen einmal und nie wieder."],
  ["2,2–8 s", "Ruhige Dauerbewegung", "Schwebende Illustrationen, Ken-Burns-Zoom auf Fotos, Scroll-Hinweis. Muss unbemerkt bleiben."],
];

export function bauen(tokens) {
  const kurve = wert(tokens, "--ease-mk-out");

  const eine = h.abschnitt(
    "Eine Kurve",
    `    <div class="vergleich">
      <div>
        <h3>So – exponentielles Auslaufen</h3>
        <p class="kurve">--ease-mk-out: ${kurve}</p>
        <div class="bahn"><div class="laeufer richtig"></div></div>
        <p class="warum">Schnell los, weich aus. Ein Gegenstand mit Masse bremst ab – er
        federt nicht zurück. Genau das liest das Auge als „echt“.</p>
      </div>
      <div>
        <h3>Nicht so – Sprungkurve mit Überschwinger</h3>
        <p class="kurve">cubic-bezier(.34, 1.56, .64, 1)</p>
        <div class="bahn"><div class="laeufer falsch"></div></div>
        <p class="warum">Schießt über das Ziel hinaus und kommt zurück. Karten und
        Etiketten werden dabei kurz größer als ihre Endgröße – bei elf Kopien derselben
        Kurve im Markup war das der Grund, sie durch <em>ein</em> Token zu ersetzen.</p>
      </div>
    </div>
${h.notiz(
  "Der Prüfbefehl der Marken-Seiten meldet beides: die Sprungkurve " +
    "<code>cubic-bezier(.34,1.56,.64,1)</code> und <code>animate-bounce</code>. Auf " +
    "<code>page.tsx</code>, <code>/preise</code>, <code>/funktionen</code>, " +
    "<code>/so-funktionierts</code> und <code>components/marketing</code> gilt: null Befunde, " +
    "vor und nach jeder Änderung.",
  "warnung",
)}`,
    "Für alles, was sich auf den öffentlichen Seiten bewegt, gibt es genau eine Beschleunigung. " +
      "Sie steht als Token in <code>globals.css</code> und wird nicht abgeschrieben.",
  );

  const dauer = h.abschnitt(
    "Dauern",
    `    <table class="dauern">
      <thead><tr><th>Dauer</th><th>Wofür</th><th>Warum diese Länge</th></tr></thead>
      <tbody>
${dauern
  .map(
    ([d, was, warum]) =>
      `        <tr><td class="zahl">${d}</td><td>${was}</td><td>${warum}</td></tr>`,
  )
  .join("\n")}
      </tbody>
    </table>`,
    "Vier Bereiche. Was länger dauert als 600 ms, ohne eine Dauerbewegung zu sein, hält auf.",
  );

  const reduziert = h.abschnitt(
    "Wer keine Bewegung will, verliert keine Information",
    `${h.buehne(
      "prefers-reduced-motion: reduce",
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px">
        <div>
          <p style="margin:0 0 7px;font-weight:600;color:var(--color-wp-ink);font-size:13.5px">Alle Dauern auf 0,01 ms</p>
          <p style="margin:0;font-size:13px;color:#6b7280">Ein globaler Block setzt Animationen und Übergänge praktisch still – kein Element muss das einzeln wissen.</p>
        </div>
        <div>
          <p style="margin:0 0 7px;font-weight:600;color:var(--color-wp-ink);font-size:13.5px">Reveals werden sofort sichtbar</p>
          <p style="margin:0;font-size:13px;color:#6b7280"><code>.mk-reveal</code> startet auf <code>opacity:0</code>. Ohne Gegenregel bliebe der halbe Seiteninhalt unsichtbar – deshalb setzt der Block sie auf <code>opacity:1</code>.</p>
        </div>
        <div>
          <p style="margin:0 0 7px;font-weight:600;color:var(--color-wp-ink);font-size:13.5px">Angesprungene Stelle bleibt markiert</p>
          <p style="margin:0;font-size:13px;color:#6b7280">Statt des ablaufenden Leuchtens eine ruhige, bleibende Markierung. Die Information „hier ist die Stelle“ darf nicht mit der Animation verschwinden.</p>
        </div>
      </div>`,
    )}
${h.notiz(
  "Das ist die Probe für jede neue Animation: Schaltet man Bewegung ab – sieht man dann noch " +
    "alles? Eine Einblendung, die ohne Bewegung nie sichtbar wird, ist kein Effekt, sondern ein " +
    "Ausfall.",
)}`,
  );

  return seite({
    gruppe: "Grundlagen",
    name: "Bewegung",
    untertitel: "Eine Kurve, vier Dauern, und ein Schalter für alle",
    breite: 1200,
    hoehe: 1600,
    augenbraue: "Grundlagen",
    titel: "Bewegung",
    einleitung:
      "Bewegung erklärt, woher etwas kommt und wohin es geht. Sobald sie auffällt, tut sie das " +
      "nicht mehr – sie hält nur auf.",
    inhalt: [eine, dauer, reduziert].join("\n"),
    quellen: [
      "portal/src/app/globals.css (--ease-mk-out, @keyframes mk*, prefers-reduced-motion)",
      "components/marketing/reveal.tsx",
    ],
    tokens,
    eigenesCss: EIGENES_CSS,
  });
}
