import { seite, h } from "../lib/seite.mjs";

const EIGENES_CSS = `
  .kartenflaeche { border-radius: var(--radius-lg); border: 1px solid #e5e7eb; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
  .kartenflaeche.innen { padding: 20px; }
  .kartenflaeche h4 { font-family: var(--font-sans); font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px; }
  .kartenflaeche .zeile { display: flex; justify-content: space-between; padding: 7px 0; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
  .kartenflaeche .zeile:last-child { border-bottom: 0; }
  .kartenflaeche .zeile b { font-variant-numeric: tabular-nums; font-weight: 600; color: #111827; }
  details.klappkarte { border-radius: var(--radius-lg); border: 1px solid #e5e7eb; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
  details.klappkarte > summary {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 16px 20px; font-family: var(--font-sans); font-size: 16px; font-weight: 600;
    color: #111827; cursor: pointer; list-style: none; border-radius: var(--radius-lg);
  }
  details.klappkarte > summary::-webkit-details-marker { display: none; }
  details.klappkarte > summary svg { width: 16px; height: 16px; color: #9ca3af; transition: transform .2s; }
  details.klappkarte[open] > summary svg { transform: rotate(180deg); }
  details.klappkarte .inhalt { padding: 0 20px 20px; font-size: 14px; color: #4b5563; }
  .dunkelkarte { border-radius: var(--radius-lg); border: 1px solid rgba(255,255,255,.10); background: var(--color-shell-2); padding: 20px; box-shadow: var(--shadow-e3); }
  .dunkelkarte h4 { font-family: var(--font-sans); font-size: 16px; font-weight: 600; color: #fff; margin: 0 0 14px; }
  .dunkelkarte p { color: rgba(255,255,255,.7); font-size: 14px; margin: 0; }
  .hinweis { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; border-radius: var(--radius-xl); border: 1px solid; padding: 12px 16px; font-size: 14px; margin-bottom: 12px; }
  .hinweis svg { width: 20px; height: 20px; flex-shrink: 0; stroke-width: 2; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; }
  .hinweis .rumpf { flex: 1 1 240px; min-width: 0; }
  .hinweis b { font-weight: 600; }
  .hinweis.info { border-color: color-mix(in srgb, var(--color-brand-orange) 30%, transparent); background: var(--color-brand-orange-light); color: var(--color-brand-green); }
  .hinweis.info svg { color: var(--color-brand-orange-dark); }
  .hinweis.gut { border-color: #bbf7d0; background: #f0fdf4; color: #14532d; }
  .hinweis.gut svg { color: #16a34a; }
  .hinweis.achtung { border-color: #fcd34d; background: #fffbeb; color: #78350f; }
  .hinweis.achtung svg { color: #d97706; }
  .hinweis.fehler { border-color: #fecaca; background: #fef2f2; color: #991b1b; }
  .hinweis.fehler svg { color: #dc2626; }
  .leer { display: flex; flex-direction: column; align-items: center; gap: 8px; border-radius: var(--radius-lg); border: 1px dashed #d1d5db; background: #f9fafb; padding: 32px 16px; text-align: center; }
  .leer .kreis { display: flex; height: 40px; width: 40px; align-items: center; justify-content: center; border-radius: 999px; background: #fff; color: #9ca3af; box-shadow: var(--shadow-e1); }
  .leer p { font-size: 14px; color: #6b7280; margin: 0; }
  .etikett { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 500; }
  .etikett.neu { background: #fef3c7; color: #92400e; }
  .etikett.arbeit { background: #dbeafe; color: #1e40af; }
  .etikett.fertig { background: #dcfce7; color: #166534; }
  .puls { position: relative; display: flex; height: 6px; width: 6px; }
  .puls .welle { position: absolute; inset: 0; border-radius: 999px; background: currentColor; opacity: .6; animation: pulsWelle 1.6s var(--ease-mk-out) infinite; }
  .puls .kern { position: relative; height: 6px; width: 6px; border-radius: 999px; background: currentColor; }
  @keyframes pulsWelle { 0% { transform: scale(1); opacity: .6; } 100% { transform: scale(2.4); opacity: 0; } }
`;

const IKON = {
  info: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  gut: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>`,
  achtung: `<svg viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>`,
  fehler: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>`,
};

export function bauen(tokens) {
  const flaechen = h.abschnitt(
    "Karten",
    `    <div class="raster drei">
      <div>
        <div class="kartenflaeche innen">
          <h4>Hausgeld August</h4>
          <div class="zeile"><span>Soll</span><b>1.470,00 €</b></div>
          <div class="zeile"><span>Eingegangen</span><b>1.225,00 €</b></div>
          <div class="zeile"><span>Offen</span><b style="color:var(--color-critical)">245,00 €</b></div>
        </div>
        <p style="margin-top:13px;font-size:12.5px;color:#6b7280"><code>Card</code> · <code>cardSurfaceClass</code> + <code>p-5</code></p>
      </div>
      <div>
        <details class="klappkarte">
          <summary>Weitere Einstellungen <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></summary>
          <div class="inhalt">Für sekundäre Blöcke, die eine Seite sonst unnötig verlängern. Standardmäßig zu.</div>
        </details>
        <p style="margin-top:13px;font-size:12.5px;color:#6b7280"><code>CollapsibleCard</code> – natives <code>&lt;details&gt;</code>, kein Client-JS</p>
      </div>
      <div>
        <div class="dunkelkarte">
          <h4>Nächste Versammlung</h4>
          <p>14. November, 19 Uhr. Einladung ist raus, Frist läuft.</p>
        </div>
        <p style="margin-top:13px;font-size:12.5px;color:#6b7280"><code>DarkCard</code> – Akzentfläche auf hellem Grund</p>
      </div>
    </div>
${h.notiz(
  "Karten tragen einen optionalen Anker (<code>id</code>). Server-Actions enden mit einer " +
    "Weiterleitung, und die setzt den Browser an den Seitenanfang – auf einer langen Seite landet " +
    "man nach jedem Speichern wieder ganz oben. Mit Anker führt der Rücksprung an die Stelle " +
    "zurück, an der gearbeitet wurde.",
)}
${h.notiz(
  "Die ausklappende Karte bewegt sich über <code>::details-content</code> und " +
    "<code>interpolate-size</code>. Kennt ein Browser das nicht, klappt sie schlicht sofort auf – " +
    "kein Ausfall, nur ohne Bewegung.",
)}`,
  );

  const meldungen = h.abschnitt(
    "Hinweise",
    `${h.buehne(
      "",
      `<div class="hinweis info">${IKON.info}<div class="rumpf"><b>Zum Hinweis. </b>Der Wirtschaftsplan für 2027 kann ab dem 1. Oktober erstellt werden.</div></div>
      <div class="hinweis gut">${IKON.gut}<div class="rumpf"><b>Gebucht. </b>Die Zahlung wurde der Einheit WE 03 zugeordnet.</div></div>
      <div class="hinweis achtung">${IKON.achtung}<div class="rumpf"><b>Bitte prüfen. </b>Bei WE 07 fehlt die Wohnfläche – ohne sie lässt sich der Verteilerschlüssel nicht rechnen.</div></div>
      <div class="hinweis fehler" style="margin-bottom:0">${IKON.fehler}<div class="rumpf"><b>Nicht gespeichert. </b>Der Beschluss ist bereits protokolliert und kann nicht mehr geändert werden.</div></div>`,
    )}
${h.notiz(
  "Vier Varianten, eine Komponente. Vorher standen dieselben Banner in Amber, Grün und Rot " +
    "mehrfach dupliziert im Markup. Die Fehler-Variante trägt <code>role=\"alert\"</code>, die " +
    "übrigen <code>role=\"status\"</code> – der Unterschied entscheidet, ob ein Screenreader die " +
    "Meldung unterbricht oder abwartet.",
)}
${h.notiz(
  "<strong>Orange heißt hier nicht „Achtung“.</strong> Die Info-Variante nutzt zwar den " +
    "Marken-Akzent als Fläche, aber eine <em>Warnung</em> trägt Amber und ein <em>Fehler</em> " +
    "Rot. Eine Warnung, die aussieht wie der Haupt-Knopf, ist beides nicht mehr.",
)}`,
    "Ein Hinweis sagt, was passiert ist und was jetzt gilt. Er nennt die betroffene Stelle beim " +
      "Namen – „bei WE 07 fehlt die Wohnfläche“, nicht „ein Feld fehlt“.",
  );

  const rest = h.abschnitt(
    "Leere Stellen und Status",
    `    <div class="raster zwei">
      <div>
        <div class="leer">
          <span class="kreis"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h9"/></svg></span>
          <p>Noch keine Buchungen in diesem Zeitraum.</p>
          <div style="margin-top:5px"><button style="border-radius:var(--radius-xl);border:1px solid #d1d5db;background:#fff;padding:6px 13px;font-size:12px;font-weight:500;color:#374151;cursor:pointer;font-family:var(--font-sans)">Kontoauszug importieren</button></div>
        </div>
        <p style="margin-top:13px;font-size:12.5px;color:#6b7280"><code>EmptyState</code></p>
      </div>
      <div>
        <div class="kartenflaeche innen">
          <h4 style="margin-bottom:14px">Tickets</h4>
          <div style="display:flex;flex-direction:column;gap:11px">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px"><span>Heizung Treppenhaus</span><span class="etikett neu"><span class="puls"><span class="welle"></span><span class="kern"></span></span>Neu</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px"><span>Dachrinne Nordseite</span><span class="etikett arbeit">In Arbeit</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px"><span>Klingelschild WE 05</span><span class="etikett fertig">Erledigt</span></div>
          </div>
        </div>
        <p style="margin-top:13px;font-size:12.5px;color:#6b7280"><code>StatusBadge</code> – Beschriftung und Farbe aus <code>lib/labels.ts</code></p>
      </div>
    </div>
${h.notiz(
  "Eine leere Stelle sagt, warum sie leer ist, und bietet den nächsten Schritt an. „Keine " +
    "Einträge“ allein lässt jemanden, der zum ersten Mal hier ist, ratlos zurück.",
)}
${h.notiz(
  "Nur der Status <em>Neu</em> pulst – und zwar genau einer je Zeile. Pulsen alle drei, pulst " +
    "keiner mehr.",
)}`,
  );

  return seite({
    gruppe: "Komponenten",
    name: "Karten und Hinweise",
    untertitel: "Flächen, vier Meldungsarten, leere Stellen, Status",
    breite: 1200,
    hoehe: 2100,
    augenbraue: "Komponenten",
    titel: "Karten und Hinweise",
    einleitung:
      "Eine Karte fasst einen abgeschlossenen Inhalt. Ein Hinweis sagt, was gerade passiert ist. " +
      "Beides gibt es je einmal – nicht je Seite neu.",
    inhalt: [flaechen, meldungen, rest].join("\n"),
    quellen: [
      "components/ui.tsx (Card, CollapsibleCard, DarkCard, Alert, EmptyState, StatusBadge)",
      "portal/src/app/globals.css ([data-collapsible])",
      "lib/labels.ts",
    ],
    tokens,
    eigenesCss: EIGENES_CSS,
  });
}
