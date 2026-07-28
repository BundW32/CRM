// PDF-Generator für die Betriebskostenabrechnung einer vermieteten Einheit (M-K).
// DIN-A4-Brief, fensterumschlag-tauglich; Aufbau analog zu documents/mahnung.ts.
import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { formatCents } from "@/lib/money";
import { encodeWinAnsi, fitText, wrapText } from "./pdf-text";

const A4: [number, number] = [595.28, 841.89];
const MM = 841.89 / 297;
const ML = 25 * MM;
const MR = 20 * MM;
const CW = A4[0] - ML - MR;
const GREEN = rgb(0, 0.21, 0.19);
const GRAY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0.1, 0.1, 0.1);

export type BetriebskostenInput = {
  issuer: { legalName: string; contactLine: string };
  propertyName: string;
  unitLabel: string;
  tenantName: string | null;
  year: number;
  recoverableRows: { name: string; cents: number }[];
  nonRecoverableRows: { name: string; cents: number }[];
  recoverableSumCents: number;
  co2LandlordDeductionCents: number;
  tenantCostsCents: number;
  months: number;
  prepaymentMonthlyCents: number;
  prepaymentCents: number;
  balanceCents: number;
  city: string | null;
  createdAt: Date;
};

function euro(cents: number): string {
  return encodeWinAnsi(formatCents(cents));
}
function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export async function generateBetriebskosten(raw: BetriebskostenInput): Promise<Buffer> {
  const input: BetriebskostenInput = {
    ...raw,
    issuer: {
      legalName: encodeWinAnsi(raw.issuer.legalName),
      contactLine: encodeWinAnsi(raw.issuer.contactLine),
    },
    propertyName: encodeWinAnsi(raw.propertyName),
    unitLabel: encodeWinAnsi(raw.unitLabel),
    tenantName: raw.tenantName == null ? null : encodeWinAnsi(raw.tenantName),
    recoverableRows: raw.recoverableRows.map((r) => ({ ...r, name: encodeWinAnsi(r.name) })),
    nonRecoverableRows: raw.nonRecoverableRows.map((r) => ({ ...r, name: encodeWinAnsi(r.name) })),
    city: raw.city == null ? null : encodeWinAnsi(raw.city),
  };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // War fest einseitig: bei vielen Kostenpositionen rutschte der Rest unter den
  // Blattrand und war unsichtbar weg. Jetzt bricht die Abrechnung um.
  let page: PDFPage = pdf.addPage(A4);
  let y = 0;
  const BOTTOM = 25 * MM;
  const ensure = (needed: number) => {
    if (y - needed >= BOTTOM) return;
    page = pdf.addPage(A4);
    y = A4[1] - 40 * MM;
  };

  page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GREEN });
  // Firmenname umbrechen (nie kürzen – er ist die Absenderangabe), Kontaktzeile
  // gegen die Satzbreite begrenzen. Vorher liefen beide über den Blattrand.
  let hy = A4[1] - 40;
  for (const line of wrapText(input.issuer.legalName, bold, 10, CW).slice(0, 2)) {
    page.drawText(line, { x: ML, y: hy, size: 10, font: bold, color: GREEN });
    hy -= 12;
  }
  if (input.issuer.contactLine) {
    page.drawText(fitText(input.issuer.contactLine, font, 8, CW), { x: ML, y: hy, size: 8, font, color: GRAY });
  }

  // Anschriftfeld
  let ay = A4[1] - 45 * MM;
  const returnLine = [input.issuer.legalName, input.issuer.contactLine].filter(Boolean).join(" · ");
  page.drawText(fitText(returnLine, font, 6.5, 85 * MM), { x: ML, y: ay, size: 6.5, font, color: GRAY });
  page.drawLine({ start: { x: ML, y: ay - 2 }, end: { x: ML + 85 * MM, y: ay - 2 }, thickness: 0.4, color: GRAY });
  ay -= 16;
  for (const line of [input.tenantName ?? "An den Mieter", `Einheit ${input.unitLabel}`]) {
    page.drawText(line, { x: ML, y: ay, size: 11, font, color: BLACK });
    ay -= 14;
  }

  y = A4[1] - 100 * MM;
  const dateLine = `${input.city ? `${input.city}, ` : ""}${fmtDate(input.createdAt)}`;
  page.drawText(dateLine, { x: ML + CW - font.widthOfTextAtSize(dateLine, 10), y: y + 24, size: 10, font, color: GRAY });
  page.drawText(`Betriebskostenabrechnung ${input.year}`, { x: ML, y, size: 13, font: bold, color: BLACK });
  y -= 18;
  // Objektzeile umbrechen statt über den Blattrand hinauszuschreiben.
  for (const line of wrapText(`${input.propertyName} · Einheit ${input.unitLabel}`, font, 9, CW)) {
    page.drawText(line, { x: ML, y, size: 9, font, color: GRAY });
    y -= 12;
  }
  y -= 12;

  const rowRight = (label: string, value: string, opts: { boldRow?: boolean; color?: typeof BLACK } = {}) => {
    const f = opts.boldRow ? bold : font;
    ensure(15);
    // Bezeichnung gegen die Betragsspalte begrenzen, damit beide nie kollidieren.
    const room = CW - f.widthOfTextAtSize(value, 10) - 12;
    page.drawText(fitText(label, f, 10, room), { x: ML, y, size: 10, font: f, color: opts.color ?? BLACK });
    page.drawText(value, { x: ML + CW - f.widthOfTextAtSize(value, 10), y, size: 10, font: f, color: opts.color ?? BLACK });
    y -= 15;
  };

  ensure(30);
  page.drawText("Umlagefähige Kosten (BetrKV)", { x: ML, y, size: 10, font: bold, color: GREEN });
  y -= 16;
  for (const r of input.recoverableRows) rowRight(r.name, euro(r.cents));
  page.drawLine({ start: { x: ML, y: y + 4 }, end: { x: ML + CW, y: y + 4 }, thickness: 0.4, color: GRAY });
  y -= 4;
  rowRight("Summe umlagefähig", euro(input.recoverableSumCents), { boldRow: true });
  if (input.co2LandlordDeductionCents > 0) {
    rowRight("abzgl. Vermieter-CO2-Anteil (CO2KostAufG)", `- ${euro(input.co2LandlordDeductionCents)}`, { color: rgb(0, 0.4, 0.2) });
  }
  rowRight("Auf den Mieter entfallende Kosten", euro(input.tenantCostsCents), { boldRow: true });
  rowRight(`abzgl. Vorauszahlungen (${input.months} × ${euro(input.prepaymentMonthlyCents)})`, `- ${euro(input.prepaymentCents)}`);
  y -= 4;
  ensure(40);
  page.drawRectangle({ x: ML, y: y - 6, width: CW, height: 24, color: rgb(0.96, 0.96, 0.96) });
  const balLabel = input.balanceCents >= 0 ? "Nachzahlung" : "Guthaben";
  const balColor = input.balanceCents > 0 ? rgb(0.6, 0.09, 0.09) : rgb(0, 0.4, 0.2);
  page.drawText(balLabel, { x: ML + 8, y, size: 12, font: bold, color: BLACK });
  const balVal = euro(Math.abs(input.balanceCents));
  page.drawText(balVal, { x: ML + CW - 8 - bold.widthOfTextAtSize(balVal, 12), y, size: 12, font: bold, color: balColor });
  y -= 30;

  if (input.nonRecoverableRows.length > 0) {
    ensure(26);
    page.drawText("Nicht umlagefähig (trägt der Eigentümer)", { x: ML, y, size: 9, font: bold, color: GRAY });
    y -= 13;
    for (const r of input.nonRecoverableRows) {
      ensure(12);
      page.drawText(fitText(r.name, font, 8.5, CW - font.widthOfTextAtSize(euro(r.cents), 8.5) - 12), { x: ML, y, size: 8.5, font, color: GRAY });
      page.drawText(euro(r.cents), { x: ML + CW - font.widthOfTextAtSize(euro(r.cents), 8.5), y, size: 8.5, font, color: GRAY });
      y -= 12;
    }
    y -= 8;
  }

  for (const line of wrapText(
    "Die Abrechnung leitet sich aus der WEG-Jahresabrechnung ab. Umlagefähigkeit nach BetrKV; " +
      "der CO2-Kostenanteil ist nach dem CO2KostAufG zwischen Vermieter und Mieter aufgeteilt. " +
      "Muster — ersetzt keine Rechtsberatung.",
    font, 7.5, CW,
  )) {
    ensure(10);
    page.drawText(line, { x: ML, y, size: 7.5, font, color: GRAY });
    y -= 10;
  }

  return Buffer.from(await pdf.save());
}
