// CAMT.053 (ISO 20022, XML) — der dritte Weg neben CSV und MT940.
//
// Gelesen wird gezielt, nicht vollständig: Es geht um `<Ntry>`-Blöcke und darin
// um Betrag, Richtung, Buchungstag, Verwendungszweck und die Gegenseite. Ein
// vollwertiger XML-Parser wäre eine zusätzliche Abhängigkeit für eine
// Dateistruktur, die sich seit camt.053.001.02 nicht bewegt hat.
//
// Vier Dinge, die man dabei richtig machen muss:
//
//   - **Der Betrag ist immer positiv.** Die Richtung steht in `<CdtDbtInd>`
//     (DBIT/CRDT). Wer das Vorzeichen aus dem Betrag liest, bucht jede Ausgabe
//     als Einnahme.
//   - **`<RvslInd>true</RvslInd>` dreht die Richtung um** — eine Rückbuchung.
//   - **Die Gegenseite hängt an der Richtung.** Bei einer Belastung ist es der
//     `<Cdtr>` (Empfänger), bei einer Gutschrift der `<Dbtr>` (Zahler). Immer
//     dieselbe Seite zu nehmen heißt, bei der Hälfte der Zeilen den eigenen
//     Namen einzutragen.
//   - **Sammelbuchungen.** Enthält ein Eintrag mehrere `<TxDtls>` mit eigenem
//     Betrag, sind das einzelne Zahlungen — bei einer WEG typischerweise das
//     Hausgeld mehrerer Eigentümer in einer Gutschrift. Als ein Betrag gebucht
//     wären sie keiner Einheit zuzuordnen.
//
// Namensräume kommen mit wechselnden Präfixen vor (`<Ntry>`, `<ns2:Ntry>`);
// die Muster lassen ein Präfix deshalb überall zu.
import type { Umsatzzeile } from "./mt940";

function tagMuster(name: string, global = false): RegExp {
  return new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`, global ? "g" : "");
}

/** Inhalt des ersten Vorkommens eines Elements. */
function inhalt(xml: string, name: string): string | null {
  const m = xml.match(tagMuster(name));
  return m ? m[1] : null;
}

function alle(xml: string, name: string): string[] {
  return [...xml.matchAll(tagMuster(name, true))].map((m) => m[1]);
}

/** Text eines Blattelements: Entities auflösen, Leerraum normalisieren. */
function text(xml: string | null): string {
  if (xml === null) return "";
  return xml
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** ISO-Datum (`2023-01-02`, auch als Zeitstempel) als UTC-Mitternacht. */
function isoDatum(xml: string | null): Date | null {
  const roh = text(xml);
  const m = roh.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCDate() === Number(m[3]) ? d : null;
}

/** Betrag in Cent. In CAMT immer positiv und mit Punkt als Dezimaltrenner. */
function betragCents(xml: string | null): number | null {
  const roh = text(xml).replace(/\s/g, "");
  if (!/^\d+(\.\d+)?$/.test(roh)) return null;
  return Math.round(Number.parseFloat(roh) * 100);
}

function zweck(xml: string): string {
  const rmt = inhalt(xml, "RmtInf");
  if (rmt) {
    const zeilen = alle(rmt, "Ustrd").map((u) => text(u)).filter(Boolean);
    if (zeilen.length > 0) return zeilen.join(" ");
    const strukturiert = text(inhalt(rmt, "Ref"));
    if (strukturiert) return strukturiert;
  }
  return "";
}

function gegenseite(xml: string, belastung: boolean): string | undefined {
  const parteien = inhalt(xml, "RltdPties") ?? xml;
  const seite = inhalt(parteien, belastung ? "Cdtr" : "Dbtr");
  const name = text(seite ? inhalt(seite, "Nm") : null);
  return name || undefined;
}

/**
 * Liest einen CAMT.053-Auszug. Einträge ohne Betrag oder Datum werden
 * übersprungen, nicht als Fehler geworfen.
 */
export function parseCamt053(xml: string): Umsatzzeile[] {
  const umsaetze: Umsatzzeile[] = [];
  for (const eintrag of alle(xml, "Ntry")) {
    const bookingDate = isoDatum(inhalt(eintrag, "BookgDt")) ?? isoDatum(inhalt(eintrag, "ValDt"));
    if (!bookingDate) continue;
    const valueDate = isoDatum(inhalt(eintrag, "ValDt")) ?? undefined;
    const richtung = text(inhalt(eintrag, "CdtDbtInd")).toUpperCase();
    const storno = /true|1/i.test(text(inhalt(eintrag, "RvslInd")));
    // Storno dreht die Richtung: Eine stornierte Gutschrift nimmt Geld weg.
    const belastung = (richtung === "DBIT") !== storno;
    const vorzeichen = belastung ? -1 : 1;

    const details = alle(inhalt(eintrag, "NtryDtls") ?? "", "TxDtls");
    // Sammelbuchung: mehrere Einzelzahlungen mit eigenem Betrag.
    const einzeln = details.filter((d) => betragCents(inhalt(d, "Amt")) !== null);
    if (einzeln.length > 1) {
      for (const d of einzeln) {
        const cents = betragCents(inhalt(d, "Amt"));
        if (cents === null || cents === 0) continue;
        umsaetze.push({
          bookingDate,
          valueDate,
          amountCents: vorzeichen * cents,
          purpose: zweck(d) || text(inhalt(eintrag, "AddtlNtryInf")),
          counterparty: gegenseite(d, belastung),
        });
      }
      continue;
    }

    const cents = betragCents(inhalt(eintrag, "Amt"));
    if (cents === null || cents === 0) continue;
    const detail = details[0] ?? "";
    umsaetze.push({
      bookingDate,
      valueDate,
      amountCents: vorzeichen * cents,
      purpose: zweck(detail) || text(inhalt(eintrag, "AddtlNtryInf")),
      counterparty: gegenseite(detail, belastung),
    });
  }
  return umsaetze;
}
