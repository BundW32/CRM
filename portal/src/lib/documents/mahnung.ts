// PDF-Generator für Hausgeld-Zahlungserinnerung/Mahnung (DIN-A4-Brief,
// Adressposition fensterumschlag-tauglich nach DIN 5008 Form B).
// Stufen/Texte analog zum Plattform-Mahnwesen (lib/dunning.ts) — keine
// automatischen Gebühren. Aufbau analog zu den anderen documents/-Generatoren.
import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { formatCents } from "@/lib/money";
import { reminderLevelLabel } from "@/lib/dunning";
import { encodeWinAnsi, fitText, wrapText } from "./pdf-text";

const A4: [number, number] = [595.28, 841.89];
const MM = 841.89 / 297; // Punkt je Millimeter
const ML = 25 * MM; // linker Rand 25 mm (DIN 5008)
const MR = 20 * MM;
const CW = A4[0] - ML - MR;
const GREEN = rgb(0, 0.21, 0.19);
const GRAY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0.1, 0.1, 0.1);

export type MahnungInput = {
  issuer: { legalName: string; contactLine: string }; // Absender (WEG/Verwaltung)
  propertyName: string;
  unitLabel: string;
  level: number; // 1–3 (reminderLevelLabel)
  recipientName: string;
  recipientAddress: string | null; // "Straße\nPLZ Ort"
  arrearsCents: number;
  paymentDeadline: Date;
  iban: string | null; // Girokonto der Gemeinschaft
  accountHolder: string | null;
  createdAt: Date;
  city: string | null; // Ortsangabe der Datumszeile
};

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export async function generateMahnung(rawInput: MahnungInput): Promise<Buffer> {
  const input: MahnungInput = {
    ...rawInput,
    issuer: {
      legalName: encodeWinAnsi(rawInput.issuer.legalName),
      contactLine: encodeWinAnsi(rawInput.issuer.contactLine),
    },
    propertyName: encodeWinAnsi(rawInput.propertyName),
    unitLabel: encodeWinAnsi(rawInput.unitLabel),
    recipientName: encodeWinAnsi(rawInput.recipientName),
    recipientAddress: rawInput.recipientAddress == null ? null : encodeWinAnsi(rawInput.recipientAddress),
    iban: rawInput.iban == null ? null : encodeWinAnsi(rawInput.iban),
    accountHolder: rawInput.accountHolder == null ? null : encodeWinAnsi(rawInput.accountHolder),
    city: rawInput.city == null ? null : encodeWinAnsi(rawInput.city),
  };
  const levelLabel = encodeWinAnsi(reminderLevelLabel(input.level));

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Der Brief war bis hierher fest einseitig: ohne Umbruch wurde alles, was
  // unter den Blattrand rutschte (viele Positionen, lange Texte), stillschweigend
  // ins Nichts gezeichnet. Jetzt bricht er um.
  let page: PDFPage = pdf.addPage(A4);
  let y = 0;
  const BOTTOM = 25 * MM; // unterer Rand, ab dem umgebrochen wird
  const ensure = (needed: number) => {
    if (y - needed >= BOTTOM) return;
    page = pdf.addPage(A4);
    y = A4[1] - 40 * MM;
  };

  // ── Kopf ───────────────────────────────────────────────────────────────────
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

  // ── Anschriftfeld (Fensterumschlag, DIN 5008 Form B: ab 45 mm von oben) ────
  let ay = A4[1] - 45 * MM;
  // Rücksendeangabe (einzeilig, klein, unterstrichen wirkt über die Linie)
  const returnLine = [input.issuer.legalName, input.issuer.contactLine].filter(Boolean).join(" · ");
  // Muss in die 85 mm des Anschriftfelds passen – gemessen, nicht gezählt.
  page.drawText(fitText(returnLine, font, 6.5, 85 * MM), { x: ML, y: ay, size: 6.5, font, color: GRAY });
  page.drawLine({ start: { x: ML, y: ay - 2 }, end: { x: ML + 85 * MM, y: ay - 2 }, thickness: 0.4, color: GRAY });
  ay -= 16;
  // Anschriften werden UMGEBROCHEN, nie gekürzt – eine abgeschnittene Anschrift
  // ist unzustellbar.
  const addressLines = [input.recipientName, ...(input.recipientAddress?.split("\n") ?? [])]
    .filter((l) => l.trim())
    .flatMap((l) => wrapText(l, font, 11, 85 * MM));
  for (const line of addressLines) {
    page.drawText(line, { x: ML, y: ay, size: 11, font, color: BLACK });
    ay -= 14;
  }

  // ── Datum & Betreff ────────────────────────────────────────────────────────
  y = A4[1] - 100 * MM;
  const dateLine = `${input.city ? `${input.city}, ` : ""}${fmtDate(input.createdAt)}`;
  page.drawText(dateLine, { x: ML + CW - font.widthOfTextAtSize(dateLine, 10), y: y + 24, size: 10, font, color: GRAY });
  // Betreff umbrechen: mit langem Objektnamen lief er vorher über den Blattrand
  // hinaus und war im Druck abgeschnitten.
  for (const line of wrapText(
    `${levelLabel} — Hausgeld ${input.propertyName}, Einheit ${input.unitLabel}`,
    bold, 12, CW,
  )) {
    ensure(16);
    page.drawText(line, { x: ML, y, size: 12, font: bold, color: BLACK });
    y -= 16;
  }
  y -= 14;

  // ── Text ───────────────────────────────────────────────────────────────────
  const anrede = `Sehr geehrte(r) ${input.recipientName},`;
  const amount = encodeWinAnsi(formatCents(input.arrearsCents));
  const bodyByLevel: Record<number, string> = {
    1:
      `bei der Durchsicht der Hausgeld-Konten haben wir festgestellt, dass für Ihre Einheit ` +
      `${input.unitLabel} derzeit ein Rückstand von ${amount} besteht. Sicher handelt es sich ` +
      `nur um ein Versehen. Wir bitten Sie, den offenen Betrag bis zum ` +
      `${fmtDate(input.paymentDeadline)} auszugleichen. Sollte sich Ihre Zahlung mit diesem ` +
      `Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.`,
    2:
      `trotz unserer Zahlungserinnerung besteht für Ihre Einheit ${input.unitLabel} weiterhin ` +
      `ein Hausgeld-Rückstand von ${amount}. Wir fordern Sie auf, den offenen Betrag bis ` +
      `spätestens ${fmtDate(input.paymentDeadline)} auf das unten genannte Konto der ` +
      `Gemeinschaft zu zahlen.`,
    3:
      `trotz Zahlungserinnerung und Mahnung besteht für Ihre Einheit ${input.unitLabel} ` +
      `weiterhin ein Hausgeld-Rückstand von ${amount}. Wir fordern Sie letztmalig auf, den ` +
      `offenen Betrag bis spätestens ${fmtDate(input.paymentDeadline)} auszugleichen. ` +
      `Nach fruchtlosem Fristablauf behält sich die Gemeinschaft der Wohnungseigentümer vor, ` +
      `die Forderung ohne weitere Ankündigung gerichtlich geltend zu machen; dadurch ` +
      `entstehende Kosten gehen zu Ihren Lasten.`,
  };

  ensure(20);
  page.drawText(anrede, { x: ML, y, size: 10, font, color: BLACK });
  y -= 20;
  for (const line of wrapText(bodyByLevel[input.level] ?? bodyByLevel[2], font, 10, CW)) {
    ensure(14);
    page.drawText(line, { x: ML, y, size: 10, font, color: BLACK });
    y -= 14;
  }
  y -= 8;

  // Betrag hervorgehoben
  ensure(50);
  page.drawRectangle({ x: ML, y: y - 8, width: CW, height: 26, color: rgb(0.96, 0.96, 0.96) });
  page.drawText("Offener Betrag:", { x: ML + 8, y, size: 11, font: bold, color: BLACK });
  page.drawText(amount, {
    x: ML + CW - 8 - bold.widthOfTextAtSize(amount, 12), y, size: 12, font: bold, color: rgb(0.6, 0.09, 0.09),
  });
  y -= 26;
  page.drawText(`Zahlbar bis: ${fmtDate(input.paymentDeadline)}`, { x: ML + 8, y, size: 10, font, color: BLACK });
  y -= 24;

  if (input.iban) {
    ensure(76);
    page.drawText("Bankverbindung der Gemeinschaft:", { x: ML, y, size: 10, font: bold, color: BLACK });
    y -= 14;
    if (input.accountHolder) {
      page.drawText(fitText(`Kontoinhaber: ${input.accountHolder}`, font, 10, CW), { x: ML, y, size: 10, font, color: BLACK });
      y -= 14;
    }
    page.drawText(fitText(`IBAN: ${input.iban}`, font, 10, CW), { x: ML, y, size: 10, font, color: BLACK });
    y -= 14;
    page.drawText(fitText(`Verwendungszweck: Hausgeld ${input.unitLabel}`, font, 10, CW), { x: ML, y, size: 10, font, color: BLACK });
    y -= 24;
  }

  ensure(56);
  page.drawText("Mit freundlichen Grüßen", { x: ML, y, size: 10, font, color: BLACK });
  y -= 16;
  for (const line of wrapText(input.issuer.legalName, font, 10, CW)) {
    page.drawText(line, { x: ML, y, size: 10, font, color: BLACK });
    y -= 13;
  }
  y -= 27;

  for (const line of wrapText(
    "Bereits geleistete Zahlungen sind ggf. noch nicht berücksichtigt. Muster — ersetzt keine Rechtsberatung.",
    font, 7.5, CW,
  )) {
    ensure(10);
    page.drawText(line, { x: ML, y, size: 7.5, font, color: GRAY });
    y -= 10;
  }

  return Buffer.from(await pdf.save());
}
