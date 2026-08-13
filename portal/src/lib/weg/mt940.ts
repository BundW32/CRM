// MT940 (SWIFT-Kontoauszug, „.sta") — der zweite Weg neben CSV.
//
// MT940 ist kein Tabellenformat: Es gibt keine Spalten, die man zuordnen
// könnte, sondern nummerierte Felder. Der Umsatz steht in `:61:`, der
// Verwendungszweck im `:86:` darunter. Deshalb entfällt für diese Dateien die
// Spaltenzuordnung im Assistenten vollständig — es gibt nichts zu raten.
//
// Zwei Eigenheiten, an denen ein naiver Leser scheitert:
//
//   - **Zeilen sind keine Felder.** Ein Feld läuft über beliebig viele Zeilen
//     weiter, solange die nächste Zeile nicht mit `:NN:` beginnt. Wer je Zeile
//     liest, verliert bei jedem längeren Verwendungszweck den Rest.
//   - **Der Verwendungszweck ist in Häppchen zerlegt.** Deutsche Banken füllen
//     `:86:` mit Feldschlüsseln (`?20`…`?29` Zweck, `?32`/`?33` Name) zu je 27
//     Zeichen. Sie gehören **ohne** Trennzeichen aneinandergehängt, sonst
//     entsteht mitten im Wort eine Lücke.
import { parseSignedEuroToCents } from "./bank-import";

/** Ein Umsatz, wie ihn ein Nicht-CSV-Format liefert — ohne Spalten-Mapping. */
export type Umsatzzeile = {
  bookingDate: Date;
  valueDate?: Date;
  /** vorzeichenbehaftet: negativ = Ausgabe. */
  amountCents: number;
  purpose: string;
  counterparty?: string;
};

type Feld = { tag: string; wert: string };

/** Zerlegt die Datei in Felder — Fortsetzungszeilen gehören zum Feld davor. */
function leseFelder(text: string): Feld[] {
  const felder: Feld[] = [];
  for (const roh of text.split(/\r?\n/)) {
    const zeile = roh.replace(/\s+$/, "");
    if (zeile === "" || zeile === "-") continue;
    const m = zeile.match(/^:(\d{2}[A-Z]?):(.*)$/);
    if (m) felder.push({ tag: m[1], wert: m[2] });
    else if (felder.length > 0) felder[felder.length - 1].wert += `\n${zeile}`;
  }
  return felder;
}

/** JJMMTT → Datum (UTC-Mitternacht). MT940 kennt kein Jahrhundert. */
function datumAusJJMMTT(s: string): Date | null {
  const jahr = 2000 + Number(s.slice(0, 2));
  const monat = Number(s.slice(2, 4));
  const tag = Number(s.slice(4, 6));
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  const d = new Date(Date.UTC(jahr, monat - 1, tag));
  return d.getUTCDate() === tag && d.getUTCMonth() === monat - 1 ? d : null;
}

/**
 * Das Buchungsdatum steht nur als MMTT da — das Jahr kommt von der Valuta.
 * Über den Jahreswechsel liegen beide auseinander: Valuta 02.01.2024, Buchung
 * 30.12. heißt 30.12.**2023**. Ohne diese Korrektur wandert eine Buchung um
 * ein Jahr und landet im falschen Wirtschaftsjahr.
 */
function buchungsdatum(mmtt: string, valuta: Date): Date | null {
  const monat = Number(mmtt.slice(0, 2));
  const tag = Number(mmtt.slice(2, 4));
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  let jahr = valuta.getUTCFullYear();
  const abstand = monat - (valuta.getUTCMonth() + 1);
  if (abstand > 6) jahr -= 1;
  else if (abstand < -6) jahr += 1;
  const d = new Date(Date.UTC(jahr, monat - 1, tag));
  return d.getUTCDate() === tag && d.getUTCMonth() === monat - 1 ? d : null;
}

// SEPA-Kennungen im Verwendungszweck. Der eigentliche Text steht hinter
// `SVWZ+`; davor und dahinter stehen Mandats-, End-to-End- und
// Gläubiger-Referenzen, die niemand lesen will.
const SEPA_TAGS = /\b(EREF|KREF|MREF|CRED|DEBT|COAM|OAMT|SVWZ|ABWA|ABWE|IBAN|BIC)\+/g;

export function loeseSepaKennungen(text: string): string {
  const start = text.indexOf("SVWZ+");
  if (start === -1) return text.trim();
  const rest = text.slice(start + 5);
  SEPA_TAGS.lastIndex = 0;
  const naechste = SEPA_TAGS.exec(rest);
  return (naechste ? rest.slice(0, naechste.index) : rest).trim();
}

/**
 * Liest `:86:` — entweder mit deutschen Feldschlüsseln (`?00…?63`) oder als
 * Fließtext.
 */
export function leseVerwendungszweck(roh: string): { purpose: string; counterparty?: string } {
  // Zeilenumbrüche gehören ersatzlos weg: Die Bank hat den Text bei 27 Zeichen
  // umbrochen, oft mitten im Wort.
  const text = roh.replace(/\r?\n/g, "");
  if (!text.includes("?")) {
    return { purpose: loeseSepaKennungen(text.replace(/^\d{3}/, "").trim()) };
  }
  const teile = new Map<string, string>();
  for (const m of text.matchAll(/\?(\d{2})([^?]*)/g)) {
    teile.set(m[1], (teile.get(m[1]) ?? "") + m[2]);
  }
  const sammle = (schluessel: string[]) =>
    schluessel
      .map((k) => teile.get(k) ?? "")
      .join("")
      .trim();
  const zweck = sammle([
    "20", "21", "22", "23", "24", "25", "26", "27", "28", "29",
    "60", "61", "62", "63",
  ]);
  const name = sammle(["32", "33"]);
  const buchungstext = teile.get("00")?.trim() ?? "";
  return {
    // Ohne Zweck bleibt wenigstens der Buchungstext („SEPA-GUTSCHRIFT") —
    // besser als eine leere Zeile in der Vorschau.
    purpose: loeseSepaKennungen(zweck) || buchungstext,
    counterparty: name || undefined,
  };
}

/**
 * Liest einen MT940-Auszug. Nicht lesbare `:61:`-Zeilen werden übersprungen,
 * nicht als Fehler geworfen — eine Datei mit einer krummen Zeile soll nicht
 * als Ganzes unbrauchbar sein.
 */
export function parseMt940(text: string): Umsatzzeile[] {
  const umsaetze: Umsatzzeile[] = [];
  let offen: Umsatzzeile | null = null;
  for (const feld of leseFelder(text)) {
    if (feld.tag === "61") {
      if (offen) umsaetze.push(offen);
      offen = leseUmsatz(feld.wert);
      continue;
    }
    if (feld.tag === "86" && offen) {
      const { purpose, counterparty } = leseVerwendungszweck(feld.wert);
      offen.purpose = purpose;
      offen.counterparty = counterparty;
      continue;
    }
    // Ein Feld, das weder :61: noch :86: ist (Schlusssaldo, Auszugsnummer,
    // nächster Auszug), schließt den offenen Umsatz ab.
    if (offen) {
      umsaetze.push(offen);
      offen = null;
    }
  }
  if (offen) umsaetze.push(offen);
  return umsaetze;
}

function leseUmsatz(wert: string): Umsatzzeile | null {
  // Valuta(6) [Buchung(4)] Soll/Haben-Kennzeichen [Währungsstelle] Betrag
  const m = wert.match(/^(\d{6})(\d{4})?(RC|RD|C|D)([A-Z])?([\d.,]+)/);
  if (!m) return null;
  const valuta = datumAusJJMMTT(m[1]);
  if (!valuta) return null;
  const betrag = parseSignedEuroToCents(m[5]);
  if (betrag === null || betrag === 0) return null;
  // RC ist die Stornierung einer Gutschrift, wirkt also wie eine Belastung;
  // RD umgekehrt. Wer nur auf C/D sieht, dreht jeden Storno ins Gegenteil.
  const negativ = m[3] === "D" || m[3] === "RC";
  const buchung = m[2] ? buchungsdatum(m[2], valuta) : null;
  return {
    bookingDate: buchung ?? valuta,
    valueDate: valuta,
    amountCents: negativ ? -Math.abs(betrag) : Math.abs(betrag),
    purpose: "",
  };
}
