// PDF-Generator für die Beschluss-Sammlung einer WEG (§ 24 Abs. 7 WEG).
// Listet alle gefassten Beschlüsse eines Objekts fortlaufend nummeriert auf.
// Aufbau analog zu lib/documents/bescheinigungen.ts (pdf-lib, A4, Helvetica).
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { encodeWinAnsi } from "./pdf-text";

const A4: [number, number] = [595.28, 841.89];
const ML = 50;
const MR = 50;
const CW = A4[0] - ML - MR;
const GREEN = rgb(0, 0.21, 0.19);
const GRAY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0.1, 0.1, 0.1);

export type BeschlussSammlungEntry = {
  number: number | null;
  title: string;
  decidedAt: Date | null;
  status: "ANGENOMMEN" | "ABGELEHNT" | "ZURUECKGEZOGEN" | "OFFEN";
  ja: number;
  nein: number;
  enthaltung: number;
};

export type BeschlussSammlungInput = {
  propertyName: string;
  issuer: { legalName: string; contactLine: string };
  entries: BeschlussSammlungEntry[];
  generatedAt: Date;
};

const STATUS_LABELS: Record<string, string> = {
  ANGENOMMEN: "Angenommen",
  ABGELEHNT: "Abgelehnt",
  ZURUECKGEZOGEN: "Zurückgezogen",
  OFFEN: "Offen",
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateBeschlussSammlung(rawInput: BeschlussSammlungInput): Promise<Buffer> {
  // Nutzergenerierte Texte für die Standard-Schrift (WinAnsi) absichern.
  const input: BeschlussSammlungInput = {
    ...rawInput,
    propertyName: encodeWinAnsi(rawInput.propertyName),
    issuer: {
      legalName: encodeWinAnsi(rawInput.issuer.legalName),
      contactLine: encodeWinAnsi(rawInput.issuer.contactLine),
    },
    entries: rawInput.entries.map((e) => ({ ...e, title: encodeWinAnsi(e.title) })),
  };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - 50;

  function ensureSpace(needed: number) {
    if (y - needed < 60) {
      page = pdf.addPage(A4);
      y = A4[1] - 50;
    }
  }

  // ── Kopf ──────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GREEN });
  page.drawText(input.issuer.legalName, { x: ML, y, size: 10, font: bold, color: GREEN });
  y -= 12;
  if (input.issuer.contactLine) {
    page.drawText(input.issuer.contactLine, { x: ML, y, size: 8, font, color: GRAY });
    y -= 16;
  } else {
    y -= 6;
  }
  page.drawText("Beschluss-Sammlung", { x: ML, y, size: 16, font: bold, color: BLACK });
  y -= 18;
  page.drawText(input.propertyName, { x: ML, y, size: 10, font, color: GRAY });
  y -= 12;
  page.drawText(`Stand: ${fmtDate(input.generatedAt)} · § 24 Abs. 7 WEG`, {
    x: ML, y, size: 8, font, color: GRAY,
  });
  y -= 18;
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.5, color: GRAY });
  y -= 16;

  if (input.entries.length === 0) {
    page.drawText("Es wurden noch keine Beschlüsse gefasst.", { x: ML, y, size: 10, font, color: GRAY });
    return Buffer.from(await pdf.save());
  }

  // ── Beschlüsse ────────────────────────────────────────────────────────
  for (const e of input.entries) {
    const titleLines = wrapText(e.title, bold, 10, CW - 60);
    ensureSpace(20 + titleLines.length * 13 + 16);

    const nr = e.number != null ? `Nr. ${e.number}` : "—";
    page.drawText(nr, { x: ML, y, size: 10, font: bold, color: GREEN });
    page.drawText(fmtDate(e.decidedAt), { x: ML + 60, y, size: 9, font, color: GRAY });
    page.drawText(STATUS_LABELS[e.status] ?? e.status, {
      x: ML + CW - 90, y, size: 9, font: bold, color: BLACK,
    });
    y -= 14;

    for (const line of titleLines) {
      page.drawText(line, { x: ML + 60, y, size: 10, font, color: BLACK });
      y -= 13;
    }

    page.drawText(
      `Abstimmung – Ja: ${e.ja} · Nein: ${e.nein} · Enthaltung: ${e.enthaltung}`,
      { x: ML + 60, y, size: 8, font, color: GRAY },
    );
    y -= 14;
    page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
    y -= 12;
  }

  return Buffer.from(await pdf.save());
}
