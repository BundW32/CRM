// PDF-Generator für das Versammlungsprotokoll (Eigentümerversammlung, light).
// Aufbau analog zu lib/documents/beschluss-sammlung.ts (pdf-lib, A4).
import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { encodeWinAnsi, wrapText } from "./pdf-text";

const A4: [number, number] = [595.28, 841.89];
const ML = 50;
const CW = A4[0] - ML - 50;
const GREEN = rgb(0, 0.21, 0.19);
const GRAY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0.1, 0.1, 0.1);

export type ProtocolAgendaItem = {
  index: number;
  title: string;
  description: string | null;
  type: "INFO" | "BESCHLUSS";
  result: string | null; // z. B. "Angenommen (Ja 3 · Nein 1 · Enthaltung 0)"
};

export type MeetingProtocolInput = {
  propertyName: string;
  issuer: { legalName: string; contactLine: string };
  meetingTitle: string;
  scheduledAt: Date;
  location: string | null;
  attendance: string | null;
  items: ProtocolAgendaItem[];
  generatedAt: Date;
};

function fmtDateTime(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  const date = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date}, ${time} Uhr`;
}

export async function generateMeetingProtocol(rawInput: MeetingProtocolInput): Promise<Buffer> {
  // Nutzergenerierte Texte für die Standard-Schrift (WinAnsi) absichern, damit
  // Sonderzeichen/Emoji den Export nicht zum Absturz bringen.
  const input: MeetingProtocolInput = {
    ...rawInput,
    propertyName: encodeWinAnsi(rawInput.propertyName),
    issuer: {
      legalName: encodeWinAnsi(rawInput.issuer.legalName),
      contactLine: encodeWinAnsi(rawInput.issuer.contactLine),
    },
    meetingTitle: encodeWinAnsi(rawInput.meetingTitle),
    location: rawInput.location == null ? null : encodeWinAnsi(rawInput.location),
    attendance: rawInput.attendance == null ? null : encodeWinAnsi(rawInput.attendance),
    items: rawInput.items.map((it) => ({
      ...it,
      title: encodeWinAnsi(it.title),
      description: it.description == null ? null : encodeWinAnsi(it.description),
      result: it.result == null ? null : encodeWinAnsi(it.result),
    })),
  };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - 50;
  const ensure = (needed: number) => {
    if (y - needed < 60) {
      page = pdf.addPage(A4);
      y = A4[1] - 50;
    }
  };

  page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GREEN });
  page.drawText(input.issuer.legalName, { x: ML, y, size: 10, font: bold, color: GREEN });
  y -= 12;
  if (input.issuer.contactLine) {
    page.drawText(input.issuer.contactLine, { x: ML, y, size: 8, font, color: GRAY });
    y -= 16;
  } else y -= 6;

  page.drawText("Protokoll der Eigentümerversammlung", { x: ML, y, size: 15, font: bold, color: BLACK });
  y -= 18;
  page.drawText(input.propertyName, { x: ML, y, size: 10, font, color: GRAY });
  y -= 13;
  page.drawText(`${input.meetingTitle} · ${fmtDateTime(input.scheduledAt)}`, { x: ML, y, size: 9, font, color: GRAY });
  y -= 12;
  if (input.location) {
    page.drawText(`Ort: ${input.location}`, { x: ML, y, size: 9, font, color: GRAY });
    y -= 12;
  }
  if (input.attendance) {
    for (const line of wrapText(`Anwesenheit: ${input.attendance}`, font, 9, CW)) {
      page.drawText(line, { x: ML, y, size: 9, font, color: GRAY });
      y -= 12;
    }
  }
  y -= 4;
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.5, color: GRAY });
  y -= 16;

  page.drawText("Tagesordnung & Ergebnisse", { x: ML, y, size: 11, font: bold, color: BLACK });
  y -= 16;

  for (const item of input.items) {
    const titleLines = wrapText(`TOP ${item.index}: ${item.title}`, bold, 10, CW);
    ensure(16 + titleLines.length * 13 + 30);
    for (const line of titleLines) {
      page.drawText(line, { x: ML, y, size: 10, font: bold, color: BLACK });
      y -= 13;
    }
    if (item.description) {
      for (const line of wrapText(item.description, font, 9, CW)) {
        ensure(12);
        page.drawText(line, { x: ML, y, size: 9, font, color: rgb(0.25, 0.25, 0.25) });
        y -= 12;
      }
    }
    const resultText =
      item.type === "BESCHLUSS" ? `Beschluss: ${item.result ?? "offen"}` : "Zur Information";
    page.drawText(resultText, { x: ML, y, size: 9, font: bold, color: GREEN });
    y -= 16;
  }

  ensure(20);
  page.drawText(`Erstellt am ${fmtDateTime(input.generatedAt)}`, { x: ML, y, size: 8, font, color: GRAY });

  return Buffer.from(await pdf.save());
}
