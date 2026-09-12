// Belegerkennung **ohne** Drittdienst — der Weg, der immer geht.
//
// Die KI-Erkennung (`beleg-erkennung.ts`) schickt die Rechnung an Google.
// Das braucht einen Schlüssel, einen Auftragsverarbeiter und die Bereitschaft,
// Handwerkernamen und IBANs außer Haus zu geben. Für die meisten Rechnungen
// ist das unnötig, denn sie tragen ihre Daten lesbar in sich:
//
// 1. **E-Rechnung.** Seit 2025 müssen Unternehmen E-Rechnungen empfangen
//    können; ZUGFeRD-PDFs tragen ein XML nach EN 16931 (CII), XRechnungen
//    kommen als CII oder UBL. Rechnungssteller, Nummer, Datum, Fälligkeit und
//    Bruttobetrag stehen dort exakt — das ist Auslesen, nicht Raten.
// 2. **Text-PDF.** Rechnungen aus Handwerker- oder Buchhaltungssoftware sind
//    Text, keine Scans. Betrag, Nummer und Daten stehen hinter festen Wörtern
//    („Gesamtbetrag", „Rechnungs-Nr.", „zahlbar bis"), die sich mit Regeln
//    finden lassen.
//
// Was hier NICHT geht: Scans und Handyfotos. Dafür bräuchte es Texterkennung,
// und die ist ohne externen Dienst auf dem Server nicht belastbar. Solche
// Belege bleiben Handarbeit — oder gehen, wenn die Verwaltung das ausdrücklich
// freigibt, an die KI.
//
// Alles hier läuft im Prozess. Kein Byte verlässt den Server.
import type { ErkannteRechnung } from "./beleg-erkennung";
import { bruttoCents, isoTag } from "./beleg-erkennung";

export type LokaleErkennung = {
  daten: ErkannteRechnung;
  /** Woher die Werte stammen — die Oberfläche sagt es dazu. */
  quelle: "e-rechnung" | "text";
};

export const LOKALE_MIME_TYPES = [
  "application/pdf",
  "application/xml",
  "text/xml",
] as const;

// ── E-Rechnung (CII / UBL) ──────────────────────────────────────────────────
// Ohne XML-Bibliothek, wie beim CAMT-Import (DECISIONS 318): gelesen werden
// gezielt die wenigen Elemente, die die Verbindlichkeit braucht, mit beliebigem
// Namensraum-Präfix. Ein vollständiger EN-16931-Parser wäre für fünf Felder
// eine Abhängigkeit zu viel.

function element(xml: string, name: string, ab = 0): { wert: string; ende: number } | null {
  const re = new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i");
  re.lastIndex = 0;
  const rest = xml.slice(ab);
  const m = rest.match(re);
  if (!m || m.index === undefined) return null;
  return { wert: m[1], ende: ab + m.index + m[0].length };
}

/** Erstes Vorkommen eines Elements innerhalb eines Elternelements. */
function innerhalb(xml: string, eltern: string, kind: string): string | undefined {
  const e = element(xml, eltern);
  if (!e) return undefined;
  const k = element(e.wert, kind);
  return k ? entschaerfe(k.wert) : undefined;
}

function entschaerfe(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** CII schreibt Daten als `20260314` (Format 102); UBL als ISO. */
function eRechnungsDatum(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  const m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return isoTag(`${m[1]}-${m[2]}-${m[3]}`);
  return isoTag(t);
}

export function leseERechnung(xml: string): ErkannteRechnung | null {
  const cii = /CrossIndustryInvoice/i.test(xml);
  const ubl = /<(?:[\w-]+:)?Invoice[\s>]/i.test(xml) && /urn:oasis:names:specification:ubl/i.test(xml);
  if (!cii && !ubl) return null;

  let r: ErkannteRechnung;
  if (cii) {
    const kopf = element(xml, "ExchangedDocument")?.wert ?? "";
    const nummer = element(kopf, "ID")?.wert;
    const datum = innerhalb(kopf, "IssueDateTime", "DateTimeString");
    const verkaeufer = element(xml, "SellerTradeParty")?.wert ?? "";
    const name = element(verkaeufer, "Name")?.wert;
    const summen = element(xml, "SpecifiedTradeSettlementHeaderMonetarySummation")?.wert ?? "";
    // Zu zahlen ist der Betrag nach Anzahlungen; fehlt er, der Bruttobetrag.
    const betrag = element(summen, "DuePayableAmount")?.wert ?? element(summen, "GrandTotalAmount")?.wert;
    const zahlung = element(xml, "SpecifiedTradePaymentTerms")?.wert ?? "";
    const faellig = innerhalb(zahlung, "DueDateDateTime", "DateTimeString");
    const leistung = element(xml, "IncludedNote")?.wert;
    r = {
      creditor: name ? entschaerfe(name).slice(0, 160) : undefined,
      invoiceNumber: nummer ? entschaerfe(nummer).slice(0, 60) : undefined,
      invoiceDate: eRechnungsDatum(datum),
      dueDate: eRechnungsDatum(faellig),
      grossCents: bruttoCents(betrag ? entschaerfe(betrag) : undefined),
      description: leistung ? innerhalb(leistung, "IncludedNote", "Content") ?? entschaerfe(element(leistung, "Content")?.wert ?? "") : undefined,
    };
    if (r.description) r.description = r.description.slice(0, 120) || undefined;
  } else {
    const nummer = element(xml, "ID")?.wert;
    const datum = element(xml, "IssueDate")?.wert;
    const faellig = element(xml, "DueDate")?.wert;
    const lieferant = element(xml, "AccountingSupplierParty")?.wert ?? "";
    const name =
      innerhalb(lieferant, "PartyLegalEntity", "RegistrationName") ??
      innerhalb(lieferant, "PartyName", "Name");
    const summen = element(xml, "LegalMonetaryTotal")?.wert ?? "";
    const betrag = element(summen, "PayableAmount")?.wert ?? element(summen, "TaxInclusiveAmount")?.wert;
    const notiz = element(xml, "Note")?.wert;
    r = {
      creditor: name ? name.slice(0, 160) : undefined,
      invoiceNumber: nummer ? entschaerfe(nummer).slice(0, 60) : undefined,
      invoiceDate: eRechnungsDatum(datum ? entschaerfe(datum) : undefined),
      dueDate: eRechnungsDatum(faellig ? entschaerfe(faellig) : undefined),
      grossCents: bruttoCents(betrag ? entschaerfe(betrag) : undefined),
      description: notiz ? entschaerfe(notiz).slice(0, 120) || undefined : undefined,
    };
  }
  return Object.values(r).some((v) => v !== undefined) ? r : null;
}

// ── Text-PDF ────────────────────────────────────────────────────────────────

const DATUM = /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})|(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\.\s?(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s(\d{4})/g;
const MONATE: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7,
  august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

function datenIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(DATUM)) {
    let iso: string | undefined;
    if (m[1]) iso = isoTag(`${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[3]}`);
    else if (m[4]) iso = isoTag(`${m[4]}-${m[5]}-${m[6]}`);
    else if (m[7]) {
      const monat = MONATE[m[8].toLowerCase()];
      if (monat) iso = isoTag(`${m[7].padStart(2, "0")}.${String(monat).padStart(2, "0")}.${m[9]}`);
    }
    if (iso) out.push(iso);
  }
  return out;
}

const BETRAG = /(?<![\d.,])(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2})(?!\d)/g;

function betraegeIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(BETRAG)) {
    const c = bruttoCents(m[1]);
    if (c != null) out.push(c);
  }
  return out;
}

// Reihenfolge = Vorrang. „Gesamtbetrag" schlägt „Brutto" (das steht auch in
// Zwischensummen), und alles schlägt „Netto" — das darf nie treffen.
const BETRAG_WOERTER = [
  /zu zahlen|zahlbetrag|zahlungsbetrag|rechnungsbetrag|endbetrag/i,
  /gesamtbetrag|gesamtsumme|gesamt\s*brutto|summe\s*brutto|bruttobetrag|bruttosumme/i,
  /\bbrutto\b|\bgesamt\b|\btotal\b/i,
];

const FIRMA = /\b(GmbH|AG|KG|OHG|UG|GbR|mbH|e\.\s?K\.|e\.\s?V\.|Inh\.|& Co|SE|Meisterbetrieb|Stadtwerke|Versorgung)\b/;

/**
 * Liest die Felder aus dem Text einer Rechnung. `zeilen` sind die Zeilen in
 * Leserichtung; die Reihenfolge trägt: Der Rechnungssteller steht oben, der
 * Endbetrag unten.
 */
export function leseRechnungAusText(zeilen: string[]): ErkannteRechnung | null {
  const text = zeilen.join("\n");
  const r: ErkannteRechnung = {};

  // Belegnummer: „Rechnungs-Nr.: 2026-114", „Rechnungsnummer 4711", „Rechnung Nr.
  // 12/26" — und, wenn es keine Rechnung ist, die Angebots- oder Auftragsnummer:
  // Ein Angebot wird auch als Verbindlichkeit vorgemerkt, wenn es angenommen
  // ist, und seine Nummer ist dann das, worauf die Rechnung später verweist.
  const nr = text.match(
    /(?:(?:rechnungs?|angebots?|auftrags?|beleg)\s?-?\s?(?:nr|nummer|no)\.?|invoice\s?(?:no|number)\.?|(?:rechnung|angebot|auftrag)\s+nr\.?)\s*:?\s*([A-Z0-9][A-Z0-9\-/_.]{1,39})/i,
  );
  if (nr) r.invoiceNumber = nr[1].replace(/[.,:;]+$/, "");
  // Belegart aus der Überschrift bzw. dem Nummernwort: Ein Angebot heißt in
  // der Vorbelegung „Angebot", nicht „Rechnung" — sonst wundert sich, wer es
  // später sucht.
  const kopfText = zeilen.slice(0, 12).join("\n");
  const nummernWort = nr?.[0].toLowerCase() ?? "";
  if (/^angebot\b/im.test(kopfText) || nummernWort.startsWith("angebot")) r.belegart = "Angebot";
  else if (/^auftrag(sbest[äa]tigung)?\b/im.test(kopfText) || nummernWort.startsWith("auftrag")) r.belegart = "Auftrag";
  else if (/^rechnung\b/im.test(kopfText) || nummernWort.startsWith("rechnung")) r.belegart = "Rechnung";

  // Rechnungsdatum: hinter dem Wort, sonst das erste Datum des Belegs.
  const datumZeile = zeilen.find((z) => /rechnungsdatum|belegdatum|\bdatum\b/i.test(z) && datenIn(z).length > 0);
  const alleDaten = datenIn(text);
  r.invoiceDate = datumZeile ? datenIn(datumZeile)[0] : alleDaten[0];

  // Fälligkeit: ausdrückliches Datum oder „innerhalb von 14 Tagen".
  const faelligZeile = zeilen.find(
    (z) => /f[äa]llig|zahlbar\s+bis|zahlungsziel|bis\s+zum|bis\s+sp[äa]testens/i.test(z) && datenIn(z).length > 0,
  );
  if (faelligZeile) {
    const d = datenIn(faelligZeile);
    // In „Zahlbar bis 28.03.2026 (Rechnungsdatum 14.03.2026)" ist das Ziel das
    // spätere Datum.
    r.dueDate = d.sort().at(-1);
  } else if (r.invoiceDate) {
    const tage = text.match(/(?:innerhalb|binnen)\s+(?:von\s+)?(\d{1,3})\s+tagen|zahlungsziel\s*:?\s*(\d{1,3})\s+tage/i);
    const n = tage ? Number(tage[1] ?? tage[2]) : NaN;
    if (Number.isFinite(n) && n > 0 && n <= 120) {
      const [j, m, t] = r.invoiceDate.split("-").map(Number);
      const d = new Date(Date.UTC(j, m - 1, t + n));
      r.dueDate = d.toISOString().slice(0, 10);
    }
  }
  if (r.dueDate && r.invoiceDate && r.dueDate < r.invoiceDate) r.dueDate = undefined;

  // Betrag: die Zeile mit dem stärksten Schlüsselwort, darin der letzte Betrag;
  // steht der Betrag in der Folgezeile, gilt die.
  for (const wort of BETRAG_WOERTER) {
    let gefunden: number | undefined;
    for (let i = zeilen.length - 1; i >= 0; i--) {
      const z = zeilen[i];
      if (!wort.test(z) || /netto|zwischensumme|mwst|ust\b|umsatzsteuer|steuer/i.test(z.replace(/brutto/gi, ""))) continue;
      const hier = betraegeIn(z);
      const dort = hier.length === 0 && zeilen[i + 1] ? betraegeIn(zeilen[i + 1]) : [];
      const kandidat = hier.at(-1) ?? dort.at(-1);
      if (kandidat != null) {
        gefunden = kandidat;
        break;
      }
    }
    if (gefunden != null) {
      r.grossCents = gefunden;
      break;
    }
  }

  // Rechnungssteller: die erste Zeile im oberen Teil, die nach Firma aussieht
  // und nicht die Gemeinschaft selbst ist (die steht als Empfänger ebenfalls oben).
  const kopf = zeilen.slice(0, 15);
  const firma = kopf.find(
    (z) => FIRMA.test(z) && !/wohnungseigent|eigent[üu]mergemeinschaft|\bWEG\b|hausverwaltung|c\/o/i.test(z),
  );
  if (firma) r.creditor = firma.replace(/\s{2,}.*$/, "").trim().slice(0, 160);

  // Leistung: „Betreff: …", „Bauvorhaben: …", „Leistung: …" — sonst die erste
  // Position der Tabelle, ohne Positionsnummer, Menge und Preise.
  const betreff = text.match(/(?:betreff|leistung|bauvorhaben|projekt|leistungszeitraum|objekt)\s*:\s*([^\n]{3,120})/i);
  if (betreff) r.description = betreff[1].trim();
  else {
    const kopfzeile = zeilen.findIndex((z) => /^pos\.?\s+(bezeichnung|beschreibung|leistung|artikel)/i.test(z));
    const erste = kopfzeile >= 0 ? zeilen[kopfzeile + 1] : undefined;
    const m = erste?.match(/^\d{1,3}\s+(.+?)(?:\s+\d+(?:[.,]\d+)?\s+\S+)?(?:\s+[\d.,]+\s?€?){1,2}$/);
    const leistung = m?.[1].replace(/\s?-$/, "").trim();
    if (leistung && leistung.length >= 3) r.description = leistung.slice(0, 120);
  }

  return Object.values(r).some((v) => v !== undefined) ? r : null;
}

// ── PDF lesen ───────────────────────────────────────────────────────────────

/** Namen, unter denen ZUGFeRD/Factur-X und XRechnung ihr XML an ein PDF hängen. */
const E_RECHNUNG_DATEIEN = /^(factur-x|zugferd-invoice|xrechnung|ZUGFeRD-invoice)\.xml$/i;

export async function pdfInhalt(
  bytes: Uint8Array,
): Promise<{ zeilen: string[]; xml: string | null }> {
  // Dynamisch geladen: pdf.js ist groß und wird nur hier auf dem Server
  // gebraucht; `serverExternalPackages` in next.config.ts lässt es aus
  // node_modules laden statt es zu bündeln.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useWorkerFetch: false,
    // Kein Warnrauschen im Serverprotokoll: Ohne Standardschriften meldet
    // pdf.js jede Helvetica — für die Textebene ist das ohne Belang.
    verbosity: 0,
  });
  try {
    const dokument = await task.promise;

    let xml: string | null = null;
    const anhaenge = await dokument.getAttachments();
    if (anhaenge) {
      const dateien = [...anhaenge.entries()];
      const treffer =
        dateien.find(([, a]) => E_RECHNUNG_DATEIEN.test(a.filename)) ??
        dateien.find(([, a]) => /\.xml$/i.test(a.filename));
      if (treffer) {
        // Der Inhalt kommt nicht mit der Liste, sondern auf Abruf.
        const inhalt = treffer[1].content ?? (await dokument.getAttachmentContent(treffer[0]));
        if (inhalt) xml = new TextDecoder("utf-8").decode(inhalt);
      }
    }

    const zeilen: string[] = [];
    for (let n = 1; n <= Math.min(dokument.numPages, 5); n++) {
      const seite = await dokument.getPage(n);
      const inhalt = await seite.getTextContent();
      // Textstücke zu Zeilen: gleiche Grundlinie (auf 2 pt gerundet) = eine
      // Zeile, darin von links nach rechts.
      const stuecke: { y: number; x: number; text: string }[] = [];
      for (const item of inhalt.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        stuecke.push({ y: Math.round(item.transform[5] / 2) * 2, x: item.transform[4], text: item.str });
      }
      stuecke.sort((a, b) => b.y - a.y || a.x - b.x);
      let aktuellY: number | null = null;
      let zeile: string[] = [];
      for (const s of stuecke) {
        if (aktuellY !== null && s.y !== aktuellY) {
          zeilen.push(zeile.join(" ").replace(/\s+/g, " ").trim());
          zeile = [];
        }
        aktuellY = s.y;
        zeile.push(s.text);
      }
      if (zeile.length) zeilen.push(zeile.join(" ").replace(/\s+/g, " ").trim());
    }
    return { zeilen: zeilen.filter(Boolean), xml };
  } finally {
    await task.destroy();
  }
}

/**
 * Der lokale Weg: erst E-Rechnung, dann Text. Null heißt „nichts Lesbares" —
 * bei einem Scan ohne Textebene oder einem Foto.
 */
export async function erkenneBelegLokal(
  datei: Uint8Array,
  mimeType: string,
): Promise<LokaleErkennung | null> {
  try {
    if (mimeType === "application/xml" || mimeType === "text/xml") {
      const daten = leseERechnung(new TextDecoder("utf-8").decode(datei));
      return daten ? { daten, quelle: "e-rechnung" } : null;
    }
    if (mimeType !== "application/pdf") return null;
    const { zeilen, xml } = await pdfInhalt(datei);
    if (xml) {
      const daten = leseERechnung(xml);
      if (daten) return { daten, quelle: "e-rechnung" };
    }
    // Ein Scan hat keine oder nur Bruchstücke von Textebene — dann lieber
    // nichts als eine Zahl aus dem Rauschen.
    if (zeilen.join(" ").length < 40) return null;
    const daten = leseRechnungAusText(zeilen);
    return daten ? { daten, quelle: "text" } : null;
  } catch {
    return null;
  }
}
