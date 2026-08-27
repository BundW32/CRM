import { seite, h } from "../lib/seite.mjs";

const EIGENES_CSS = `
  label.feldzeile { display: block; margin-bottom: 16px; }
  label.feldzeile > span:first-child { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; }
  label.feldzeile:has(input[required], select[required], textarea[required]) > span:first-child::after {
    content: " *"; color: var(--color-wp-accent-ink);
  }
  .eingabe {
    width: 100%; border-radius: var(--radius-lg); border: 1px solid #d1d5db; background: #fff;
    padding: 8px 12px; font-family: var(--font-sans); font-size: 14px; color: #111827;
    transition: border-color .15s, box-shadow .15s;
  }
  .eingabe:focus { outline: none; border-color: var(--color-brand-orange); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-brand-orange) 30%, transparent); }
  .eingabe.imFokus { border-color: var(--color-brand-orange); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-brand-orange) 30%, transparent); }
  .fuellfeld {
    height: 36px; width: 100%; border-radius: 10px; border: 0; background: rgba(243,244,246,.8);
    padding: 0 12px; font-family: var(--font-sans); font-size: 14px; color: #111827;
  }
  .fuellfeld::placeholder { color: #9ca3af; }
  .dunkelfeld {
    height: 36px; width: 100%; border-radius: 10px; border: 0; background: rgba(255,255,255,.07);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.10);
    padding: 0 12px; font-family: var(--font-sans); font-size: 14px; color: #f3f4f6;
  }
  .dunkelfeld::placeholder { color: #9ca3af; }
  select.eingabe {
    -webkit-appearance: none; appearance: none; padding-right: 36px;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.6' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 9.6px center; background-size: 18.4px 18.4px;
  }
  .fehlertext { font-size: 12.5px; color: var(--color-critical); margin: 6px 0 0; }
  .hilfetext { font-size: 12.5px; color: #6b7280; margin: 6px 0 0; }
  .regler { -webkit-appearance: none; appearance: none; background: transparent; width: 100%; height: 44px; margin: 0; }
  .regler::-webkit-slider-runnable-track {
    height: 10px; border-radius: 999px;
    background: linear-gradient(to right, var(--color-wp-accent) 46%, rgba(0,36,31,.12) 46%);
  }
  .regler::-moz-range-track {
    height: 10px; border-radius: 999px;
    background: linear-gradient(to right, var(--color-wp-accent) 46%, rgba(0,36,31,.12) 46%);
  }
  .regler::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none; height: 28px; width: 28px; margin-top: -9px;
    border-radius: 999px; background: #fff; border: 4px solid var(--color-wp-accent);
    box-shadow: 0 1px 4px rgba(0,36,31,.25);
  }
  .regler::-moz-range-thumb {
    height: 28px; width: 28px; border-radius: 999px; background: #fff;
    border: 4px solid var(--color-wp-accent); box-shadow: 0 1px 4px rgba(0,36,31,.25);
  }
`;

export function bauen(tokens) {
  const felder = h.abschnitt(
    "Eingaben",
    `    <div class="raster zwei">
      <div class="feld">
        <h3>Formularfeld</h3>
        <p style="margin-bottom:16px">Der Standard in allen Formularen des Portals.</p>
        <label class="feldzeile">
          <span>Wohnfläche in m²</span>
          <input class="eingabe" type="text" value="74,50" required>
        </label>
        <label class="feldzeile">
          <span>Im Fokus</span>
          <input class="eingabe imFokus" type="text" value="74,50">
        </label>
        <label class="feldzeile" style="margin-bottom:0">
          <span>Einheitentyp</span>
          <select class="eingabe" required>
            <option>Wohnung</option><option>Stellplatz</option><option>Gewerbe</option>
          </select>
        </label>
        <p style="margin-top:15px"><span class="token">inputClass</span></p>
      </div>
      <div class="feld">
        <h3>Filterfeld, hell</h3>
        <p style="margin-bottom:16px">Randlos, für Filterleisten auf weißen Karten.</p>
        <input class="fuellfeld" type="search" placeholder="Eigentümer suchen …">
        <p style="margin-top:15px"><span class="token">fieldFillClass</span></p>
        <div style="margin-top:22px;background:var(--color-shell);border-radius:var(--radius-lg);padding:18px">
          <p style="margin:0 0 11px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45)">Dieselbe Rolle auf dunklem Grund</p>
          <input class="dunkelfeld" type="search" placeholder="Eigentümer suchen …">
          <p style="margin-top:13px"><span class="token" style="background:rgba(255,255,255,.12);color:#fff">fieldOnDarkClass</span></p>
        </div>
      </div>
    </div>
${h.notiz(
  "<strong>Das Sternchen setzt niemand von Hand.</strong> Das Stylesheet liest die Wahrheit " +
    "direkt aus dem Formular: Trägt ein <code>label</code> ein Feld mit <code>required</code>, " +
    "bekommt seine erste Beschriftungszeile ein Sternchen. Bei über hundert Feldern wäre jede " +
    "Markierung von Hand irgendwann halb – und ein vergessenes Pflichtfeld sähe freiwillig aus. " +
    "Rein visuell übrigens: Dass ein Feld Pflicht ist, sagt <code>required</code> dem " +
    "Screenreader ohnehin.",
)}
${h.notiz(
  "Der native Pfeil des Auswahlfeldes ist ersetzt – sonst zeichnet jedes Betriebssystem einen " +
    "anderen, und auf Safari passt die Höhe nicht zu den Texteingaben daneben. Unter 640 px " +
    "Breite bekommen alle Felder <code>font-size: 16px</code>: Darunter zoomt iOS beim " +
    "Antippen ungefragt in die Seite hinein.",
)}`,
  );

  const zustaende = h.abschnitt(
    "Zustände",
    `${h.buehne(
      "",
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:24px">
        <label class="feldzeile" style="margin:0">
          <span>Ruhe</span>
          <input class="eingabe" type="text" value="Hausgeld 245,00 €">
        </label>
        <label class="feldzeile" style="margin:0">
          <span>Fokus (Tastatur)</span>
          <input class="eingabe imFokus" type="text" value="Hausgeld 245,00 €">
          <p class="hilfetext">2 px Ring in Marken-Orange, 2 px Abstand.</p>
        </label>
        <label class="feldzeile" style="margin:0">
          <span>Mit Hilfe</span>
          <input class="eingabe" type="text" value="245,00">
          <p class="hilfetext">Monatlich, ohne Rücklage.</p>
        </label>
        <label class="feldzeile" style="margin:0">
          <span>Fehler</span>
          <input class="eingabe" type="text" value="zwohundert" style="border-color:var(--color-critical);box-shadow:0 0 0 2px rgba(194,59,46,.18)">
          <p class="fehlertext">Bitte einen Betrag eingeben, zum Beispiel 245,00.</p>
        </label>
        <label class="feldzeile" style="margin:0">
          <span>Gesperrt</span>
          <input class="eingabe" type="text" value="WEG-Nr. 4711" disabled style="background:#f9fafb;color:#9ca3af">
        </label>
      </div>`,
    )}
${h.notiz(
  "Der Fehlertext sagt, was zu tun ist, und zeigt es am Beispiel. „Ungültige Eingabe“ sagt " +
    "beides nicht. Fehlermeldungen stehen unter dem Feld, nicht als Blase darüber – wer " +
    "vergrößert dargestellt liest, sieht die Blase sonst nie.",
)}`,
  );

  const regler = h.abschnitt(
    "Der Einheiten-Regler",
    `${h.buehne(
      "Preisseite",
      `<div style="max-width:520px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
          <span style="font-size:13px;font-weight:500;color:#374151">Einheiten in Ihrer WEG</span>
          <span style="font-family:var(--font-mk);font-size:22px;font-weight:700;color:var(--color-wp-ink);font-variant-numeric:tabular-nums">6</span>
        </div>
        <input class="regler" type="range" min="1" max="12" value="6" aria-label="Einheiten in Ihrer WEG">
        <p class="hilfetext" style="margin-top:2px">Preis für Ihre WEG</p>
      </div>`,
      "papier",
    )}
${h.notiz(
  "Ein natives <code>input[type=range]</code> – Tastatur, Touch und Screenreader funktionieren " +
    "damit ohne Zutun, ersetzt wird nur die Optik. Der Griff ist mit 28 px in einer 44 px hohen " +
    "Fläche bewusst groß: Am Handy wird er mit dem Daumen gezogen. Der Fokus-Ring gehört an den " +
    "Griff, nicht um das ganze Feld – ein Kasten über die volle Breite sagt nicht, was sich " +
    "gerade bewegt.",
)}
${h.notiz(
  "<strong>Reihenfolge nicht umdrehen:</strong> Beim Aufschlagen zeigen die Tarifkarten den " +
    "Preis <em>je Einheit</em> – die Zahl zum Vergleichen. Erst wenn jemand den Regler anfasst, " +
    "wird daraus der Monatsbetrag und die Zeile darunter sagt „Preis für Ihre WEG“.",
)}`,
  );

  return seite({
    gruppe: "Komponenten",
    name: "Formularfelder",
    untertitel: "Eingaben, Zustände, Pflichtfeld-Automatik und der Einheiten-Regler",
    breite: 1200,
    hoehe: 2100,
    augenbraue: "Komponenten",
    titel: "Formularfelder",
    einleitung:
      "Formulare sind der Ort, an dem das Portal am ehesten Vertrauen verliert. Deshalb ist hier " +
      "wenig erfunden und viel nativ: Das Stylesheet ersetzt nur die Optik, nicht das Verhalten.",
    inhalt: [felder, zustaende, regler].join("\n"),
    quellen: [
      "components/ui.tsx (inputClass, fieldFillClass, fieldOnDarkClass)",
      "portal/src/app/globals.css (label:has(…), select, .wp-regler)",
      "app/preise/tarif-bereich.tsx",
    ],
    tokens,
    eigenesCss: EIGENES_CSS,
  });
}
