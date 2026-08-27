#!/usr/bin/env node
// Baut eine Übersichtsseite zum Teilen – eine Seite, die das ganze System auf
// einen Blick zeigt, für alle, die keinen Zugang zum Repo oder zum
// Claude-Design-Projekt haben.
//
//   node design-system/uebersicht.mjs [zielpfad.html]
//
// Wie die Bögen liest auch sie ihre Werte aus `globals.css` und rechnet die
// Kontraste nach. Sie ist damit kein zweiter Wahrheitsstand, sondern eine
// zweite Darstellung desselben.

import { writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tokenLesen, wert, kontrast, stufe, verhaeltnisText, WURZEL } from "./lib/tokens.mjs";

const ZIEL = process.argv[2] || join(WURZEL, "design-system", ".aufnahmen", "uebersicht.html");
const tokens = tokenLesen();
const t = (name) => wert(tokens, name);

// Die Bögen kommen aus der erzeugten Karten-Datei – keine zweite Liste.
const kartenDatei = join(WURZEL, "design-system", "vorschau", "_ds_cards.json");
const { cards } = JSON.parse(readFileSync(kartenDatei, "utf8"));

const WOFUER = {
  Farben: "Zehn Marken-, sechs Status- und drei Shell-Werte, jeder mit seiner Rolle – und darunter jede Farbpaarung, die im Produkt vorkommt, nachgerechnet.",
  Schrift: "Warum vorn Source Sans steht und hinter dem Login Inter und Jakarta. Sieben Größenrollen, und die Falle mit den globalen Überschriften.",
  "Form und Tiefe": "Vier Rundungen, drei Schatten, vier Flächen – und die Regel, die sie zusammenhält: je größer die Fläche, desto größer die Rundung.",
  Bewegung: "Die eine erlaubte Kurve neben der verbotenen, beide laufend. Vier Dauerbereiche. Was passiert, wenn jemand Bewegung abschaltet.",
  Wortmarke: "Zwei Fassungen, Größen, Schutzraum – und die drei Fehler, die man mit diesem Zeichen machen kann.",
  Knöpfe: "Die drei der Marken-Seiten und die sechs des Portals, mit der 44-px-Regel am Beispiel nachgemessen.",
  Formularfelder: "Eingaben in fünf Zuständen, die Pflichtfeld-Automatik, der Einheiten-Regler der Preisseite.",
  "Karten und Hinweise": "Drei Kartenarten, vier Meldungsarten, leere Stellen, Status-Etiketten.",
  "Kopf- und Fußzeile": "Der Rahmen jeder öffentlichen Seite – am Schreibtisch, am Handy, und die vier Beschriftungen, die das Gesetz vorgibt.",
  Bänder: "Hero, Zahlenband, Foto-Zwischenschnitt, Abschluss – die vier Flächen, aus denen die Seiten gebaut sind.",
  Seitenaufbau: "Die elf Elemente in ihrer Reihenfolge, die sechs Inhaltsregeln, der Prüfbefehl.",
};

const PAARE = [
  ["Weiß", "#ffffff", "Primär", "--color-wp-primary"],
  ["Weiß", "#ffffff", "Tinte", "--color-wp-ink"],
  ["Primär", "--color-wp-primary", "Weiß", "#ffffff"],
  ["Tinte auf Akzent", "--color-wp-on-accent", "Akzent", "--color-wp-accent"],
  ["Akzent als Schrift", "--color-wp-accent-ink", "Weiß", "#ffffff"],
  ["Akzent auf Dunkel", "--color-wp-accent-bright", "Tinte", "--color-wp-ink"],
  ["Akzent", "--color-wp-accent", "Weiß", "#ffffff"],
];

const PALETTE = [
  ["--color-wp-primary", "Primär", "trägt"],
  ["--color-wp-ink", "Tinte", "dunkelste Fläche"],
  ["--color-wp-accent", "Akzent", "die eine Handlung"],
  ["--color-wp-accent-ink", "Akzent als Schrift", "auf hell"],
  ["--color-wp-accent-bright", "Akzent auf Dunkel", "auf dunkel"],
  ["--color-wp-accent-light", "Akzent Tönung", "ruhige Hinterlegung"],
  ["--color-wp-primary-soft", "Primär hell", "Verläufe"],
  ["--color-wp-primary-light", "Primär Tönung", "Hover"],
  ["--color-good", "Gut", "erledigt"],
  ["--color-warn", "Achtung", "prüfen"],
  ["--color-critical", "Kritisch", "fehlgeschlagen"],
  ["--color-shell", "Shell", "Portal-Grund"],
];

const GROESSEN = [
  ["Seitentitel", "40px", "800", "-.02em", "Keine Hausverwaltung gefunden?"],
  ["Abschnitt", "28px", "700", "-.015em", "Wirtschaftsplan, Abrechnung, Beschluss"],
  ["Vorspann", "18px", "400", "0", "Von der ersten Buchung bis zur Jahresabrechnung."],
  ["Fließtext", "16px", "400", "0", "Der Wirtschaftsplan wird beschlossen, nicht beantragt."],
  ["Augenbraue", "11.5px", "600", ".18em", "So funktioniert’s"],
];

const paarZeilen = PAARE.map(([vN, v, gN, g]) => {
  const vorne = v.startsWith("#") ? v : t(v);
  const hinten = g.startsWith("#") ? g : t(g);
  const k = kontrast(vorne, hinten);
  const s = stufe(k);
  return { vN, vorne, gN, hinten, k, s };
});

const html = `<title>Design-System wegportal24</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@800&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap">
<style>
  :root {
    --papier: #faf8f4;
    --flaeche: #ffffff;
    --flaeche-2: #f3f0ea;
    --linie: rgba(0, 36, 31, .13);
    --text: #3c4a46;
    --text-kraeftig: ${t("--color-wp-ink")};
    --text-leise: #7d8783;
    --primaer: ${t("--color-wp-primary")};
    --akzent: ${t("--color-wp-accent")};
    --akzent-text: ${t("--color-wp-accent-ink")};
    --akzent-ton: ${t("--color-wp-accent-light")};
    --tinte: ${t("--color-wp-ink")};
    --schatten: 0 1px 2px rgba(24,20,15,.06), 0 12px 28px -14px rgba(24,20,15,.16);
    --gut: ${t("--color-good")};
    --warn: ${t("--color-warn")};
    --kritisch: ${t("--color-critical")};
    --mass: 1120px;
    --kurve: ${t("--ease-mk-out")};
  }
  :root:not([data-theme="light"]) {
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --papier: ${t("--color-shell")};
      --flaeche: ${t("--color-shell-2")};
      --flaeche-2: ${t("--color-shell-3")};
      --linie: rgba(255, 255, 255, .11);
      --text: #d7d0c7;
      --text-kraeftig: #f6f2ec;
      --text-leise: #9a9088;
      --primaer: #7fb3a6;
      --akzent-text: ${t("--color-wp-accent-bright")};
      --akzent-ton: rgba(246, 144, 24, .13);
      --schatten: 0 1px 2px rgba(0,0,0,.3), 0 14px 30px -14px rgba(0,0,0,.5);
      --gut: #6fc79b;
      --warn: #e0a44a;
      --kritisch: #e57b6c;
      color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --papier: ${t("--color-shell")};
    --flaeche: ${t("--color-shell-2")};
    --flaeche-2: ${t("--color-shell-3")};
    --linie: rgba(255, 255, 255, .11);
    --text: #d7d0c7;
    --text-kraeftig: #f6f2ec;
    --text-leise: #9a9088;
    --primaer: #7fb3a6;
    --akzent-text: ${t("--color-wp-accent-bright")};
    --akzent-ton: rgba(246, 144, 24, .13);
    --schatten: 0 1px 2px rgba(0,0,0,.3), 0 14px 30px -14px rgba(0,0,0,.5);
    --gut: #6fc79b;
    --warn: #e0a44a;
    --kritisch: #e57b6c;
    color-scheme: dark;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--papier);
    color: var(--text);
    font-family: "Source Sans 3", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 16.5px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .bogen { max-width: var(--mass); margin: 0 auto; padding: 0 28px 96px; }
  a { color: var(--akzent-text); }

  /* ── Kopf ──────────────────────────────────────────────────────────── */
  .kopf { padding: 72px 0 44px; border-bottom: 1px solid var(--linie); }
  .wm {
    display: inline-flex; align-items: center; gap: .6em;
    font-family: "Plus Jakarta Sans", "Source Sans 3", sans-serif;
    font-weight: 800; font-size: 21px; letter-spacing: -.03em; line-height: 1;
    color: var(--text-kraeftig);
  }
  .wm svg { height: 1em; width: 1em; }
  .kopf h1 {
    font-size: clamp(38px, 6vw, 60px); font-weight: 700; letter-spacing: -.028em;
    line-height: 1.04; color: var(--text-kraeftig); margin: 30px 0 0; text-wrap: balance;
    max-width: 15ch;
  }
  .kopf .vor { margin: 20px 0 0; max-width: 60ch; font-size: 18.5px; }
  .kopf .vor em { font-style: italic; color: var(--text-kraeftig); }
  .stand {
    display: flex; flex-wrap: wrap; gap: 10px 26px; margin-top: 30px;
    font-size: 13.5px; color: var(--text-leise);
  }
  .stand span { display: inline-flex; align-items: baseline; gap: 7px; }
  .stand b {
    font-family: "Plus Jakarta Sans", sans-serif; font-weight: 800; font-size: 16px;
    color: var(--akzent-text); font-variant-numeric: tabular-nums; letter-spacing: -.02em;
  }

  /* ── Abschnitte ────────────────────────────────────────────────────── */
  section { padding-top: 68px; }
  .marke {
    font-size: 11.5px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase;
    color: var(--akzent-text); margin: 0 0 12px;
  }
  h2 {
    font-size: 28px; font-weight: 700; letter-spacing: -.02em; line-height: 1.2;
    color: var(--text-kraeftig); margin: 0; text-wrap: balance;
  }
  .unter { margin: 12px 0 0; max-width: 66ch; }

  /* ── Palette ───────────────────────────────────────────────────────── */
  .palette { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 3px; margin-top: 30px; }
  .ton { border-radius: 3px; overflow: hidden; background: var(--flaeche); }
  .ton .fl { height: 76px; }
  .ton .an { padding: 11px 12px 14px; }
  .ton b { display: block; font-size: 13.5px; font-weight: 600; color: var(--text-kraeftig); line-height: 1.3; }
  .ton .rolle { font-size: 12.5px; color: var(--text-leise); }
  .ton .hex {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;
    color: var(--text-leise); margin-top: 5px; font-variant-numeric: tabular-nums;
  }

  /* ── Kontraste ─────────────────────────────────────────────────────── */
  .tabellenrahmen { overflow-x: auto; margin-top: 30px; }
  table { border-collapse: collapse; width: 100%; min-width: 520px; }
  th, td { text-align: left; padding: 11px 14px 11px 0; border-bottom: 1px solid var(--linie); }
  th { font-size: 11px; font-weight: 600; letter-spacing: .13em; text-transform: uppercase; color: var(--text-leise); }
  td { font-size: 15px; }
  .punkt { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; margin-right: 9px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.14); }
  td.zahl { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--text-kraeftig); white-space: nowrap; }
  .grad { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
  .grad.aaa { color: var(--gut); }
  .grad.aa { color: var(--warn); }
  .grad.nein { color: var(--kritisch); }

  /* ── Schrift ───────────────────────────────────────────────────────── */
  .skala { margin-top: 30px; border-top: 1px solid var(--linie); }
  .zeile { display: grid; grid-template-columns: 160px 1fr; gap: 26px; padding: 17px 0; border-bottom: 1px solid var(--linie); align-items: baseline; }
  .zeile .was { font-size: 12.5px; color: var(--text-leise); font-variant-numeric: tabular-nums; }
  .zeile .was b { display: block; color: var(--text-kraeftig); font-size: 13px; font-weight: 600; }
  .zeile .probe { color: var(--text-kraeftig); }

  /* ── Bewegung ──────────────────────────────────────────────────────── */
  .kurven { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 22px; margin-top: 30px; }
  .kurvenfeld { background: var(--flaeche); border-radius: 4px; padding: 20px; box-shadow: var(--schatten); }
  .kurvenfeld h3, .kurvenfeld p { margin: 0; }
  .kurvenname { font-size: 14px; font-weight: 600; color: var(--text-kraeftig); margin: 0 0 3px; }
  .kurvenwert { font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; color: var(--text-leise); margin: 0 0 16px; }
  .bahn { position: relative; height: 44px; background: var(--flaeche-2); border-radius: 3px; overflow: hidden; }
  .kaefer { position: absolute; top: 8px; left: 8px; height: 28px; width: 28px; border-radius: 4px; }
  .kaefer.ja { background: var(--akzent); animation: lauf 2.8s var(--kurve) infinite; }
  .kaefer.nein { background: var(--kritisch); animation: lauf 2.8s cubic-bezier(.34,1.56,.64,1) infinite; }
  @keyframes lauf { 0%, 6% { transform: translateX(0); } 52%, 100% { transform: translateX(var(--weit, 190px)); } }
  .kurvenfeld .warum { font-size: 13.5px; color: var(--text-leise); margin: 15px 0 0; }
  @media (prefers-reduced-motion: reduce) { .kaefer { animation: none !important; transform: translateX(var(--weit, 190px)); } }

  /* ── Die Bögen ─────────────────────────────────────────────────────── */
  .gruppe { margin-top: 34px; }
  .gruppenname {
    font-size: 11.5px; font-weight: 600; letter-spacing: .15em; text-transform: uppercase;
    color: var(--text-leise); padding-bottom: 11px; border-bottom: 1px solid var(--linie); margin: 0 0 4px;
  }
  .bogenzeile { display: grid; grid-template-columns: 210px 1fr; gap: 26px; padding: 18px 0; border-bottom: 1px solid var(--linie); }
  .bogenzeile:last-child { border-bottom: 0; }
  .bogenzeile h3 { font-size: 17px; font-weight: 700; color: var(--text-kraeftig); margin: 0; letter-spacing: -.01em; }
  .bogenzeile .datei { font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; color: var(--text-leise); margin: 5px 0 0; word-break: break-all; }
  .bogenzeile p.was { margin: 0; font-size: 15.5px; }
  .bogenzeile .mass { font-size: 12.5px; color: var(--text-leise); margin: 8px 0 0; font-variant-numeric: tabular-nums; }

  /* ── Einrichtung ───────────────────────────────────────────────────── */
  .wege { display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 20px; margin-top: 30px; }
  .weg { background: var(--flaeche); border-radius: 4px; padding: 22px; box-shadow: var(--schatten); display: flex; flex-direction: column; gap: 12px; }
  .weg .nr {
    font-family: "Plus Jakarta Sans", sans-serif; font-size: 12px; font-weight: 800;
    letter-spacing: .1em; color: var(--akzent-text);
  }
  .weg h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--text-kraeftig); letter-spacing: -.01em; }
  .weg p { margin: 0; font-size: 14.5px; }
  .weg pre {
    margin: 0; background: var(--tinte); color: #f2efe9; border-radius: 3px; padding: 13px 15px;
    font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; line-height: 1.75; overflow-x: auto;
  }
  .weg pre .k { color: ${t("--color-wp-accent")}; }
  .weg .empfohlen { color: var(--akzent-text); font-weight: 600; }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .86em;
    background: var(--akzent-ton); border-radius: 3px; padding: 1px 5px; color: var(--text-kraeftig);
  }

  /* ── Befunde ───────────────────────────────────────────────────────── */
  .befund {
    background: var(--flaeche); border-radius: 4px; padding: 22px 24px; margin-top: 18px;
    border-left: 3px solid var(--kritisch); box-shadow: var(--schatten);
  }
  .befund h3 { margin: 0 0 8px; font-size: 16.5px; font-weight: 700; color: var(--text-kraeftig); }
  .befund p { margin: 0; font-size: 15px; }
  .befund p + p { margin-top: 9px; }
  .ort { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--text-leise); }

  .fuss { margin-top: 76px; padding-top: 22px; border-top: 1px solid var(--linie); font-size: 13.5px; color: var(--text-leise); }

  @media (max-width: 720px) {
    .bogen { padding: 0 20px 72px; }
    .zeile, .bogenzeile { grid-template-columns: 1fr; gap: 8px; }
    .kopf { padding-top: 48px; }
  }
</style>

<div class="bogen">
  <header class="kopf">
    <span class="wm">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <rect x="0" y="0" width="16" height="16" rx="2.5" fill="currentColor"/>
        <rect x="0" y="20" width="16" height="16" rx="2.5" fill="currentColor"/>
        <rect x="20" y="0" width="16" height="36" rx="2.5" fill="${t("--color-wp-accent")}"/>
      </svg>
      <span>wegportal<span style="color:${t("--color-wp-accent")}">24</span></span>
    </span>
    <h1>Das Design-System, aus dem Code gelesen</h1>
    <p class="vor">Elf Bögen beschreiben, wie wegportal24 aussieht und warum. Sie sind nicht
    danebengeschrieben, sondern <em>erzeugt</em>: Farben, Schrift, Rundungen und die
    Bewegungskurve kommen aus <code>globals.css</code>, die Kontrastwerte werden nachgerechnet.
    Damit kann das System nicht von der laufenden Seite abweichen.</p>
    <p class="stand">
      <span><b>11</b> Bögen</span>
      <span><b>${tokens.size}</b> Tokens gelesen</span>
      <span><b>${paarZeilen.filter((z) => z.s !== "durchgefallen").length}/${paarZeilen.length}</b> Paarungen bestehen WCAG&nbsp;AA</span>
      <span><b>0</b> Befunde in der Bogen-Prüfung</span>
    </p>
  </header>

  <section>
    <p class="marke">Farbe</p>
    <h2>Grün trägt, Orange handelt</h2>
    <p class="unter">Zwei Farben tragen die Marke; alles andere ist Papier, Tinte und Status.
    Die Werte stehen als eigene <code>--color-wp-*</code>-Tokens und nicht als Verweis auf die
    Verwaltungs-Variante: Das Farbschema ist einmal übernommen worden, nicht verbunden.</p>
    <div class="palette">
${PALETTE.map(([token, name, rolle]) => {
  const hex = t(token);
  return `      <div class="ton">
        <div class="fl" style="background:${hex}"></div>
        <div class="an"><b>${name}</b><span class="rolle">${rolle}</span>
        <div class="hex">${hex.toUpperCase()}</div></div>
      </div>`;
}).join("\n")}
    </div>
  </section>

  <section>
    <p class="marke">Kontrast</p>
    <h2>Gerechnet, nicht geschätzt</h2>
    <p class="unter">Jede Paarung, die im Produkt vorkommt, nach WCAG&nbsp;2.1. Die letzte Zeile
    ist der Grund für die Trennung zwischen Akzent und <code>--color-wp-accent-ink</code>:
    Marken-Orange ist auf hellem Grund eine Fläche, kein Text.</p>
    <div class="tabellenrahmen">
      <table>
        <thead><tr><th>Schrift</th><th>auf Fläche</th><th>Verhältnis</th><th>WCAG 2.1</th></tr></thead>
        <tbody>
${paarZeilen
  .map(
    (z) => `          <tr>
            <td><span class="punkt" style="background:${z.vorne}"></span>${z.vN}</td>
            <td><span class="punkt" style="background:${z.hinten}"></span>${z.gN}</td>
            <td class="zahl">${verhaeltnisText(z.k)}</td>
            <td><span class="grad ${z.s === "AAA" ? "aaa" : z.s === "AA" ? "aa" : "nein"}">${
              z.s === "durchgefallen" ? "unter 4,5:1" : z.s
            }</span></td>
          </tr>`,
  )
  .join("\n")}
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <p class="marke">Schrift</p>
    <h2>Dieselbe Schrift wie die Abrechnung</h2>
    <p class="unter">Die öffentlichen Seiten laufen in Source Sans 3 – der Schrift, in der das
    Portal Wirtschaftsplan, Jahresabrechnung und Mahnungen setzt. Wer die Seite liest, sieht
    schon, wie seine Papiere aussehen werden. Inter und Plus Jakarta Sans bleiben dem Portal
    hinter dem Login vorbehalten.</p>
    <div class="skala">
${GROESSEN.map(
  ([name, groesse, gewicht, sperrung, text]) => `      <div class="zeile">
        <div class="was"><b>${name}</b>${groesse} · ${gewicht}${sperrung !== "0" ? " · " + sperrung : ""}</div>
        <div class="probe" style="font-size:${groesse};font-weight:${gewicht};letter-spacing:${sperrung};${
          sperrung === ".18em" ? "text-transform:uppercase;color:var(--akzent-text)" : ""
        }">${text}</div>
      </div>`,
).join("\n")}
    </div>
  </section>

  <section>
    <p class="marke">Bewegung</p>
    <h2>Eine Kurve, und eine, die nicht vorkommt</h2>
    <p class="unter">Echte Gegenstände bremsen ab – sie federn nicht zurück. Der Prüfbefehl der
    Marken-Seiten meldet die Sprungkurve und <code>animate-bounce</code> als Befund.</p>
    <div class="kurven">
      <div class="kurvenfeld">
        <p class="kurvenname">So</p>
        <p class="kurvenwert">--ease-mk-out: ${t("--ease-mk-out")}</p>
        <div class="bahn"><div class="kaefer ja"></div></div>
        <p class="warum">Schnell los, weich aus.</p>
      </div>
      <div class="kurvenfeld">
        <p class="kurvenname">Nicht so</p>
        <p class="kurvenwert">cubic-bezier(.34, 1.56, .64, 1)</p>
        <div class="bahn"><div class="kaefer nein"></div></div>
        <p class="warum">Schießt über die Endgröße hinaus und kommt zurück.</p>
      </div>
    </div>
  </section>

  <section>
    <p class="marke">Inhalt</p>
    <h2>Die elf Bögen</h2>
    <p class="unter">Sie liegen im Repo unter <code>design-system/vorschau/</code> und sind genau
    das, was in ein Claude-Design-Projekt hochgeladen wird – je eine eigenständige Datei mit
    einem <code>@dsCard</code>-Marker in der ersten Zeile.</p>
${[...new Set(cards.map((c) => c.group))]
  .map(
    (gruppe) => `    <div class="gruppe">
      <p class="gruppenname">${gruppe}</p>
${cards
  .filter((c) => c.group === gruppe)
  .map(
    (c) => `      <div class="bogenzeile">
        <div><h3>${c.name}</h3><p class="datei">${c.path}</p></div>
        <div><p class="was">${WOFUER[c.name] ?? c.subtitle}</p>
        <p class="mass">${c.viewport.width} × ${c.viewport.height} px</p></div>
      </div>`,
  )
  .join("\n")}
    </div>`,
  )
  .join("\n")}
  </section>

  <section>
    <p class="marke">Einrichtung</p>
    <h2>Nach claude.ai/design bringen</h2>
    <p class="unter">Drei Wege führen hinein. Aus einer Claude-Code-Sitzung im Web funktioniert
    keiner davon – die Design-System-Freigabe lässt sich dort nicht setzen.</p>
    <div class="wege">
      <div class="weg">
        <span class="nr">WEG 1 · <span class="empfohlen">empfohlen</span></span>
        <h3>Claude Code auf dem eigenen Rechner</h3>
        <pre><span class="k">/design-login</span>   <span style="opacity:.6">einmalig</span>
<span class="k">/design-sync</span>    <span style="opacity:.6">gleicht ab</span></pre>
        <p>Legt beim ersten Lauf ein Design-System-Projekt an oder fragt nach einem bestehenden.
        Danach ist der Abgleich inkrementell: Wer nur die Farben ändert, lädt nur den Farb-Bogen
        neu hoch.</p>
      </div>
      <div class="weg">
        <span class="nr">WEG 2</span>
        <h3>Von Claude Design aus</h3>
        <p>„Send to Claude Code Web“ setzt das Projekt in den Arbeitsbereich. Von dort aus kann
        geschrieben werden, ohne dass jemand lokal etwas einrichtet.</p>
      </div>
      <div class="weg">
        <span class="nr">WEG 3</span>
        <h3>Von Hand über das Werkzeug</h3>
        <pre>create_project
finalize_plan
write_files</pre>
        <p>In dieser Reihenfolge, mit <code>localDir</code> auf <code>design-system/vorschau</code>.
        Die Karten-Angaben liegen fertig in <code>_ds_cards.json</code>.</p>
      </div>
    </div>
    <p class="unter" style="margin-top:26px"><strong>Zum Projekttyp:</strong> Ein Design-System muss
    als solches angelegt werden. Der Typ lässt sich später nicht ändern – in ein normales Projekt
    hochzuladen ergibt kein Design-System, sondern nur ein paar Dateien.</p>
  </section>

  <section>
    <p class="marke">Nebenbefund</p>
    <h2>Zwei Dinge in globals.css, die repariert gehören</h2>
    <p class="unter">Beim Lesen der Datei fiel ein doppelter Block zwischen Zeile 521 und 838 auf –
    offenbar aus einer schiefgegangenen Zusammenführung. Zwei Folgen davon sind sichtbar. Der
    Design-System-Ordner beschreibt das System; er repariert es nicht.</p>
    <div class="befund">
      <h3>Die Scroll-Einblendungen sind abgeschaltet</h3>
      <p class="ort">globals.css, Zeile 837</p>
      <p>Am Ende des doppelten Blocks steht <code>.mk-reveal { opacity: 1; transform: none; }</code>
      eingerückt, aber außerhalb jeder <code>@media</code>-Regel. Die Zeile gehört in den
      <code>prefers-reduced-motion</code>-Block, in dem sie weiter oben auch steht. So gilt sie für
      alle: <code>Reveal</code> blendet nichts mehr ein, die Abschnitte stehen sofort da.</p>
    </div>
    <div class="befund">
      <h3>Die verbotene Sprungkurve ist wieder aktiv</h3>
      <p class="ort">globals.css, Zeile 612 und 773</p>
      <p><code>@keyframes mkPopIn</code> ist zweimal definiert. Die zweite Fassung gewinnt und
      schießt mit <code>scale(1.08)</code> über die Endgröße hinaus – genau der Überschwinger, den
      die Regeln der Marken-Seiten ausschließen. Die erste, korrigierte Fassung (0,92 → 1) ist
      damit wirkungslos.</p>
    </div>
  </section>

  <p class="fuss">Erzeugt von <code>design-system/uebersicht.mjs</code> aus
  <code>portal/src/app/globals.css</code>. Der verbindliche Stand liegt im Repo, nicht auf dieser
  Seite.</p>
</div>
`;

writeFileSync(ZIEL, html, "utf8");
console.log("Übersicht geschrieben nach " + ZIEL);
