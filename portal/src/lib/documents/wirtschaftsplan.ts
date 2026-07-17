// PDF-Generator für den Wirtschaftsplan (§ 28 Abs. 1 WEG): Gesamtplan mit
// Kostenpositionen und Einzelwirtschaftsplänen (monatliches Hausgeld je Einheit)
// sowie Beschlussvorlage. Aufbau analog zu einzelabrechnung.ts (pdf-lib, A4).
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

export type WirtschaftsplanPosition = { name: string; keyLabel: string; amountCents: number };
export type WirtschaftsplanUnit = {
  label: string;
  annualCents: number;
  monthlyMinCents: number;
  monthlyMaxCents: number;
};
export type WirtschaftsplanInput = {
  propertyName: string;
  issuer: { legalName: string; contactLine: string };
  year: number;
  resolved: { date: Date; note: string | null } | null; // null = Entwurf
  positions: WirtschaftsplanPosition[];
  totalCents: number;
  units: WirtschaftsplanUnit[];
  generatedAt: Date;
};

function euro(cents: number): string {
  return encodeWinAnsi(formatCents(cents));
}
function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function drawRight(page: PDFPage, text: string, xRight: number, y: number, size: number, font: PDFFont, color = BLACK) {
  page.drawText(text, { x: xRight - font.widthOfTextAtSize(text, size), y, size, font, color });
}

export async function generateWirtschaftsplan(rawInput: WirtschaftsplanInput): Promise<Buffer> {
  const input: WirtschaftsplanInput = {
    ...rawInput,
    propertyName: encodeWinAnsi(rawInput.propertyName),
    issuer: {
      legalName: encodeWinAnsi(rawInput.issuer.legalName),
      contactLine: encodeWinAnsi(rawInput.issuer.contactLine),
    },
    positions: rawInput.positions.map((p) => ({ ...p, name: encodeWinAnsi(p.name), keyLabel: encodeWinAnsi(p.keyLabel) })),
    units: rawInput.units.map((u) => ({ ...u, label: encodeWinAnsi(u.label) })),
    resolved: rawInput.resolved
      ? { ...rawInput.resolved, note: rawInput.resolved.note == null ? null : encodeWinAnsi(rawInput.resolved.note) }
      : null,
  };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - 50;
  const ensure = (needed: number) => {
    if (y - needed < 70) {
      page = pdf.addPage(A4);
      y = A4[1] - 50;
    }
  };

  // ── Briefkopf ──────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GREEN });
  page.drawText(input.issuer.legalName, { x: ML, y, size: 10, font: bold, color: GREEN });
  y -= 12;
  if (input.issuer.contactLine) {
    page.drawText(input.issuer.contactLine, { x: ML, y, size: 8, font, color: GRAY });
    y -= 16;
  } else y -= 6;

  page.drawText(`Wirtschaftsplan ${input.year}`, { x: ML, y, size: 15, font: bold, color: BLACK });
  if (!input.resolved) drawRight(page, "ENTWURF", ML + CW, y + 1, 11, bold, rgb(0.6, 0.09, 0.09));
  y -= 18;
  for (const l of wrapText(input.propertyName, font, 10, CW)) {
    page.drawText(l, { x: ML, y, size: 10, font, color: GRAY });
    y -= 13;
  }
  page.drawText(
    input.resolved
      ? `Beschlossen am ${fmtDate(input.resolved.date)}${input.resolved.note ? ` (${input.resolved.note})` : ""}`
      : "Entwurf — noch nicht beschlossen",
    { x: ML, y, size: 9, font, color: GRAY },
  );
  y -= 14;
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.5, color: GRAY });
  y -= 16;

  // ── Gesamtplan (Kostenpositionen) ──────────────────────────────────────────
  page.drawText("Gesamtwirtschaftsplan", { x: ML, y, size: 11, font: bold, color: BLACK });
  y -= 16;
  page.drawText("Kostenart", { x: ML, y, size: 8, font: bold, color: GRAY });
  page.drawText("Umlageschlüssel", { x: ML + 240, y, size: 8, font: bold, color: GRAY });
  drawRight(page, "Planwert / Jahr", ML + CW, y, 8, bold, GRAY);
  y -= 6;
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
  y -= 12;

  for (const p of input.positions) {
    const nameLines = wrapText(p.name, font, 9, 230);
    ensure(nameLines.length * 11 + 4);
    nameLines.forEach((l, i) => {
      page.drawText(l, { x: ML, y: y - i * 11, size: 9, font, color: BLACK });
    });
    page.drawText(p.keyLabel, { x: ML + 240, y, size: 8, font, color: GRAY });
    drawRight(page, euro(p.amountCents), ML + CW, y, 9, font, BLACK);
    y -= Math.max(nameLines.length * 11, 11) + 3;
  }
  ensure(24);
  page.drawLine({ start: { x: ML, y: y + 4 }, end: { x: ML + CW, y: y + 4 }, thickness: 0.5, color: GRAY });
  page.drawText("Summe Vorschüsse (Hausgeld gesamt)", { x: ML, y: y - 8, size: 10, font: bold, color: BLACK });
  drawRight(page, euro(input.totalCents), ML + CW, y - 8, 11, bold, GREEN);
  y -= 34;

  // ── Einzelwirtschaftspläne (Hausgeld je Einheit) ───────────────────────────
  ensure(40);
  page.drawText("Einzelwirtschaftspläne — monatliches Hausgeld je Einheit", { x: ML, y, size: 11, font: bold, color: BLACK });
  y -= 16;
  page.drawText("Einheit", { x: ML, y, size: 8, font: bold, color: GRAY });
  drawRight(page, "Jahres-Vorschuss", ML + 360, y, 8, bold, GRAY);
  drawRight(page, "monatlich", ML + CW, y, 8, bold, GRAY);
  y -= 6;
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
  y -= 12;

  for (const u of input.units) {
    ensure(14);
    page.drawText(u.label, { x: ML, y, size: 9, font, color: BLACK });
    drawRight(page, euro(u.annualCents), ML + 360, y, 9, font, BLACK);
    const monthly =
      u.monthlyMinCents === u.monthlyMaxCents
        ? euro(u.monthlyMaxCents)
        : `${euro(u.monthlyMinCents)} - ${euro(u.monthlyMaxCents)}`;
    drawRight(page, monthly, ML + CW, y, 9, font, BLACK);
    y -= 14;
  }

  // ── Beschlussvorlage ───────────────────────────────────────────────────────
  ensure(120);
  y -= 10;
  page.drawRectangle({ x: ML, y: y - 4, width: CW, height: 18, color: LIGHT });
  page.drawText("Beschlussvorlage (TOP)", { x: ML + 6, y, size: 10, font: bold, color: BLACK });
  y -= 24;
  const vorlage =
    `Die Gemeinschaft der Wohnungseigentümer beschließt gemäß § 28 Abs. 1 WEG auf Grundlage ` +
    `des vorgelegten Wirtschaftsplans für das Wirtschaftsjahr ${input.year} die Vorschüsse zur ` +
    `Kostentragung und zur Zuführung zur Erhaltungsrücklage in Höhe von insgesamt ` +
    `${encodeWinAnsi(formatCents(input.totalCents))}. Die monatlichen Hausgeld-Vorschüsse je Einheit ` +
    `ergeben sich aus den obigen Einzelwirtschaftsplänen und sind jeweils zum 1. eines Monats fällig.`;
  for (const l of wrapText(vorlage, font, 9, CW)) {
    ensure(12);
    page.drawText(l, { x: ML, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 12;
  }
  y -= 8;
  ensure(20);
  const foot = input.resolved
    ? `Beschlossener Wirtschaftsplan, erstellt am ${fmtDate(input.generatedAt)}. Muster — ersetzt keine Rechtsberatung.`
    : `ENTWURF, erstellt am ${fmtDate(input.generatedAt)} — noch nicht beschlossen. Muster — ersetzt keine Rechtsberatung.`;
  for (const l of wrapText(foot, font, 7.5, CW)) {
    page.drawText(l, { x: ML, y, size: 7.5, font, color: GRAY });
    y -= 10;
  }

  return Buffer.from(await pdf.save());
}
