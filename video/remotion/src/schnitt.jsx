// Der Schnittplan.
//
// Zeiten kommen aus den Marken der Aufnahme (`clips/<szene>.json`), nicht aus
// geschätzten Sekunden — das Laden einer Seite schwankt um über eine Sekunde.
// Die Rechtecke für den Spotlight stammen aus derselben Quelle.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BREITE, FARBEN, FPS, HOEHE, Einstellung, Unterzeile } from "./bausteine";
import { Karte, Nebeneinander, Notiz, PdfBlatt, Telefon } from "./stilmittel";

const M = {};
for (const n of ["02-fahrplan", "05-wirtschaftsplan", "06-hausgeld", "07-versammlung",
  "08-rollen", "09-ki", "10-jahresabrechnung", "11-sammlung", "12-handy"]) {
  M[n] = require(`../public/clips/${n}.json`);
}

const s = (x) => Math.round(x * FPS);        // Sekunden → Bilder
const MITTE = { z: 1, cx: 0.5, cy: 0.5 };

// STEHT: keine Kamerabewegung. In Fassung 4 hatte jede der 13 Einstellungen
// eine Fahrt — damit wird das stärkste Mittel zur Gewohnheit. Jetzt bewegt sich
// die Kamera nur noch dort, wo die Bewegung etwas erzählt; dazwischen steht das
// Bild, und genau dieser Wechsel hält das Video wach.
const STEHT = { von: MITTE, nach: MITTE };
const naeher = (z, cx, cy) => ({ von: MITTE, nach: { z, cx, cy } });

// Kleinstes Rechteck, das beide umschließt.
const vereinigung = (a, b) => {
  if (!a) return b || null;
  if (!b) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

// Lesezeit: ~14 Zeichen je Sekunde, mindestens 2 s. Gilt weiter — nur wird sie
// jetzt im Schnitt gerechnet und nicht mehr in der Aufnahme abgewartet.
const lesezeit = (t) => Math.max(s(2), s(t.replace(/\*/g, "").length / 14));

// Unterzeile ab Bild 6 der Einstellung, so lange wie nötig.
const zeile = (text, dauer) => ({ text, ab: 6, bis: Math.min(dauer - 6, 6 + lesezeit(text)) });

// ── Titeltafeln: jetzt nativ statt aufgenommen ──────────────────────────────
// Bisher wurden sie im Browser gerendert und mitgefilmt. Als React-Ebene sind
// sie schärfer, ohne Videokompression, und eine Textänderung kostet keine neue
// Aufnahme mehr.
export const Titel = ({ zeilen, dauer }) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, dauer], [1, 1.05], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(120% 100% at 50% 0%, #24413c 0%, ${FARBEN.dunkel} 62%)`,
      alignItems: "center", justifyContent: "center", transform: `scale(${z})`,
    }}>
      <div style={{ maxWidth: 940, padding: "0 60px", textAlign: "center" }}>
        {zeilen.map((t, i) => {
          const o = interpolate(frame, [4 + i * 4, 16 + i * 4], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const y = interpolate(frame, [4 + i * 4, 16 + i * 4], [18, 0], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const teile = t.split(/(\*[^*]+\*)/).filter(Boolean);
          return (
            <div key={i} style={{
              opacity: o, transform: `translateY(${y}px)`,
              fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800,
              fontSize: 64, lineHeight: 1.12, letterSpacing: "-0.02em", color: "#fff",
            }}>
              {teile.map((p, j) => p.startsWith("*")
                ? <span key={j} style={{ color: FARBEN.orange }}>{p.slice(1, -1)}</span>
                : <span key={j}>{p}</span>)}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Endtafel = ({ dauer }) => {
  const frame = useCurrentFrame();
  const auf = (ab) => interpolate(frame, [ab, ab + 12], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const hoch = (ab) => interpolate(frame, [ab, ab + 12], [16, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(120% 100% at 50% 0%, #24413c 0%, ${FARBEN.dunkel} 62%)`,
      alignItems: "center", justifyContent: "center", gap: 30,
    }}>
      {/* Das Logo trägt dunkelgrüne Schrift und verschwindet auf dunklem Grund —
          deshalb steht es auf einer hellen Platte, wie auf Briefpapier. */}
      <div style={{
        background: "#fff", borderRadius: 18, padding: "22px 30px",
        boxShadow: "0 12px 40px rgba(0,0,0,.35)",
        opacity: auf(2), transform: `translateY(${hoch(2)}px)`,
      }}>
        <Img src={staticFile("bw-logo.png")} style={{ width: 210, display: "block" }} />
      </div>
      <div style={{
        fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 52,
        color: "#fff", textAlign: "center", lineHeight: 1.12,
        opacity: auf(8), transform: `translateY(${hoch(8)}px)`,
      }}>
        Ihre Gemeinschaft.<br />
        <span style={{ color: FARBEN.orange }}>Ihre Zahlen.</span>
      </div>
      <div style={{
        background: FARBEN.orange, color: "#00241f", fontWeight: 600, fontSize: 24,
        padding: "16px 34px", borderRadius: 14, fontFamily: '"Inter", sans-serif',
        opacity: auf(20), transform: `translateY(${hoch(20)}px)`,
      }}>Kostenlos einrichten</div>
      <div style={{
        color: "#b9b0a8", fontSize: 19, fontFamily: '"Inter", sans-serif',
        opacity: auf(26),
      }}>Ohne Verwaltervertrag. In wenigen Minuten.</div>
    </AbsoluteFill>
  );
};

// ── Die Einstellungen ───────────────────────────────────────────────────────
// Jede Einstellung: Clip, Startsekunde in der Aufnahme, Dauer, Kamerafahrt,
// optional Spotlight-Ziele und Unterzeile.
function bauen() {
  const e = [];
  const add = (o) => { e.push(o); return o; };

  // 01 Hook
  add({ art: "titel", dauer: s(2.9), zeilen: ["Keine Hausverwaltung gefunden?", "Die *Pflichten* bleiben."] });

  // 02 Jahresfahrplan — das Licht wandert über drei Fristen, die Kamera sinkt mit.
  {
    const m = M["02-fahrplan"];
    const dauer = s(5.4);
    add({
      art: "clip", clip: "02-fahrplan", ab: m.bereit + 0.1, dauer,
      // Steht. Der wandernde Spotlight ist hier die Bewegung — eine Fahrt
      // zusätzlich wäre eine zweite Bewegungsart im selben Bild.
      kamera: STEHT,
      ziele: [
        { box: m.boxes.z1, ab: s(0.5), bis: s(1.7) },
        { box: m.boxes.z2, ab: s(2.0), bis: s(3.1) },
        { box: m.boxes.z3, ab: s(3.4), bis: s(4.8) },
      ],
      unterzeile: zeile("Das Portal sagt Ihnen, was *jetzt* dran ist.", dauer),
    });
  }

  // 05 Wirtschaftsplan — zwei Umlageschlüssel im Licht …
  {
    const m = M["05-wirtschaftsplan"];
    const d1 = s(4.2);
    add({
      art: "clip", clip: "05-wirtschaftsplan", ab: m.bereit + 0.1, dauer: d1,
      kamera: STEHT,
      ziele: [
        { box: m.boxes.muell, ab: s(0.5), bis: s(1.8) },
        { box: m.boxes.treppe, ab: s(2.1), bis: s(3.5) },
      ],
      unterzeile: zeile("Verteilt nach dem *richtigen Schlüssel.*", d1),
    });
    // … und die Scrollfahrt hinunter zum Hausgeld je Einheit.
    const d2 = s(3.4);
    // Als Karte auf Markengrund: ein Beat ohne Bewegung nach zwei bewegten
    // Einstellungen — und der Rahmen betont, dass hier ein Ergebnis steht.
    add({
      art: "karte", clip: "05-wirtschaftsplan", ab: m.scroll_los - 0.15, dauer: d2,
      unterzeile: zeile("Daraus entsteht das *Hausgeld je Einheit.*", d2),
    });
  }

  // 06 Hausgeld — Scrollfahrt in die Rückstandsliste, Licht auf die Summe.
  {
    const m = M["06-hausgeld"];
    const d1 = s(2.2);
    add({
      art: "clip", clip: "06-hausgeld", ab: m.scroll_los, dauer: d1,
      kamera: STEHT,
    });
    const d2 = s(3.8);
    add({
      art: "clip", clip: "06-hausgeld", ab: m.liste + 0.1, dauer: d2,
      kamera: naeher(1.12, 0.5, 0.42),
      ziele: [{ box: m.boxes.summe, ab: s(0.6), bis: s(3.0) }],
      // Die Zahl wird benannt, statt sie nur größer zu zeigen.
      notiz: { box: m.boxes.summe, text: "8.525,11 € offen", ab: s(1.2), bis: s(3.2), seite: "links" },
      unterzeile: zeile("Wer gezahlt hat — und *wer nicht.*", d2),
    });
  }

  // 07 Versammlung — Tagesordnung, dann sortiert ein Klick sie um.
  {
    const m = M["07-versammlung"];
    const d1 = s(3.2);
    add({
      art: "clip", clip: "07-versammlung", ab: m.bereit + 0.1, dauer: d1,
      kamera: STEHT,
      ziele: [{ box: m.boxes.top2, ab: s(0.5), bis: s(2.4) }],
      unterzeile: zeile("Tagesordnung, *Punkt für Punkt.*", d1),
    });
    add({
      art: "clip", clip: "07-versammlung", ab: m.reihenfolge - 0.6, dauer: s(3.0),
      kamera: naeher(1.16, 0.4, 0.58),
    });
  }

  // 10 Jahresabrechnung — Abrechnungsspitze je Einheit.
  {
    const m = M["10-jahresabrechnung"];
    const d1 = s(4.4);
    add({
      art: "clip", clip: "10-jahresabrechnung", ab: m.scroll_los, dauer: d1,
      kamera: STEHT,
      ziele: [{ box: m.boxes.spitze, ab: s(2.2), bis: s(4.0) }],
      unterzeile: zeile("Jahresabrechnung mit *Abrechnungsspitze.*", d1),
    });
  }

  // 11 Das PDF — echtes Dokument aus der App.
  add({ art: "pdf", datei: "einzelabrechnung", dauer: s(3.6),
    unterzeile: zeile("Ein Klick, *ein fertiges Dokument.*", s(3.6)) });

  // 12 Handy — dieselbe Sache am Telefon.
  {
    const m = M["12-handy"];
    add({ art: "handy", clip: "12-handy", ab: m.uebersicht - 0.4, dauer: s(4.8),
      nebenText: "Und *am Telefon* genauso." });
  }

  // 13 Beschluss-Sammlung — nummeriert, § 24 Abs. 7 WEG.
  {
    const m = M["11-sammlung"];
    const d = s(3.6);
    add({
      art: "clip", clip: "11-sammlung", ab: m.bereit + 0.2, dauer: d,
      kamera: naeher(1.08, 0.5, 0.45),
      ziele: m.boxes.eintrag ? [{ box: m.boxes.eintrag, ab: s(0.8), bis: s(3.0) }] : [],
      unterzeile: zeile("Beschluss-Sammlung, *lückenlos* — auch als PDF.", d),
    });
  }
  // Der PDF-Export der Sammlung wird nur erwähnt — ein zweites PDF-Blatt wäre
  // dieselbe Idee ein zweites Mal und würde das Video nur verlängern.

  // 08 Rollenwechsel — dieselbe WEG, kürzeres Menü.
  {
    const m = M["08-rollen"];
    const f = M["02-fahrplan"];
    const dauer = s(4.0);
    // Geteiltes Bild statt Kamerafahrt: Der Rollenunterschied ist ein
    // Vergleich, und ein Vergleich gehört in EIN Bild. Nacheinander gezeigt
    // müsste der Zuschauer sich die linke Seite merken.
    add({
      art: "nebeneinander", dauer,
      links: { clip: "02-fahrplan", ab: f.bereit + 0.3, titel: "Verwaltender Eigentümer" },
      rechts: { clip: "08-rollen", ab: m.drin + 0.4, titel: "Miteigentümerin" },
      unterzeile: zeile("Und jeder Eigentümer *sieht mit.*", dauer),
    });
  }

  // 09 KI-Assistent — Zeiger, Tippen, Antwort mit Quellen.
  {
    const m = M["09-ki"];
    add({
      art: "clip", clip: "09-ki", ab: m.zeiger_los - 0.2, dauer: s(Math.min(2.4, m.offen - m.zeiger_los - 0.4)),
      kamera: STEHT,
    });
    add({
      art: "clip", clip: "09-ki", ab: m.offen + 0.15, dauer: s(3.0),
      // Nah dran und ruhig: Beim Mitlesen stört jede Bewegung.
      kamera: { von: { z: 1.55, cx: 0.79, cy: 0.58 }, nach: { z: 1.55, cx: 0.79, cy: 0.58 } },
    });
    const dA = s(3.6);
    add({
      art: "clip", clip: "09-ki", ab: m.antwort - 0.4, dauer: dA,
      kamera: { von: { z: 1.45, cx: 0.79, cy: 0.4 }, nach: { z: 1.7, cx: 0.79, cy: 0.46 } },
      // Vereinigung beider Chip-Rechtecke — der Beleg besteht aus zwei Zeilen.
      ziele: vereinigung(m.boxes.quelle1, m.boxes.quelle2)
        ? [{ box: vereinigung(m.boxes.quelle1, m.boxes.quelle2), ab: s(1.5), bis: s(3.2) }]
        : [],
      unterzeile: zeile("Mit *Quellenangabe.*", dA),
    });
  }

  add({ art: "ende", dauer: s(3.0) });
  return e;
}

export const EINSTELLUNGEN = bauen();
export { s as sek };
