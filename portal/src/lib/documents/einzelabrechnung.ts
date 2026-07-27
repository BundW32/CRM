// PDF-Generator für die Einzelabrechnung je Einheit (§ 28 Abs. 2 WEG).
// Eine A4-Seite je Einheit: Kostenanteile nach Umlageschlüsseln, Abrechnungs-
// spitze (Nachschuss/Guthaben), §35a-Ausweis, tagesgenaue Eigentümerangabe.
// Aufbau analog zu meeting-protocol.ts / bescheinigungen.ts (pdf-lib, A4).
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { formatCents } from "@/lib/money";
import { encodeWinAnsi, wrapText } from "./pdf-text";

const A4: [number, number] = [595.28, 841.89];
const ML = 50;
const CW = A4[0] - ML - 50;
const GREEN = rgb(0, 0.21, 0.19);
const GRAY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0.1, 0.1, 0.1);
const LIGHT = rgb(0.96, 0.96, 0.96);
const RED = rgb(0.6, 0.09, 0.09);
const GREENPOS = rgb(0.05, 0.42, 0.28);

// Spalten der Kostentabelle
const COL_POS = ML;
const COL_KEY = ML + 210;
const COL_TOTAL = ML + 330;
const COL_SHARE = ML + CW; // rechtsbündig

export type EinzelabrechnungOwner = { name: string; days: number; cents: number };
export type EinzelabrechnungCostRow = {
  name: string;
  keyLabel: string;
  totalCents: number;
  shareCents: number;
};
export type EinzelabrechnungUnit = {
  label: string;
  owners: EinzelabrechnungOwner[];
  uncoveredCents: number;
  costRows: EinzelabrechnungCostRow[];
  kostenanteilCents: number;
  sollCents: number;
  peakCents: number; // + Nachschuss, − Guthaben
  laborHaushaltsnahCents: number;
  laborHandwerkerCents: number;
};
export type EinzelabrechnungInput = {
  propertyName: string;
  issuer: { legalName: string; contactLine: string };
  year: number;
  periodLabel: string; // "01.01.2026 – 31.12.2026"
  finalizedAt: Date | null; // null = Entwurf
  units: EinzelabrechnungUnit[];
  generatedAt: Date;
};

function euro(cents: number): string {
  return encodeWinAnsi(formatCents(cents));
}
function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
// Rechtsbündig zeichnen
function drawRight(page: PDFPage, text: string, xRight: number, y: number, size: number, font: PDFFont, color = BLACK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - w, y, size, font, color });
}

export async function generateEinzelabrechnungen(rawInput: EinzelabrechnungInput): Promise<Buffer> {
  const input: EinzelabrechnungInput = {
    ...rawInput,
    propertyName: encodeWinAnsi(rawInput.propertyName),
    issuer: {
      legalName: encodeWinAnsi(rawInput.issuer.legalName),
      contactLine: encodeWinAnsi(rawInput.issuer.contactLine),
    },
    periodLabel: encodeWinAnsi(rawInput.periodLabel),
    units: rawInput.units.map((u) => ({
      ...u,
      label: encodeWinAnsi(u.label),
      owners: u.owners.map((o) => ({ ...o, name: encodeWinAnsi(o.name) })),
      costRows: u.costRows.map((r) => ({ ...r, name: encodeWinAnsi(r.name), keyLabel: encodeWinAnsi(r.keyLabel) })),
    })),
  };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const unit of input.units) {
    let page: PDFPage = pdf.addPage(A4);
    let y = A4[1] - 50;
    const ensure = (needed: number) => {
      if (y - needed < 70) {
        page = pdf.addPage(A4);
        y = A4[1] - 50;
      }
    };

    // ── Briefkopf ────────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GREEN });
    page.drawText(input.issuer.legalName, { x: ML, y, size: 10, font: bold, color: GREEN });
    y -= 12;
    if (input.issuer.contactLine) {
      page.drawText(input.issuer.contactLine, { x: ML, y, size: 8, font, color: GRAY });
      y -= 16;
    } else y -= 6;

    page.drawText(`Einzelabrechnung ${input.year}`, { x: ML, y, size: 15, font: bold, color: BLACK });
    if (!input.finalizedAt) {
      drawRight(page, "ENTWURF", ML + CW, y + 1, 11, bold, RED);
    }
    y -= 18;
    for (const l of wrapText(`${input.propertyName} · Einheit ${unit.label}`, font, 10, CW)) {
      page.drawText(l, { x: ML, y, size: 10, font, color: GRAY });
      y -= 13;
    }
    page.drawText(`Wirtschaftsjahr: ${input.periodLabel}`, { x: ML, y, size: 9, font, color: GRAY });
    y -= 12;

    // Eigentümer (tagesgenau)
    const ownerText =
      unit.owners.length > 0
        ? unit.owners.map((o) => `${o.name} (${o.days} Tage)`).join(", ")
        : "kein Eigentümer erfasst";
    for (const l of wrapText(`Eigentümer: ${ownerText}`, font, 9, CW)) {
      page.drawText(l, { x: ML, y, size: 9, font, color: GRAY });
      y -= 12;
    }
    y -= 4;
    page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.5, color: GRAY });
    y -= 16;

    // ── Kostentabelle ────────────────────────────────────────────────────────
    page.drawText("Position", { x: COL_POS, y, size: 8, font: bold, color: GRAY });
    page.drawText("Schlüssel", { x: COL_KEY, y, size: 8, font: bold, color: GRAY });
    drawRight(page, "Gesamt", COL_TOTAL + 60, y, 8, bold, GRAY);
    drawRight(page, "Ihr Anteil", COL_SHARE, y, 8, bold, GRAY);
    y -= 12;
    page.drawLine({ start: { x: ML, y: y + 4 }, end: { x: ML + CW, y: y + 4 }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });

    for (const row of unit.costRows) {
      const nameLines = wrapText(row.name, font, 9, COL_KEY - COL_POS - 6);
      ensure(nameLines.length * 12 + 6);
      nameLines.forEach((l, i) => {
        page.drawText(l, { x: COL_POS, y: y - i * 11, size: 9, font, color: BLACK });
      });
      page.drawText(row.keyLabel, { x: COL_KEY, y, size: 8, font, color: GRAY });
      drawRight(page, euro(row.totalCents), COL_TOTAL + 60, y, 9, font, GRAY);
      drawRight(page, euro(row.shareCents), COL_SHARE, y, 9, font, BLACK);
      y -= Math.max(nameLines.length * 11, 11) + 5;
    }

    // ── Zusammenfassung ──────────────────────────────────────────────────────
    ensure(120);
    y -= 4;
    page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.5, color: GRAY });
    y -= 16;
    const sumRow = (label: string, value: string, opts: { bold?: boolean; color?: typeof BLACK; size?: number } = {}) => {
      const size = opts.size ?? 10;
      page.drawText(label, { x: COL_POS, y, size, font: opts.bold ? bold : font, color: opts.color ?? BLACK });
      drawRight(page, value, COL_SHARE, y, size, opts.bold ? bold : font, opts.color ?? BLACK);
      y -= size + 6;
    };
    sumRow("Ihr Kostenanteil (Ist)", euro(unit.kostenanteilCents), { bold: true });
    sumRow("Ihre Soll-Vorschüsse (Hausgeld)", euro(unit.sollCents));

    // Abrechnungsspitze — hervorgehoben
    y -= 4;
    const spitzeLabel = unit.peakCents > 0 ? "Nachschuss (§ 28 Abs. 2 WEG)" : unit.peakCents < 0 ? "Guthaben" : "Ausgeglichen";
    const spitzeColor = unit.peakCents > 0 ? RED : unit.peakCents < 0 ? GREENPOS : BLACK;
    page.drawRectangle({ x: ML, y: y - 6, width: CW, height: 26, color: LIGHT });
    page.drawText(spitzeLabel, { x: COL_POS + 6, y: y + 3, size: 11, font: bold, color: spitzeColor });
    drawRight(page, euro(Math.abs(unit.peakCents)), COL_SHARE - 6, y + 3, 12, bold, spitzeColor);
    y -= 34;

    // ── §35a ─────────────────────────────────────────────────────────────────
    if (unit.laborHaushaltsnahCents > 0 || unit.laborHandwerkerCents > 0) {
      ensure(70);
      page.drawText("Steuerlich begünstigte Aufwendungen (§ 35a EStG)", { x: COL_POS, y, size: 9, font: bold, color: BLACK });
      y -= 14;
      sumRow("  Haushaltsnahe Dienstleistungen", euro(unit.laborHaushaltsnahCents), { size: 9 });
      sumRow("  Handwerkerleistungen", euro(unit.laborHandwerkerCents), { size: 9 });
      for (const l of wrapText(
        "Maßgeblich ist der in den Rechnungen ausgewiesene Lohn-/Fahrtkostenanteil. Muster — ersetzt keine Steuerberatung.",
        font,
        7.5,
        CW,
      )) {
        page.drawText(l, { x: COL_POS, y, size: 7.5, font, color: GRAY });
        y -= 10;
      }
    }
    if (unit.uncoveredCents > 0) {
      ensure(20);
      y -= 4;
      page.drawText(
        `Hinweis: ${euro(unit.uncoveredCents)} des Kostenanteils sind keinem erfassten Eigentümer zugeordnet.`,
        { x: COL_POS, y, size: 8, font, color: RED },
      );
      y -= 12;
    }

    // ── Fuß ──────────────────────────────────────────────────────────────────
    ensure(30);
    y -= 6;
    page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
    y -= 12;
    // „Fertiggestellt" heißt: der Verwalter hat die Abrechnung geprüft und das
    // Ergebnis eingefroren — sie ist damit **versandfertige Beschlussvorlage**.
    // Beschlossen wird die Abrechnungsspitze erst von der Eigentümerversammlung
    // (§ 28 Abs. 2 Satz 1 WEG); erst damit wird ein Nachschuss fällig. Das
    // Dokument hat das vorher „Beschlossene Abrechnung" genannt — eine Aussage,
    // die zu diesem Zeitpunkt nicht stimmt und zu einer Zahlung auf eine noch
    // nicht beschlossene Forderung verleiten kann.
    const footNote = input.finalizedAt
      ? `Erstellt am ${fmtDate(input.generatedAt)}, geprüft und abgeschlossen. Über die Abrechnungsspitze beschließt die Eigentümerversammlung (§ 28 Abs. 2 WEG) — erst mit diesem Beschluss wird ein Nachschuss fällig. Muster — ersetzt keine Rechtsberatung.`
      : `ENTWURF, erstellt am ${fmtDate(input.generatedAt)} — noch in Bearbeitung. Muster — ersetzt keine Rechtsberatung.`;
    for (const l of wrapText(footNote, font, 7.5, CW)) {
      page.drawText(l, { x: COL_POS, y, size: 7.5, font, color: GRAY });
      y -= 10;
    }
  }

  return Buffer.from(await pdf.save());
}
