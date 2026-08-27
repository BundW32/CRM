import { seite, h } from "../lib/seite.mjs";
import { wert, kontrast, stufe, verhaeltnisText } from "../lib/tokens.mjs";

const EIGENES_CSS = `
  .kachel { border: 1px solid #e5e7eb; border-radius: var(--radius-lg); overflow: hidden; background: #fff; }
  .kachel .flaeche { height: 88px; display: flex; align-items: flex-end; padding: 10px 12px; }
  .kachel .fuss { padding: 11px 13px 13px; }
  .kachel .fuss b { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-wp-ink); }
  .kachel .fuss .token { display: inline-block; margin-top: 5px; }
  .kachel .fuss .hex { font-variant-numeric: tabular-nums; font-size: 12px; color: #9ca3af; margin-top: 5px; }
  .kachel .rolle { font-size: 12.5px; color: #6b7280; margin-top: 7px; }
  .aufFlaeche { font-size: 12px; font-weight: 600; }
`;

// Was jede Farbe TUT – die Rolle steht nicht in globals.css, der Wert schon.
const paletten = [
  {
    titel: "Marke wegportal24",
    hinleitung:
      "Grün trägt, Orange handelt. Die Werte stehen als eigene <code>--color-wp-*</code>-Tokens " +
      "in <code>globals.css</code> – bewusst als eigene Werte und nicht als Verweis auf die Tokens " +
      "der Verwaltungs-Variante: Das Farbschema ist einmal übernommen worden, nicht verbunden. " +
      "Wer eine der beiden Marken künftig umfärbt, färbt die andere damit nicht mit.",
    farben: [
      ["--color-wp-primary", "Primär", "Flächen, die tragen: Abschluss-Band, Umriss-Knöpfe, aktive Navigation.", "#ffffff"],
      ["--color-wp-primary-soft", "Primär hell", "Lichtflächen und Verläufe innerhalb der grünen Flächen.", "#ffffff"],
      ["--color-wp-primary-light", "Primär Tönung", "Hover-Fläche unter dem Neben-Knopf. Keine Schrift darauf außer wp-ink.", "#00241f"],
      ["--color-wp-ink", "Tinte", "Die dunkelste Fläche: Fußzeile, Zahlenband, Hero-Verlauf. Und die Schrift auf Orange.", "#ffffff"],
      ["--color-wp-accent", "Akzent", "Die EINE Handlung: Registrieren. Nie zweimal in derselben Blickachse.", "#00241f"],
      ["--color-wp-accent-dark", "Akzent dunkel", "Nur der Hover-Zustand des Akzent-Knopfes.", "#00241f"],
      ["--color-wp-accent-light", "Akzent Tönung", "Ruhige Hinterlegung: Icon-Kästchen, Hinweisleisten, Illustrationsgrund.", "#00241f"],
      ["--color-wp-accent-ink", "Akzent als Schrift", "Orange ALS TEXT auf hellem Grund. Der Akzent selbst schafft dort nur 2,4:1.", "#ffffff"],
      ["--color-wp-accent-bright", "Akzent auf Dunkel", "Auf dunklem Grund trägt das Marken-Orange selbst – Zahlenband, Fußzeilen-Links.", "#00241f"],
      ["--color-wp-on-accent", "Tinte auf Akzent", "Die Schriftfarbe AUF dem orangen Knopf. Nie Weiß.", "#ffffff"],
    ],
  },
  {
    titel: "Status",
    hinleitung:
      "Vom Marken-Akzent getrennt gehalten: Orange bedeutet auf diesen Seiten „hier klicken“, " +
      "nicht „Achtung“. Eine Warnung, die aussieht wie der Haupt-Knopf, ist beides nicht mehr.",
    farben: [
      ["--color-good", "Gut", "Erledigt, gebucht, bestätigt.", "#ffffff"],
      ["--color-good-light", "Gut, Fläche", "Hinterlegung der Erfolgsmeldung.", "#14603f"],
      ["--color-warn", "Achtung", "Fällig, unvollständig, prüfen.", "#ffffff"],
      ["--color-warn-light", "Achtung, Fläche", "Hinterlegung der Warnung.", "#8a5209"],
      ["--color-critical", "Kritisch", "Fehlgeschlagen, überfällig, gelöscht.", "#ffffff"],
      ["--color-critical-light", "Kritisch, Fläche", "Hinterlegung der Fehlermeldung.", "#9b2f23"],
    ],
  },
  {
    titel: "Dunkler Rahmen (Portal hinter dem Login)",
    hinleitung:
      "Die öffentlichen Seiten laufen hell (Papierton <code>#faf8f4</code>), das Portal hinter dem " +
      "Login dunkel. Diese drei Töne sind der Grund, warum eine Marken-Seite nie versehentlich wie " +
      "die App aussieht – und umgekehrt.",
    farben: [
      ["--color-shell", "Shell", "Der Seitengrund der App.", "#ffffff"],
      ["--color-shell-2", "Shell 2", "Karten und erhobene Flächen darauf.", "#ffffff"],
      ["--color-shell-3", "Shell 3", "Eingaben und Trennflächen.", "#ffffff"],
    ],
  },
];

function kachel(tokens, [token, name, rolle, schrift]) {
  const hex = wert(tokens, token);
  return `      <div class="kachel">
        <div class="flaeche" style="background:${hex}">
          <span class="aufFlaeche" style="color:${schrift}">Aa</span>
        </div>
        <div class="fuss">
          <b>${name}</b>
          <span class="token">${token}</span>
          <div class="hex">${hex.toUpperCase()}</div>
          <p class="rolle">${rolle}</p>
        </div>
      </div>`;
}

// Die Paarungen, die im Produkt tatsächlich vorkommen. Jede wird gerechnet.
const paarungen = [
  ["Weiß", "#ffffff", "Primär", "--color-wp-primary", "Abschluss-Band, Umriss-Knöpfe"],
  ["Weiß", "#ffffff", "Tinte", "--color-wp-ink", "Fußzeile, Zahlenband, Hero"],
  ["Primär", "--color-wp-primary", "Weiß", "#ffffff", "Überschriften auf Papier"],
  ["Tinte auf Akzent", "--color-wp-on-accent", "Akzent", "--color-wp-accent", "Der Registrieren-Knopf"],
  ["Akzent als Schrift", "--color-wp-accent-ink", "Weiß", "#ffffff", "Augenbrauen, Häkchen, Links"],
  ["Akzent auf Dunkel", "--color-wp-accent-bright", "Tinte", "--color-wp-ink", "Zahlen im Zahlenband"],
  ["Akzent", "--color-wp-accent", "Weiß", "#ffffff", "verboten als Text – hier steht, warum"],
];

export function bauen(tokens) {
  const paletten_html = paletten
    .map((p) =>
      h.abschnitt(
        p.titel,
        `    <div class="raster vier">
${p.farben.map((f) => kachel(tokens, f)).join("\n")}
    </div>`,
        p.hinleitung,
      ),
    )
    .join("\n");

  const zeilen = paarungen
    .map(([vName, v, gName, g, zweck]) => {
      const vorne = v.startsWith("#") ? v : wert(tokens, v);
      const hinten = g.startsWith("#") ? g : wert(tokens, g);
      const verhaeltnis = kontrast(vorne, hinten);
      const bewertung = stufe(verhaeltnis);
      const klasse =
        bewertung === "durchgefallen" ? "schlecht" : bewertung === "AA" ? "schwach" : "gut";
      const marke =
        bewertung === "durchgefallen"
          ? "unter 4,5:1"
          : bewertung === "AA"
            ? "AA (ab 4,5:1)"
            : "AAA (ab 7:1)";
      return `      <tr>
        <td><span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:${vorne};border:1px solid rgba(0,0,0,.12);vertical-align:-2px;margin-right:7px"></span>${vName}</td>
        <td><span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:${hinten};border:1px solid rgba(0,0,0,.12);vertical-align:-2px;margin-right:7px"></span>${gName}</td>
        <td class="zahl">${verhaeltnisText(verhaeltnis)}</td>
        <td><span class="marke ${klasse}">${marke}</span></td>
        <td>${zweck}</td>
      </tr>`;
    })
    .join("\n");

  const kontrastAbschnitt = h.abschnitt(
    "Kontraste – gerechnet",
    `    <table>
      <thead>
        <tr><th>Schrift</th><th>auf Fläche</th><th>Verhältnis</th><th>WCAG 2.1</th><th>Wo</th></tr>
      </thead>
      <tbody>
${zeilen}
      </tbody>
    </table>
${h.notiz(
  "Diese Zahlen sind nicht abgeschrieben: <code>design-system/bauen.mjs</code> rechnet sie bei " +
    "jedem Lauf aus den Hex-Werten in <code>globals.css</code> nach (WCAG 2.1, relative " +
    "Leuchtdichte). Wer eine Farbe ändert und neu baut, sieht die Folge sofort in dieser Tabelle.",
)}
${h.notiz(
  "<strong>Die letzte Zeile ist die wichtigste.</strong> Das Marken-Orange erreicht als Text auf " +
    "Weiß nur 2,4:1 und fällt damit durch. Deshalb gibt es <code>--color-wp-accent-ink</code>: " +
    "dieselbe Farbfamilie, dunkel genug für Schrift. Regel: Orange ist auf hellem Grund eine " +
    "<em>Fläche</em>, kein Text. Als Text nur die <code>-ink</code>-Variante, auf dunklem Grund " +
    "die <code>-bright</code>-Variante.",
  "warnung",
)}`,
    "Jede Paarung, die im Produkt vorkommt – nachgerechnet nach WCAG 2.1. Fließtext braucht 4,5:1 (AA), " +
      "große Schrift ab 24 px oder 19 px fett braucht 3:1.",
  );

  return seite({
    gruppe: "Grundlagen",
    name: "Farben",
    untertitel: "Marke, Status, dunkler Rahmen – mit nachgerechneten Kontrasten",
    breite: 1200,
    hoehe: 2800,
    augenbraue: "Grundlagen",
    titel: "Farben",
    einleitung:
      "Zwei Farben tragen die Marke: ein tiefes Grün und ein warmes Orange. Das Grün ist die Fläche, " +
      "auf der alles steht; das Orange ist die eine Handlung, die die Seite will. Alles andere ist " +
      "Papier, Tinte und Status.",
    inhalt: paletten_html + "\n" + kontrastAbschnitt,
    quellen: ["portal/src/app/globals.css (@theme)", "components/marketing/brand.tsx"],
    tokens,
    eigenesCss: EIGENES_CSS,
  });
}
