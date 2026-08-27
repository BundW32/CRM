import { seite, h } from "../lib/seite.mjs";
import { wert } from "../lib/tokens.mjs";

const EIGENES_CSS = `
  .rahmen { border: 1px solid #e5e7eb; border-radius: var(--radius-lg); overflow: hidden; margin-top: 20px; }
  .kopfleiste { background: rgba(250,248,244,.92); backdrop-filter: blur(12px); border-bottom: 1px solid color-mix(in srgb, var(--color-wp-ink) 15%, transparent); }
  .kopfleiste .innen { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 24px; }
  .wm { display: inline-flex; align-items: center; gap: .625em; font-family: var(--font-display); font-size: 20px; font-weight: 800; letter-spacing: -.025em; line-height: 1; color: var(--color-wp-ink); }
  .wm svg { height: 1em; width: 1em; }
  .navi { display: flex; align-items: center; gap: 26px; font-size: 15px; }
  .navi a { color: color-mix(in srgb, var(--color-wp-ink) 65%, transparent); text-decoration: none; padding-bottom: 3px; }
  .navi a.hier { color: var(--color-wp-ink); font-weight: 600; text-decoration: underline; text-decoration-color: var(--color-wp-accent-ink); text-decoration-thickness: 2px; text-underline-offset: 7px; }
  .kopfaktionen { display: flex; align-items: center; gap: 16px; }
  .anmelden { font-size: 15px; font-weight: 600; color: var(--color-wp-ink); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--color-wp-ink) 30%, transparent); text-underline-offset: 6px; }
  .kopfknopf { display: inline-flex; align-items: center; min-height: 44px; border-radius: var(--radius-xl); background: var(--color-wp-accent); color: var(--color-wp-on-accent); padding: 8px 16px; font-size: 14px; font-weight: 600; box-shadow: var(--shadow-e1); text-decoration: none; }
  .fussleiste { background: var(--color-wp-ink); padding: 34px 24px 0; }
  .fussgitter { display: grid; gap: 28px; grid-template-columns: 1.3fr 1fr 1fr 1fr; }
  .fussgitter p.spaltentitel { font-size: 11px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.5); margin: 0 0 14px; }
  .fussgitter ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .fussgitter a { color: rgba(255,255,255,.8); font-size: 13.5px; text-decoration: none; }
  .fussgitter .werbetext { color: rgba(255,255,255,.7); font-size: 13.5px; line-height: 1.55; margin: 14px 0 0; max-width: 30ch; }
  .fussgitter .post { display: inline-flex; align-items: center; gap: 8px; color: rgba(255,255,255,.8); font-size: 13.5px; margin-top: 14px; text-decoration: none; }
  .fussunten { margin-top: 30px; border-top: 1px solid rgba(255,255,255,.1); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding: 16px 0; font-size: 12px; color: rgba(255,255,255,.6); }
  .mobilleiste { position: relative; border: 1px solid #e5e7eb; border-radius: var(--radius-lg); background: #fff; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: var(--shadow-e2); max-width: 375px; }
  .mobilleiste .text { font-size: 13px; color: #6b7280; }
`;

function glyph(fest, akzent) {
  return `<svg viewBox="0 0 36 36" aria-hidden="true"><rect x="0" y="0" width="16" height="16" rx="2.5" fill="${fest}"/><rect x="0" y="20" width="16" height="16" rx="2.5" fill="${fest}"/><rect x="20" y="0" width="16" height="36" rx="2.5" fill="${akzent}"/></svg>`;
}

export function bauen(tokens) {
  const ink = wert(tokens, "--color-wp-ink");
  const akzent = wert(tokens, "--color-wp-accent");

  const kopf = h.abschnitt(
    "Kopfzeile",
    `    <div class="rahmen">
      <div class="kopfleiste">
        <div class="innen">
          <span class="wm">${glyph(ink, akzent)}<span>wegportal<span style="color:${akzent}">24</span></span></span>
          <nav class="navi">
            <a class="hier" href="#">So funktioniert’s</a>
            <a href="#">Finanzen</a><a href="#">Hausgeld</a><a href="#">Versammlung</a>
            <a href="#">Kommunikation</a><a href="#">Preise</a>
          </nav>
          <div class="kopfaktionen">
            <a class="anmelden" href="#">Anmelden</a>
            <a class="kopfknopf" href="#">Registrieren</a>
          </div>
        </div>
      </div>
      <div style="background:#faf8f4;padding:22px 24px;color:#9ca3af;font-size:12.5px">Seiteninhalt</div>
    </div>
${h.notiz(
  "<strong>„So funktioniert’s“ steht zuerst.</strong> Für den unsicheren Erstbesucher ist das " +
    "der wichtigste Link – im früheren waagerecht scrollenden Band lag er bei 390 px außerhalb " +
    "des Bildschirms.",
)}
${h.notiz(
  "Aktionsleiste und Kopfzeile kleben gemeinsam in <em>einem</em> Rahmen. Getrennte " +
    "<code>sticky</code>-Elemente gingen nicht: Die Kopfzeile müsste die Höhe der Leiste als " +
    "<code>top</code> kennen, und die ist je Breite anders beschriftet – ein fester Wert wäre auf " +
    "einer Breite immer falsch, und dazwischen entstünde eine Lücke, durch die der Inhalt " +
    "sichtbar durchscrollt.",
)}
${h.notiz(
  "<strong>Falle beim Overlay:</strong> Die Kopfzeile trägt <code>backdrop-blur</code>. Ein " +
    "Backdrop-Filter macht sein Element zum Bezugsrahmen für <code>position: fixed</code> – das " +
    "mobile Menü gehört deshalb per <code>createPortal</code> an <code>&lt;body&gt;</code>, nie " +
    "in den Header.",
  "warnung",
)}`,
    "Eine Kopfzeile für alle Breiten: Wortmarke, Navigation ab <code>lg</code>, Anmelden ab " +
      "<code>sm</code>, und der Registrieren-Knopf auf <em>jeder</em> Breite. Er ist die eine " +
      "Handlung dieser Seiten.",
  );

  const mobil = h.abschnitt(
    "Mobil",
    `    <div class="reihe" style="align-items:flex-start;gap:30px">
      <div>
        <div class="rahmen" style="max-width:375px;margin-top:0">
          <div class="kopfleiste">
            <div class="innen" style="padding:12px 14px;gap:9px">
              <span class="wm" style="font-size:18px">${glyph(ink, akzent)}<span>wegportal<span style="color:${akzent}">24</span></span></span>
              <div class="kopfaktionen" style="gap:8px">
                <a class="kopfknopf" href="#" style="padding:8px 13px">Starten</a>
                <button aria-label="Menü öffnen" style="display:inline-flex;align-items:center;justify-content:center;height:44px;width:44px;border:0;background:transparent;cursor:pointer;color:${ink}">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
                </button>
              </div>
            </div>
          </div>
          <div style="background:#faf8f4;padding:20px 14px;color:#9ca3af;font-size:12.5px">375 px – iPhone SE</div>
        </div>
        <p style="margin-top:13px;font-size:12.5px;color:#6b7280">Kopfzeile <b>einzeilig</b>. „Anmelden“ wandert ins Overlay, „Registrieren“ wird zu „Starten“ – und bleibt.</p>
      </div>
      <div>
        <div class="mobilleiste">
          <span class="text">Kostenlos, ohne Zahlungsdaten</span>
          <a class="kopfknopf" href="#" style="padding:9px 15px">Starten</a>
        </div>
        <p style="margin-top:13px;font-size:12.5px;color:#6b7280;max-width:375px"><code>MobileCtaBar</code> – blendet sich ab etwa 25 % Scrolltiefe ein und am Abschluss-Block <code>#schluss-cta</code> wieder aus. Die Fußzeile gehört mit in diesen Block, sonst taucht die Leiste am Seitenende wieder auf.</p>
      </div>
    </div>
${h.notiz(
  "Höhen in <code>svh</code>, nie <code>vh</code>: iOS rechnet <code>vh</code> mit eingeklappter " +
    "URL-Leiste – beim ersten Scrollen springt sonst der Inhalt. Und Scroll-Pinning nur ab " +
    "<code>lg</code>, per CSS geschaltet (<code>hidden lg:block</code>), nicht per Client-Weiche: " +
    "Der Server kennt die Breite nicht, ein Umschalten nach der Hydratation springt.",
)}`,
  );

  const fuss = h.abschnitt(
    "Fußzeile",
    `    <div class="rahmen">
      <div class="fussleiste">
        <div class="fussgitter">
          <div>
            <span class="wm" style="color:#fff">${glyph("#ffffff", akzent)}<span>wegportal<span style="color:${akzent}">24</span></span></span>
            <p class="werbetext">Das Portal für selbstverwaltete Wohnungseigentümergemeinschaften – von der ersten Buchung bis zur revisionssicheren Jahresabrechnung.</p>
            <a class="post" href="#"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>info@wegportal24.de</a>
          </div>
          <div><p class="spaltentitel">Funktionen</p><ul><li><a href="#">Finanzen &amp; Jahresabrechnung</a></li><li><a href="#">Hausgeld &amp; Rückstände</a></li><li><a href="#">Versammlung &amp; Abstimmung</a></li><li><a href="#">Kommunikation &amp; Alltag</a></li><li><a href="#">Sondereigentum &amp; Mieter</a></li><li><a href="#">KI-Berater</a></li></ul></div>
          <div><p class="spaltentitel">Einstieg</p><ul><li><a href="#">Der Weg zur Selbstverwaltung</a></li><li><a href="#">Preise und Tarife</a></li><li><a href="#">Fragen &amp; Anregungen</a></li><li><a href="#">Kostenlos registrieren</a></li><li><a href="#">Zum Login</a></li></ul></div>
          <div><p class="spaltentitel">Rechtliches</p><ul><li><a href="#">Impressum</a></li><li><a href="#">Datenschutz</a></li><li><a href="#">AGB</a></li><li><a href="#">Widerrufsbelehrung</a></li><li><a href="#">Verträge hier kündigen</a></li><li><a href="#">Auftragsverarbeitung (AVV)</a></li><li><a href="#">KI-Transparenz</a></li></ul></div>
        </div>
        <div class="fussunten">
          <p style="margin:0">© 2026 wegportal24.de. Alle Rechte vorbehalten. · Cookie-Einstellungen</p>
          <p style="margin:0">Wirtschaftsplan · Jahresabrechnung · Hausgeld – nach §§ 19, 26a, 28 WEG</p>
        </div>
      </div>
    </div>
${h.notiz(
  "<strong>Vier Beschriftungen in der Rechtsspalte sind vom Gesetz vorgegeben, nicht vom " +
    "Marketing.</strong> „Verträge hier kündigen“ steht so in § 312k Absatz 2 BGB und darf nicht " +
    "in „Vertrag beenden“ umbenannt werden. Die Widerrufsbelehrung ist Pflicht, weil eine WEG " +
    "Verbraucherin ist, sobald ihr eine natürliche Person angehört (BGH VIII ZR 243/13). " +
    "KI-Transparenz folgt Artikel 50 der EU-KI-Verordnung. Das Impressum nennt die Betreiberin " +
    "nach § 5 DDG – es ist die eine Stelle, an der sie stehen <em>muss</em>.",
  "warnung",
)}`,
    "Der dunkelgrüne Anker am Seitenende. Vier Spalten: Marke, Funktionen, Einstieg, Rechtliches.",
  );

  return seite({
    gruppe: "Komponenten",
    name: "Kopf- und Fußzeile",
    untertitel: "Der Rahmen jeder öffentlichen Seite, auf allen Breiten",
    breite: 1280,
    hoehe: 2100,
    augenbraue: "Komponenten",
    titel: "Kopf- und Fußzeile",
    einleitung:
      "Sie stehen auf jeder öffentlichen Seite und tragen zusammen den einen Weg, den diese Seiten " +
      "anbieten: registrieren. Keine Seite baut sie selbst.",
    inhalt: [kopf, mobil, fuss].join("\n"),
    quellen: [
      "components/marketing/site.tsx (MarketingHeader, MarketingFooter)",
      "components/marketing/mobile-menu.tsx",
      "components/marketing/mobile-cta-bar.tsx",
    ],
    tokens,
    eigenesCss: EIGENES_CSS,
  });
}
