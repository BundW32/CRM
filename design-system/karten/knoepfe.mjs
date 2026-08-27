import { seite, h } from "../lib/seite.mjs";

// Die Klassen im Repo sind Tailwind-Ketten; hier stehen sie als CSS, damit die
// Vorschau ohne Build-Schritt rendert. Die WERTE stammen aus denselben Tokens
// (`rounded-xl` ist `--radius-xl`, `shadow-e1` ist `--shadow-e1`), deshalb
// bleibt die Vorschau an die Marke gebunden, auch wenn sie eigenes CSS hat.
const EIGENES_CSS = `
  .knopf {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    border-radius: var(--radius-xl); padding: 8px 16px;
    font-family: var(--font-mk); font-size: 14px; font-weight: 600; line-height: 1.4;
    border: 1px solid transparent; cursor: pointer; text-decoration: none;
    transition: background-color .15s var(--ease-mk-out), border-color .15s var(--ease-mk-out), box-shadow .15s var(--ease-mk-out), transform .1s var(--ease-mk-out);
  }
  .knopf:active { transform: scale(.98); }
  .knopf.haupt { background: var(--color-wp-accent); color: var(--color-wp-on-accent); box-shadow: var(--shadow-e1); }
  .knopf.haupt:hover { background: var(--color-wp-accent-dark); box-shadow: var(--shadow-e2); }
  .knopf.neben { background: #fff; color: var(--color-wp-primary); border-color: color-mix(in srgb, var(--color-wp-primary) 30%, transparent); }
  .knopf.neben:hover { border-color: color-mix(in srgb, var(--color-wp-primary) 60%, transparent); background: var(--color-wp-primary-light); }
  .knopf.aufFoto { background: rgba(255,255,255,.10); color: #fff; border-color: rgba(255,255,255,.40); backdrop-filter: blur(4px); }
  .knopf.aufFoto:hover { background: rgba(255,255,255,.20); }
  .knopf.gross { padding: 12px 24px; font-size: 16px; }
  .knopf.mittel { padding: 10px 20px; }
  .knopf.klein { padding: 6px 12px; font-size: 12px; }
  .knopf:focus-visible { outline: 2px solid var(--color-wp-accent); outline-offset: 2px; }
  .knopf.neben:focus-visible, .knopf.haupt:focus-visible { outline-color: var(--color-wp-accent-ink); }
  .pfeil { width: 15px; height: 15px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }

  .portalknopf {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    border-radius: var(--radius-xl); padding: 8px 16px;
    font-family: var(--font-sans); font-size: 14px; line-height: 1.4;
    border: 1px solid transparent; cursor: pointer;
  }
  .portalknopf.primaer { background: var(--color-brand-orange); color: var(--color-brand-green-dark); font-weight: 600; box-shadow: var(--shadow-e1); }
  .portalknopf.sekundaer { background: #fff; color: #374151; border-color: #d1d5db; font-weight: 500; }
  .portalknopf.umriss { background: transparent; color: var(--color-brand-orange); border-color: color-mix(in srgb, var(--color-brand-orange) 60%, transparent); font-weight: 600; }
  .portalknopf.gefahr { background: #fff; color: #dc2626; border-color: #fecaca; font-weight: 500; }
  .portalknopf.still { background: transparent; color: #4b5563; font-weight: 500; }
  .portalknopf.klein { padding: 6px 12px; font-size: 12px; }

  .messung { position: relative; display: inline-flex; }
  .messung .marke44 { position: absolute; inset: 0; outline: 1px dashed var(--color-critical); outline-offset: 0; border-radius: var(--radius-xl); pointer-events: none; }
  .messung .zahl { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); margin-top: 7px; font-size: 10.5px; color: var(--color-critical); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .minhoehe { min-height: 44px; }
  .zulang { margin-bottom: 26px; }
`;

const PFEIL = `<svg class="pfeil" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

export function bauen(tokens) {
  const marken = h.abschnitt(
    "Die drei Knöpfe der öffentlichen Seiten",
    `    <div class="raster drei">
      <div class="feld">
        <h3>Haupt-Handlung</h3>
        <p style="margin-bottom:16px">Registrieren. Orange Fläche, dunkle Tinte darauf.</p>
        <a class="knopf haupt" href="#">Kostenlos starten ${PFEIL}</a>
        <p style="margin-top:15px"><span class="token">wpButtonClass</span></p>
      </div>
      <div class="feld">
        <h3>Neben-Handlung</h3>
        <p style="margin-bottom:16px">Anmelden, So funktioniert’s. Umriss in der Primärfarbe.</p>
        <a class="knopf neben" href="#">So funktioniert’s</a>
        <p style="margin-top:15px"><span class="token">wpButtonSecondaryClass</span></p>
      </div>
      <div class="feld" style="background:var(--color-wp-ink);border-color:rgba(255,255,255,.10)">
        <h3 style="color:#fff">Auf Foto und Dunkelfläche</h3>
        <p style="margin-bottom:16px;color:rgba(255,255,255,.6)">Weißer Umriss mit leichter Milchglas-Füllung.</p>
        <a class="knopf aufFoto" href="#">So funktioniert’s</a>
        <p style="margin-top:15px"><span class="token" style="background:rgba(255,255,255,.12);color:#fff">wpButtonOnPhotoClass</span></p>
      </div>
    </div>
${h.notiz(
  "<strong>Eine Handlung je Blickachse.</strong> Der orange Knopf ist das Angebot der Seite; " +
    "steht er zweimal nebeneinander, ist er keins mehr. Neben ihm steht höchstens eine " +
    "Neben-Handlung, und die trägt Umriss statt Fläche.",
)}`,
    "Sie sind bewusst eigene Konstanten und nicht der <code>buttonClass</code> des Portals: Der " +
      "gilt in der ganzen App – ihn umzufärben würde die Verwaltungs-Variante mitziehen.",
  );

  const groessen = h.abschnitt(
    "Größen – und die 44-px-Regel",
    `${h.buehne(
      "Wo welche Größe steht",
      `<div class="reihe zulang" style="gap:26px">
        <span class="messung minhoehe" style="align-items:center">
          <a class="knopf haupt minhoehe" href="#">Registrieren</a>
          <span class="marke44"></span><span class="zahl">min-h-11 = 44 px · Kopfzeile</span>
        </span>
        <a class="knopf haupt mittel" href="#">Kostenlos starten ${PFEIL}</a>
        <a class="knopf haupt gross" href="#">Jetzt kostenlos starten ${PFEIL}</a>
      </div>
      <p style="margin:16px 0 0;font-size:12.5px;color:#6b7280">
        Kopfzeile · Hero (<code>px-5 py-2.5</code>) · Abschluss-Band (<code>px-6 py-3 text-base</code>)
      </p>`,
    )}
${h.notiz(
  "<strong>Jedes Tap-Ziel ist mindestens 44 × 44 px – nachgemessen, nicht geschätzt.</strong> " +
    "Der Knopf in der Kopfzeile trägt dafür <code>min-h-11</code>: Seine Beschriftung wechselt " +
    "auf Mobil von „Registrieren“ zu „Starten“, die Fläche darf dabei nicht mitschrumpfen.",
)}
${h.notiz(
  "Der Registrieren-Weg ist auf <em>jeder</em> Breite dauerhaft erreichbar: Knopf in der " +
    "Kopfzeile plus die einblendende Leiste am unteren Rand (ab etwa 25 % Scrolltiefe, wieder " +
    "aus am Abschluss-Block). Auf 375 × 667 px – dem iPhone SE – liegt der Haupt-CTA ohne " +
    "Scrollen im Bild; das wird mit Playwright gemessen, nicht abgeschätzt.",
)}`,
  );

  const portal = h.abschnitt(
    "Knöpfe hinter dem Login",
    `${h.buehne(
      "Portal – components/ui.tsx",
      `<div class="reihe">
        <button class="portalknopf primaer">Speichern</button>
        <button class="portalknopf sekundaer">Abbrechen</button>
        <button class="portalknopf umriss">Auswertung öffnen</button>
        <button class="portalknopf gefahr">Löschen</button>
        <button class="portalknopf still">Mehr anzeigen</button>
        <button class="portalknopf primaer klein">Buchen</button>
      </div>
      <p style="margin:18px 0 0;font-size:12.5px;color:#6b7280">
        <code>buttonClass</code> · <code>buttonSecondaryClass</code> · <code>buttonOutlineClass</code> ·
        <code>buttonDangerClass</code> · <code>buttonGhostClass</code> · <code>+ buttonCompact</code>
      </p>`,
    )}
${h.notiz(
  "<code>buttonCompact</code> wird <em>angehängt</em>, nicht eingesetzt: Farbe und Verhalten " +
    "bleiben gleich, nur die Größe ändert sich. Die <code>!</code>-Modifier darin sind nötig, " +
    "weil sonst nicht die Reihenfolge im Klassen-Attribut entscheidet, sondern die im Stylesheet.",
)}
${h.notiz(
  "<strong>Kein ShadCN, keine Knopf-Bibliothek.</strong> Das Repo hat eigene Bausteine und harte " +
    "ESLint-Regeln gegen Nachbauten. Ein neuer Knopf ist eine neue Konstante in " +
    "<code>components/ui.tsx</code> oder <code>components/marketing/brand.tsx</code> – kein " +
    "Inline-Klassenstrang in der Seite.",
  "warnung",
)}`,
    "Sie tragen dieselbe Form, aber die Marken-Tokens der Verwaltungs-Variante. Auf Login, " +
      "Registrierung und Passwort-Seiten lenkt die Klasse <code>wp-brand</code> diese Tokens auf " +
      "die wegportal24-Palette um – die Seiten müssen davon nichts wissen.",
  );

  return seite({
    gruppe: "Komponenten",
    name: "Knöpfe",
    untertitel: "Drei vorn, sechs hinten, und ein Mindestmaß von 44 px",
    breite: 1200,
    hoehe: 1940,
    augenbraue: "Komponenten",
    titel: "Knöpfe",
    einleitung:
      "Auf den öffentlichen Seiten gibt es genau eine Handlung, die zählt: registrieren. Alles " +
      "andere ordnet sich ihr unter – in Farbe, Fläche und Reihenfolge.",
    inhalt: [marken, groessen, portal].join("\n"),
    quellen: ["components/marketing/brand.tsx", "components/ui.tsx", "components/marketing/mobile-cta-bar.tsx"],
    tokens,
    eigenesCss: EIGENES_CSS,
  });
}
