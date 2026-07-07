// PDF-Generator für Plattform-Rechnungen (Betreiber → Verwaltung). Eigenständig
// (pdf-lib, A4, Helvetica), nutzt die zentralen Sicherheits-Helfer aus pdf-text.
import { PDFDocument, PDFFont, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";
import { encodeWinAnsi, wrapText } from "./pdf-text";
import { formatCents, formatInvoiceNumber, type PlatformIssuer } from "@/lib/platform";

const A4: [number, number] = [595.28, 841.89];
const ML = 50;
const MR = 50;
const CW = A4[0] - ML - MR;
const GREEN = rgb(0, 0.21, 0.19);
const GRAY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0.1, 0.1, 0.1);
const LIGHT = rgb(0.85, 0.85, 0.85);

export type InvoiceItemInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
};

export type PlatformInvoiceInput = {
  year: number;
  number: number;
  title: string;
  status: "ENTWURF" | "OFFEN" | "BEZAHLT" | "STORNIERT";
  vatRate: number;
  issuedAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
  recipient: {
    name: string;
    legalName: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
  };
  items: InvoiceItemInput[];
  issuer: PlatformIssuer;
};

function fmtDate(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export async function renderPlatformInvoicePdf(input: PlatformInvoiceInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - 50;

  const iss = input.issuer;
  const enc = encodeWinAnsi;

  // Kopfbalken + Briefkopf
  page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GREEN });
  page.drawText(enc(iss.legalName), { x: ML, y, size: 11, font: bold, color: GREEN });
  y -= 13;
  if (iss.contactLine) {
    page.drawText(enc(iss.contactLine), { x: ML, y, size: 8, font, color: GRAY });
    y -= 20;
  } else y -= 8;

  // Empfänger
  page.drawText("Rechnungsempfänger", { x: ML, y, size: 8, font, color: GRAY });
  y -= 12;
  const rcpt = input.recipient;
  const rcptLines = [
    rcpt.legalName || rcpt.name,
    rcpt.street ?? "",
    [rcpt.zip, rcpt.city].filter(Boolean).join(" "),
  ].filter(Boolean);
  for (const l of rcptLines) {
    page.drawText(enc(l), { x: ML, y, size: 10, font, color: BLACK });
    y -= 13;
  }
  y -= 12;

  // Titelzeile + Metadaten
  page.drawText(`Rechnung ${formatInvoiceNumber(input.year, input.number)}`, {
    x: ML, y, size: 16, font: bold, color: BLACK,
  });
  y -= 16;
  for (const l of wrapText(enc(input.title), font, 10, CW)) {
    page.drawText(l, { x: ML, y, size: 10, font, color: GRAY });
    y -= 13;
  }
  y -= 4;
  const meta = [
    `Rechnungsdatum: ${fmtDate(input.issuedAt ?? input.createdAt)}`,
    input.dueAt ? `Fällig bis: ${fmtDate(input.dueAt)}` : "",
  ].filter(Boolean).join("   ·   ");
  page.drawText(meta, { x: ML, y, size: 9, font, color: GRAY });
  y -= 20;

  // Positionstabelle
  const colDesc = ML;
  const colQty = ML + CW - 200;
  const colUnit = ML + CW - 120;
  const colSum = ML + CW - 60;
  page.drawText("Beschreibung", { x: colDesc, y, size: 8, font: bold, color: GRAY });
  page.drawText("Menge", { x: colQty, y, size: 8, font: bold, color: GRAY });
  page.drawText("Einzel", { x: colUnit, y, size: 8, font: bold, color: GRAY });
  page.drawText("Summe", { x: colSum, y, size: 8, font: bold, color: GRAY });
  y -= 6;
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.5, color: LIGHT });
  y -= 14;

  let net = 0;
  for (const it of input.items) {
    const lineSum = it.quantity * it.unitPriceCents;
    net += lineSum;
    const descLines = wrapText(enc(it.description), font, 9, colQty - colDesc - 8);
    for (let i = 0; i < descLines.length; i++) {
      page.drawText(descLines[i], { x: colDesc, y, size: 9, font, color: BLACK });
      if (i === 0) {
        page.drawText(String(it.quantity), { x: colQty, y, size: 9, font, color: BLACK });
        page.drawText(formatCents(it.unitPriceCents), { x: colUnit, y, size: 9, font, color: BLACK });
        page.drawText(formatCents(lineSum), { x: colSum, y, size: 9, font, color: BLACK });
      }
      y -= 12;
    }
    y -= 2;
  }

  y -= 6;
  page.drawLine({ start: { x: colUnit - 10, y }, end: { x: ML + CW, y }, thickness: 0.5, color: LIGHT });
  y -= 14;
  const vat = Math.round(net * (input.vatRate / 100));
  const gross = net + vat;
  const totals: [string, string, boolean][] = [
    ["Nettobetrag", formatCents(net), false],
    [`zzgl. USt ${input.vatRate}%`, formatCents(vat), false],
    ["Gesamtbetrag", formatCents(gross), true],
  ];
  for (const [label, value, strong] of totals) {
    page.drawText(label, { x: colUnit - 10, y, size: strong ? 11 : 9, font: strong ? bold : font, color: strong ? BLACK : GRAY });
    page.drawText(value, { x: colSum, y, size: strong ? 11 : 9, font: strong ? bold : font, color: strong ? BLACK : GRAY });
    y -= strong ? 18 : 13;
  }

  // Zahlungshinweis
  y -= 12;
  if (input.status !== "STORNIERT" && (iss.iban || iss.bank)) {
    page.drawText("Zahlbar ohne Abzug auf folgendes Konto:", { x: ML, y, size: 9, font, color: BLACK });
    y -= 12;
    if (iss.iban) { page.drawText(enc(`IBAN: ${iss.iban}`), { x: ML, y, size: 9, font, color: GRAY }); y -= 12; }
    if (iss.bank) { page.drawText(enc(`Bank: ${iss.bank}`), { x: ML, y, size: 9, font, color: GRAY }); y -= 12; }
    if (iss.vatId) { page.drawText(enc(`USt-IdNr.: ${iss.vatId}`), { x: ML, y, size: 8, font, color: GRAY }); y -= 12; }
  }

  // Wasserzeichen für Entwurf/Storno
  if (input.status === "ENTWURF" || input.status === "STORNIERT") {
    drawWatermark(page, bold, input.status === "STORNIERT" ? "STORNIERT" : "ENTWURF");
  }

  return Buffer.from(await pdf.save());
}

function drawWatermark(page: PDFPage, font: PDFFont, text: string) {
  page.drawText(text, {
    x: 120,
    y: 380,
    size: 90,
    font,
    color: rgb(0.9, 0.5, 0.3),
    rotate: degrees(35),
    opacity: 0.15,
  });
}
