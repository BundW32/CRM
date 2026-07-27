// PDF-Generator für den **Einzelwirtschaftsplan** (§ 28 Abs. 1 WEG): je Einheit
// eine Seite mit der Aufschlüsselung des Jahresvorschusses nach Kostenposition,
// dem Verteilerschlüssel, dem eigenen Anteil und der Monatsrate.
//
// Abgrenzung zu `wirtschaftsplan.ts`: Das dortige Dokument ist der **Gesamt**plan
// samt Übersichtstabelle aller Einheiten — jeder Eigentümer sah dort eine Summe,
// nicht ihre Zusammensetzung, und nebenbei das Hausgeld aller anderen. Das Gesetz
// verlangt beides: Gesamtplan *und* Einzelwirtschaftspläne.
//
// Aufbau analog zu einzelabrechnung.ts (pdf-lib, A4).
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { formatCents } from "@/lib/money";
import { encodeWinAnsi, wrapText } from "./pdf-text";

const A4: [number, number] = [595.28, 841.89];
const ML = 50;
const CW = A4[0] - ML - 50;
const COL_SHARE = A4[0] - 50; // rechte Kante der Betragsspalte
const COL_KEY = 330; // Spalte Umlageschlüssel
const GREEN = rgb(0, 0.21, 0.19);
const GRAY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0.1, 0.1, 0.1);
const LIGHT = rgb(0.96, 0.96, 0.96);

export type EinzelplanPosition = {
  name: string;
  keyLabel: string;
  /** Gesamtbetrag der Position im Objekt. */
  totalCents: number;
  /** Anteil dieser Einheit — bei Einnahmen negativ. */
  shareCents: number;
};

export type EinzelplanUnit = {
  label: string;
  /** Aktuelle Eigentümer der Einheit, für die Anschrift. */
  ownerNames: string[];
  positions: EinzelplanPosition[];
  /** Jahresvorschuss = Σ Anteile (Ausgaben − Einnahmen). */
  annualCents: number;
  monthlyCents: number[];
};

export type EinzelwirtschaftsplanInput = {
  propertyName: string;
  issuer: { legalName: string; contactLine: string };
  year: number;
  resolved: { date: Date; note: string | null } | null; // null = Entwurf
  units: EinzelplanUnit[];
  generatedAt: Date;
};

function euro(cents: number): string {
  return encodeWinAnsi(formatCents(cents));
}
function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function drawRight(
  page: PDFPage,
  text: string,
  xRight: number,
  y: number,
  size: number,
  font: PDFFont,
  color = BLACK,
) {
  page.drawText(text, { x: xRight - font.widthOfTextAtSize(text, size), y, size, font, color });
}

export async function generateEinzelwirtschaftsplaene(
  rawInput: EinzelwirtschaftsplanInput,
): Promise<Buffer> {
  const input: EinzelwirtschaftsplanInput = {
    ...rawInput,
    propertyName: encodeWinAnsi(rawInput.propertyName),
    issuer: {
      legalName: encodeWinAnsi(rawInput.issuer.legalName),
      contactLine: encodeWinAnsi(rawInput.issuer.contactLine),
    },
    units: rawInput.units.map((u) => ({
      ...u,
      label: encodeWinAnsi(u.label),
      ownerNames: u.ownerNames.map((n) => encodeWinAnsi(n)),
      positions: u.positions.map((p) => ({
        ...p,
        name: encodeWinAnsi(p.name),
        keyLabel: encodeWinAnsi(p.keyLabel),
      })),
    })),
    resolved: rawInput.resolved
      ? {
          ...rawInput.resolved,
          note: rawInput.resolved.note == null ? null : encodeWinAnsi(rawInput.resolved.note),
        }
      : null,
  };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const unit of input.units) {
    let page = pdf.addPage(A4);
    let y = A4[1] - 55;

    const ensure = (needed: number) => {
      if (y - needed < 60) {
        page = pdf.addPage(A4);
        y = A4[1] - 55;
      }
    };

    // ── Kopf ────────────────────────────────────────────────────────────────
    page.drawText(input.issuer.legalName, { x: ML, y, size: 11, font: bold, color: GREEN });
    y -= 13;
    if (input.issuer.contactLine) {
      page.drawText(input.issuer.contactLine, { x: ML, y, size: 8, font, color: GRAY });
      y -= 20;
    } else {
      y -= 7;
    }

    page.drawText(`Einzelwirtschaftsplan ${input.year}`, {
      x: ML,
      y,
      size: 16,
      font: bold,
      color: BLACK,
    });
    y -= 18;
    page.drawText(`${input.propertyName} · ${unit.label}`, { x: ML, y, size: 10, font, color: GRAY });
    y -= 12;
    if (unit.ownerNames.length > 0) {
      page.drawText(unit.ownerNames.join(", "), { x: ML, y, size: 9, font, color: GRAY });
      y -= 12;
    }
    page.drawText(
      input.resolved
        ? `Beschlossen am ${fmtDate(input.resolved.date)}${input.resolved.note ? ` (${input.resolved.note})` : ""}`
        : "ENTWURF — noch nicht beschlossen",
      { x: ML, y, size: 9, font: bold, color: input.resolved ? GRAY : rgb(0.72, 0.11, 0.11) },
    );
    y -= 22;

    // ── Aufschlüsselung ─────────────────────────────────────────────────────
    page.drawRectangle({ x: ML - 6, y: y - 4, width: CW + 12, height: 18, color: LIGHT });
    page.drawText("Kostenposition", { x: ML, y, size: 8.5, font: bold, color: GRAY });
    page.drawText("Umlageschlüssel", { x: COL_KEY, y, size: 8.5, font: bold, color: GRAY });
    drawRight(page, "Ihr Anteil", COL_SHARE, y, 8.5, bold, GRAY);
    y -= 20;

    for (const p of unit.positions) {
      ensure(16);
      // Position ohne Anteil (z. B. Stellplatz bei Verteilung nach Fläche)
      // trotzdem zeigen: „steht nicht drin" beantwortet die Frage, warum.
      for (const line of wrapText(p.name, font, 9, COL_KEY - ML - 10)) {
        page.drawText(line, { x: ML, y, size: 9, font, color: BLACK });
        y -= 11;
      }
      y += 11; // letzte Zeile hält die Höhe
      page.drawText(p.keyLabel, { x: COL_KEY, y, size: 8.5, font, color: GRAY });
      drawRight(page, euro(p.shareCents), COL_SHARE, y, 9, font, BLACK);
      y -= 14;
    }

    // ── Summe und Monatsrate ────────────────────────────────────────────────
    ensure(60);
    y -= 4;
    page.drawLine({
      start: { x: ML, y: y + 8 },
      end: { x: COL_SHARE, y: y + 8 },
      thickness: 0.7,
      color: GRAY,
    });
    y -= 8;
    page.drawText("Jahresvorschuss", { x: ML, y, size: 10, font: bold, color: BLACK });
    drawRight(page, euro(unit.annualCents), COL_SHARE, y, 11, bold, BLACK);
    y -= 22;

    const min = Math.min(...unit.monthlyCents);
    const max = Math.max(...unit.monthlyCents);
    page.drawRectangle({ x: ML - 6, y: y - 8, width: CW + 12, height: 30, color: LIGHT });
    page.drawText("Monatliches Hausgeld", { x: ML, y, size: 10, font: bold, color: GREEN });
    drawRight(
      page,
      min === max ? euro(max) : `${euro(min)} – ${euro(max)}`,
      COL_SHARE,
      y,
      12,
      bold,
      GREEN,
    );
    y -= 30;

    // ── Fuß ─────────────────────────────────────────────────────────────────
    ensure(50);
    for (const line of wrapText(
      "Der Jahresvorschuss ist Ihr Anteil an den geplanten Kosten der Gemeinschaft, vermindert um geplante Einnahmen. Er wird in zwölf Monatsraten erhoben; Restcents verteilen sich auf die ersten Monate, deshalb kann eine Rate um einen Cent abweichen. Maßgeblich ist der beschlossene Wirtschaftsplan.",
      font,
      7.5,
      CW,
    )) {
      page.drawText(line, { x: ML, y, size: 7.5, font, color: GRAY });
      y -= 10;
    }
    y -= 4;
    page.drawText(`Erstellt am ${fmtDate(input.generatedAt)}`, {
      x: ML,
      y,
      size: 7.5,
      font,
      color: GRAY,
    });
  }

  return Buffer.from(await pdf.save());
}
