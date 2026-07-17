// PDF-Generator für die Einladung zur Eigentümerversammlung (DIN-A4-Brief,
// Adressposition fensterumschlag-tauglich nach DIN 5008 Form B). Aufbau analog
// zu documents/mahnung.ts. Nutzertext wird über encodeWinAnsi/wrapText
// abgesichert; lange Tagesordnungen brechen auf Folgeseiten um.
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { INVITATION_MIN_WEEKS } from "@/lib/weg/meeting-invitation";
import { encodeWinAnsi, wrapText } from "./pdf-text";

const A4: [number, number] = [595.28, 841.89];
const MM = 841.89 / 297;
const ML = 25 * MM;
const MR = 20 * MM;
const CW = A4[0] - ML - MR;
const GREEN = rgb(0, 0.21, 0.19);
const GRAY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0.1, 0.1, 0.1);
const BOTTOM = 30 * MM; // unterer Rand, ab dem umgebrochen wird

export type InvitationAgendaItem = {
  index: number;
  title: string;
  description: string | null;
  type: "INFO" | "BESCHLUSS";
};

export type MeetingInvitationInput = {
  issuer: { legalName: string; contactLine: string };
  propertyName: string;
  meetingTitle: string;
  scheduledAt: Date;
  location: string | null;
  videoLink: string | null;
  agenda: InvitationAgendaItem[];
  // Empfänger (optional): ohne Angaben wird ein neutraler „Vorlagen"-Druck erzeugt.
  recipientName: string | null;
  recipientAddress: string | null; // "Straße\nPLZ Ort"
  city: string | null; // Ort der Datumszeile
  createdAt: Date;
};

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function fmtDateTime(d: Date): string {
  return `${fmtDate(d)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} Uhr`;
}

export async function generateMeetingInvitation(raw: MeetingInvitationInput): Promise<Buffer> {
  const input: MeetingInvitationInput = {
    ...raw,
    issuer: {
      legalName: encodeWinAnsi(raw.issuer.legalName),
      contactLine: encodeWinAnsi(raw.issuer.contactLine),
    },
    propertyName: encodeWinAnsi(raw.propertyName),
    meetingTitle: encodeWinAnsi(raw.meetingTitle),
    location: raw.location == null ? null : encodeWinAnsi(raw.location),
    videoLink: raw.videoLink == null ? null : encodeWinAnsi(raw.videoLink),
    agenda: raw.agenda.map((it) => ({
      ...it,
      title: encodeWinAnsi(it.title),
      description: it.description == null ? null : encodeWinAnsi(it.description),
    })),
    recipientName: raw.recipientName == null ? null : encodeWinAnsi(raw.recipientName),
    recipientAddress: raw.recipientAddress == null ? null : encodeWinAnsi(raw.recipientAddress),
    city: raw.city == null ? null : encodeWinAnsi(raw.city),
  };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage(A4);
  drawHeader(page, bold, font, input);

  // ── Anschriftfeld (Fensterumschlag) ─────────────────────────────────────────
  let ay = A4[1] - 45 * MM;
  const returnLine = [input.issuer.legalName, input.issuer.contactLine].filter(Boolean).join(" · ");
  page.drawText(returnLine.slice(0, 90), { x: ML, y: ay, size: 6.5, font, color: GRAY });
  page.drawLine({ start: { x: ML, y: ay - 2 }, end: { x: ML + 85 * MM, y: ay - 2 }, thickness: 0.4, color: GRAY });
  ay -= 16;
  const addressLines = input.recipientName
    ? [input.recipientName, ...(input.recipientAddress?.split("\n") ?? [])]
    : ["An alle Eigentümer", `der ${input.propertyName}`];
  for (const line of addressLines) {
    if (!line.trim()) continue;
    page.drawText(line, { x: ML, y: ay, size: 11, font, color: BLACK });
    ay -= 14;
  }

  // ── Datum & Betreff ─────────────────────────────────────────────────────────
  let y = A4[1] - 100 * MM;
  const dateLine = `${input.city ? `${input.city}, ` : ""}${fmtDate(input.createdAt)}`;
  page.drawText(dateLine, { x: ML + CW - font.widthOfTextAtSize(dateLine, 10), y: y + 24, size: 10, font, color: GRAY });
  page.drawText("Einladung zur Eigentümerversammlung", { x: ML, y, size: 13, font: bold, color: BLACK });
  y -= 26;

  // ── Anrede & Einleitung ─────────────────────────────────────────────────────
  const anrede = input.recipientName ? `Sehr geehrte(r) ${input.recipientName},` : "Sehr geehrte Eigentümerinnen und Eigentümer,";
  page.drawText(anrede, { x: ML, y, size: 10, font, color: BLACK });
  y -= 20;
  const intro =
    `hiermit laden wir Sie form- und fristgerecht (Ladungsfrist mindestens ${INVITATION_MIN_WEEKS} Wochen, ` +
    `§ 24 Abs. 4 WEG) zur Eigentümerversammlung der ${input.propertyName} ein.`;
  for (const line of wrapText(intro, font, 10, CW)) {
    page.drawText(line, { x: ML, y, size: 10, font, color: BLACK });
    y -= 14;
  }
  y -= 8;

  // ── Eckdaten-Box ────────────────────────────────────────────────────────────
  const facts: [string, string][] = [
    ["Termin:", fmtDateTime(input.scheduledAt)],
    ["Ort:", input.location || "wird noch bekannt gegeben"],
  ];
  if (input.videoLink) facts.push(["Video-Zuschaltung:", input.videoLink]);
  for (const [label, value] of facts) {
    page.drawText(label, { x: ML, y, size: 10, font: bold, color: BLACK });
    for (const line of wrapText(value, font, 10, CW - 130)) {
      page.drawText(line, { x: ML + 130, y, size: 10, font, color: BLACK });
      y -= 14;
    }
  }
  y -= 10;

  // ── Tagesordnung (mit Seitenumbruch) ────────────────────────────────────────
  page.drawText("Tagesordnung", { x: ML, y, size: 12, font: bold, color: GREEN });
  y -= 18;

  const ctx = { page, y };
  const ensureSpace = (needed: number) => {
    if (ctx.y - needed < BOTTOM) {
      ctx.page = pdf.addPage(A4);
      drawHeader(ctx.page, bold, font, input, true);
      ctx.y = A4[1] - 40 * MM;
    }
  };

  if (input.agenda.length === 0) {
    page.drawText("(Die Tagesordnung wird noch ergänzt.)", { x: ML, y: ctx.y, size: 10, font, color: GRAY });
    ctx.y -= 14;
  } else {
    for (const it of input.agenda) {
      const titleLines = wrapText(`TOP ${it.index}: ${it.title}${it.type === "BESCHLUSS" ? "  [Beschluss]" : ""}`, bold, 10, CW);
      const descLines = it.description ? wrapText(it.description, font, 9, CW - 12) : [];
      ensureSpace(titleLines.length * 13 + descLines.length * 12 + 8);
      for (const line of titleLines) {
        ctx.page.drawText(line, { x: ML, y: ctx.y, size: 10, font: bold, color: BLACK });
        ctx.y -= 13;
      }
      for (const line of descLines) {
        ctx.page.drawText(line, { x: ML + 12, y: ctx.y, size: 9, font, color: GRAY });
        ctx.y -= 12;
      }
      ctx.y -= 6;
    }
  }
  ctx.y -= 6;

  // ── Hinweise & Gruß ─────────────────────────────────────────────────────────
  const notes =
    "Sollten Sie an der Teilnahme verhindert sein, können Sie sich durch eine schriftlich " +
    "bevollmächtigte Person vertreten lassen. Über nicht angekündigte Punkte kann kein " +
    "Beschluss gefasst werden (§ 23 Abs. 2 WEG).";
  ensureSpace(wrapText(notes, font, 9, CW).length * 12 + 60);
  for (const line of wrapText(notes, font, 9, CW)) {
    ctx.page.drawText(line, { x: ML, y: ctx.y, size: 9, font, color: BLACK });
    ctx.y -= 12;
  }
  ctx.y -= 14;
  ctx.page.drawText("Mit freundlichen Grüßen", { x: ML, y: ctx.y, size: 10, font, color: BLACK });
  ctx.y -= 16;
  ctx.page.drawText(input.issuer.legalName, { x: ML, y: ctx.y, size: 10, font, color: BLACK });
  ctx.y -= 30;
  for (const line of wrapText(
    "Muster — ersetzt keine Rechtsberatung. Maßgeblich sind WEG, Gemeinschaftsordnung und Teilungserklärung.",
    font, 7.5, CW,
  )) {
    ctx.page.drawText(line, { x: ML, y: ctx.y, size: 7.5, font, color: GRAY });
    ctx.y -= 10;
  }

  return Buffer.from(await pdf.save());
}

function drawHeader(
  page: PDFPage,
  bold: PDFFont,
  font: PDFFont,
  input: MeetingInvitationInput,
  continued = false,
) {
  page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GREEN });
  page.drawText(input.issuer.legalName, { x: ML, y: A4[1] - 40, size: 10, font: bold, color: GREEN });
  if (input.issuer.contactLine) {
    page.drawText(input.issuer.contactLine, { x: ML, y: A4[1] - 52, size: 8, font, color: GRAY });
  }
  if (continued) {
    page.drawText(`Tagesordnung (Fortsetzung) — ${input.meetingTitle}`, {
      x: ML, y: A4[1] - 32 * MM, size: 9, font, color: GRAY,
    });
  }
}
