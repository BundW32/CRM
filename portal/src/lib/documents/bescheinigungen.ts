// Automatische Erstellung von Standard-Bescheinigungen als PDF (pdf-lib).
// Inhalte richten sich nach den gesetzlichen Vorgaben (z. B. § 19 BMG).
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { prepareSignaturePng } from "./signature";

const A4: [number, number] = [595.28, 841.89];
// Constants for Mietbescheinigung (legacy helper set)
const MARGIN = 56;
const GREEN = rgb(0, 0.21, 0.19);
const GRAY = rgb(0.3, 0.3, 0.3);
// Constants for Wohnungsgeberbestätigung
const ML = 50;
const MR = 50;
const CW = A4[0] - ML - MR; // 495.28
const BLACK = rgb(0, 0, 0);
const LGRAY = rgb(0.5, 0.5, 0.5);
const HEADERBG = rgb(0.82, 0.82, 0.82);
const BOXBORDER = rgb(0.38, 0.38, 0.38);

export type SignatureImage = { bytes: Uint8Array; mime: string } | null;

// Bettet eine freigestellte Unterschrift in das PDF ein. Es wird zunächst
// serverseitig der Hintergrund entfernt (transparentes PNG). Schlägt das fehl,
// wird das Originalbild verwendet, damit nie eine Unterschrift fehlt.
async function embedSignature(pdf: PDFDocument, signature: SignatureImage) {
  if (!signature) return null;
  try {
    const prepared = await prepareSignaturePng(signature.bytes);
    if (prepared) {
      return await pdf.embedPng(prepared.png);
    }
  } catch {
    /* Freistellen fehlgeschlagen – Originalbild versuchen */
  }
  try {
    return signature.mime.includes("png")
      ? await pdf.embedPng(signature.bytes)
      : await pdf.embedJpg(signature.bytes);
  } catch {
    return null;
  }
}

// Welche Bescheinigung lässt sich aus dem Anforderungstitel automatisch erstellen?
export function supportedCertificate(title: string): "wohnungsgeber" | "miet" | null {
  const t = title.toLowerCase();
  if (t.includes("wohnungsgeber")) return "wohnungsgeber";
  if (t.includes("mietbescheinigung")) return "miet";
  return null;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(d);
}

function fmtDateShort(d: Date | null): string {
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

// ── Helpers for Mietbescheinigung ────────────────────────────────────────────

type Ctx = {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
};

function line(ctx: Ctx, text: string, opts: { size?: number; bold?: boolean; gap?: number; color?: ReturnType<typeof rgb> } = {}) {
  const size = opts.size ?? 11;
  ctx.page.drawText(text, {
    x: MARGIN,
    y: ctx.y,
    size,
    font: opts.bold ? ctx.bold : ctx.font,
    color: opts.color ?? rgb(0.1, 0.1, 0.1),
  });
  ctx.y -= size + (opts.gap ?? 6);
}

function space(ctx: Ctx, h = 10) {
  ctx.y -= h;
}

async function drawSignature(
  pdf: PDFDocument,
  ctx: Ctx,
  signature: SignatureImage,
  unterzeichner: string
) {
  space(ctx, 24);
  const img = await embedSignature(pdf, signature);
  if (img) {
    const maxW = 200;
    const maxH = 70;
    const scale = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.page.drawImage(img, { x: MARGIN, y: ctx.y - h + 14, width: w, height: h });
    ctx.y -= h;
  } else {
    space(ctx, 28);
  }
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: MARGIN + 200, y: ctx.y },
    thickness: 0.7,
    color: GRAY,
  });
  ctx.y -= 14;
  line(ctx, `Unterschrift${unterzeichner ? ` – ${unterzeichner}` : ""}`, { size: 9, color: GRAY });
}

// Briefkopf der ausstellenden Hausverwaltung (org-spezifisch).
export type DocumentIssuer = {
  legalName: string; // Firmenname in der Kopfzeile
  contactLine: string; // „Straße · PLZ Ort · E-Mail"
};

function header(ctx: Ctx, title: string, subtitle: string, issuer: DocumentIssuer) {
  ctx.page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GREEN });
  line(ctx, issuer.legalName, { size: 10, bold: true, color: GREEN, gap: 2 });
  if (issuer.contactLine) {
    line(ctx, issuer.contactLine, { size: 8, color: GRAY, gap: 16 });
  } else {
    space(ctx, 16);
  }
  line(ctx, title, { size: 16, bold: true, gap: 4 });
  line(ctx, subtitle, { size: 10, color: GRAY, gap: 16 });
}

// ── Helpers for Wohnungsgeberbestätigung ────────────────────────────────────

function drawCheckbox(page: PDFPage, x: number, y: number, checked: boolean) {
  const s = 10;
  page.drawRectangle({
    x,
    y: y - s,
    width: s,
    height: s,
    borderColor: BLACK,
    borderWidth: 0.75,
    color: rgb(1, 1, 1),
  });
  if (checked) {
    page.drawLine({ start: { x: x + 2, y: y - s + 2 }, end: { x: x + s - 2, y: y - 2 }, thickness: 1.2, color: BLACK });
    page.drawLine({ start: { x: x + 2, y: y - 2 }, end: { x: x + s - 2, y: y - s + 2 }, thickness: 1.2, color: BLACK });
  }
}

// Draws a bordered form section with gray header and labeled rows.
// Returns the new y coordinate (below the box).
function drawFormSection(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  headerText: string,
  rows: { label: string; value: string }[],
  startY: number
): number {
  const HEADER_H = 18;
  const ROW_H = 22;
  const LABEL_W = 155;
  const boxH = HEADER_H + rows.length * ROW_H;
  const boxBottom = startY - boxH;

  // Header background
  page.drawRectangle({ x: ML, y: startY - HEADER_H, width: CW, height: HEADER_H, color: HEADERBG });

  // Row area background (white)
  page.drawRectangle({ x: ML, y: boxBottom, width: CW, height: boxH - HEADER_H, color: rgb(1, 1, 1) });

  // Outer border (4 lines so fills don't cover it)
  const bw = 0.75;
  page.drawLine({ start: { x: ML, y: startY }, end: { x: ML + CW, y: startY }, thickness: bw, color: BOXBORDER });
  page.drawLine({ start: { x: ML, y: boxBottom }, end: { x: ML + CW, y: boxBottom }, thickness: bw, color: BOXBORDER });
  page.drawLine({ start: { x: ML, y: boxBottom }, end: { x: ML, y: startY }, thickness: bw, color: BOXBORDER });
  page.drawLine({ start: { x: ML + CW, y: boxBottom }, end: { x: ML + CW, y: startY }, thickness: bw, color: BOXBORDER });

  // Header bottom border
  page.drawLine({ start: { x: ML, y: startY - HEADER_H }, end: { x: ML + CW, y: startY - HEADER_H }, thickness: 0.5, color: BOXBORDER });

  // Header text
  page.drawText(headerText, { x: ML + 6, y: startY - HEADER_H + 5, size: 8.5, font: bold, color: rgb(0.1, 0.1, 0.1) });

  // Rows
  let rowY = startY - HEADER_H;
  for (let i = 0; i < rows.length; i++) {
    rowY -= ROW_H;
    // Row separator (skip last row — box border covers it)
    if (i < rows.length - 1) {
      page.drawLine({ start: { x: ML, y: rowY }, end: { x: ML + CW, y: rowY }, thickness: 0.4, color: rgb(0.7, 0.7, 0.7) });
    }
    // Label/value column divider
    page.drawLine({ start: { x: ML + LABEL_W, y: rowY }, end: { x: ML + LABEL_W, y: rowY + ROW_H }, thickness: 0.4, color: rgb(0.7, 0.7, 0.7) });
    // Label
    page.drawText(rows[i].label, { x: ML + 5, y: rowY + 7, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    // Value
    if (rows[i].value) {
      page.drawText(rows[i].value, { x: ML + LABEL_W + 6, y: rowY + 7, size: 9, font, color: BLACK });
    }
  }

  return boxBottom;
}

// Wraps text at maxWidth (in points). Single words wider than maxWidth are placed on their own line.
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

// ── Wohnungsgeberbestätigung (§ 19 Abs. 3 BMG) ─────────────────────────────
export type WohnungsgeberInput = {
  wohnungsgeberName: string;
  wohnungsgeberStrasse: string;
  wohnungsgeberPlzOrt: string;
  wohnungStrasse: string;
  wohnungPlzOrt: string;
  wohnungZusatz: string;
  mieterNamen: string[];
  einzugsdatum: Date | null;
  ausstellungsdatum: Date;
  ort: string; // Ausstellungsort (Sitz der Verwaltung/Wohnungsgeber)
  unterzeichner: string;
  signature: SignatureImage;
};

export async function generateWohnungsgeberbescheinigung(input: WohnungsgeberInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(A4);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = A4[1] - 45;

  // ── Title ──────────────────────────────────────────────────────────────────
  page.drawText("Wohnungsgeberbestätigung", { x: ML, y, size: 16, font: bold, color: BLACK });

  // Legal reference box (right side, same level as title)
  const LEGAL_BOX_W = 192;
  const LEGAL_BOX_X = ML + CW - LEGAL_BOX_W;
  const legalLines = [
    "§ 19 Abs. 3 Bundesmeldegesetz (BMG):",
    "Der Wohnungsgeber oder eine von ihm",
    "beauftragte Person hat dem Mieter die",
    "Bestätigung des Einzugs unverzüglich",
    "schriftlich auszustellen.",
  ];
  const LEGAL_LINE_H = 10;
  const LEGAL_BOX_H = legalLines.length * LEGAL_LINE_H + 10;

  page.drawRectangle({
    x: LEGAL_BOX_X - 4, y: y - LEGAL_BOX_H + 4,
    width: LEGAL_BOX_W + 4, height: LEGAL_BOX_H + 2,
    borderColor: BOXBORDER, borderWidth: 0.6,
    color: rgb(0.96, 0.96, 0.96),
  });
  let ly = y - 2;
  for (let i = 0; i < legalLines.length; i++) {
    page.drawText(legalLines[i], {
      x: LEGAL_BOX_X, y: ly,
      size: 7.5,
      font: i === 0 ? bold : font,
      color: rgb(0.25, 0.25, 0.25),
    });
    ly -= LEGAL_LINE_H;
  }

  // Move below the taller of title block vs legal box
  y -= Math.max(28, LEGAL_BOX_H) + 10;

  // Separator
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.5, color: LGRAY });
  y -= 14;

  // ── Section 1: Wohnungsgeber ───────────────────────────────────────────────
  y = drawFormSection(page, font, bold, "Angaben zum Wohnungsgeber", [
    { label: "Name, Vorname / Firma", value: input.wohnungsgeberName },
    { label: "Straße, Hausnummer", value: input.wohnungsgeberStrasse },
    { label: "PLZ, Ort", value: input.wohnungsgeberPlzOrt },
  ], y);
  y -= 10;

  // ── Checkboxes: Eigentumsverhältnis ───────────────────────────────────────
  drawCheckbox(page, ML, y, true);
  page.drawText("Der Wohnungsgeber ist gleichzeitig Eigentümer der Wohnung.", {
    x: ML + 15, y: y - 8, size: 9, font, color: BLACK,
  });
  y -= 17;

  drawCheckbox(page, ML, y, false);
  page.drawText("Der Wohnungsgeber ist nicht Eigentümer. Name und Anschrift des Eigentümers:", {
    x: ML + 15, y: y - 8, size: 9, font, color: BLACK,
  });
  y -= 17;

  // Grayed-out Eigentümer sub-box (shown but empty since above checkbox applies)
  const SUB_BOX_H = 44;
  page.drawRectangle({
    x: ML + 15, y: y - SUB_BOX_H,
    width: CW - 15, height: SUB_BOX_H,
    borderColor: rgb(0.72, 0.72, 0.72), borderWidth: 0.5,
    color: rgb(0.97, 0.97, 0.97),
  });
  page.drawText("(entfällt – Wohnungsgeber ist gleichzeitig Eigentümer)", {
    x: ML + 22, y: y - SUB_BOX_H / 2 - 3,
    size: 8, font, color: rgb(0.6, 0.6, 0.6),
  });
  y -= SUB_BOX_H + 12;

  // ── Section 2: Anschrift der Wohnung ──────────────────────────────────────
  y = drawFormSection(page, font, bold, "Anschrift der Wohnung, in die eingezogen / aus der ausgezogen wird", [
    { label: "Straße, Hausnummer", value: input.wohnungStrasse },
    { label: "PLZ, Ort", value: input.wohnungPlzOrt },
    { label: "Wohnungsnummer / Zusatz", value: input.wohnungZusatz },
  ], y);
  y -= 12;

  // ── Einzug/Auszug ─────────────────────────────────────────────────────────
  const dateTxt = fmtDateShort(input.einzugsdatum);
  page.drawText(`In die oben genannte Wohnung ist/sind am  ${dateTxt}  folgende Person/en:`, {
    x: ML, y, size: 9, font, color: BLACK,
  });
  y -= 15;

  drawCheckbox(page, ML, y, true);
  page.drawText("eingezogen", { x: ML + 14, y: y - 8, size: 9, font, color: BLACK });
  drawCheckbox(page, ML + 95, y, false);
  page.drawText("ausgezogen", { x: ML + 109, y: y - 8, size: 9, font, color: BLACK });
  y -= 16;

  // ── Personentabelle ───────────────────────────────────────────────────────
  const TABLE_HEADER_H = 16;
  const TABLE_ROW_H = 18;
  const TOTAL_ROWS = 6;
  const COL1_W = Math.floor(CW / 2);
  const tableH = TABLE_HEADER_H + TOTAL_ROWS * TABLE_ROW_H;
  const tableBottom = y - tableH;

  // Table backgrounds
  page.drawRectangle({ x: ML, y: y - TABLE_HEADER_H, width: CW, height: TABLE_HEADER_H, color: HEADERBG });
  page.drawRectangle({ x: ML, y: tableBottom, width: CW, height: tableH - TABLE_HEADER_H, color: rgb(1, 1, 1) });

  // Outer border
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.75, color: BOXBORDER });
  page.drawLine({ start: { x: ML, y: tableBottom }, end: { x: ML + CW, y: tableBottom }, thickness: 0.75, color: BOXBORDER });
  page.drawLine({ start: { x: ML, y: tableBottom }, end: { x: ML, y }, thickness: 0.75, color: BOXBORDER });
  page.drawLine({ start: { x: ML + CW, y: tableBottom }, end: { x: ML + CW, y }, thickness: 0.75, color: BOXBORDER });

  // Header bottom border + column divider in header
  page.drawLine({ start: { x: ML, y: y - TABLE_HEADER_H }, end: { x: ML + CW, y: y - TABLE_HEADER_H }, thickness: 0.5, color: BOXBORDER });

  // Column divider (full height)
  page.drawLine({ start: { x: ML + COL1_W, y: tableBottom }, end: { x: ML + COL1_W, y }, thickness: 0.4, color: rgb(0.6, 0.6, 0.6) });

  // Header labels
  page.drawText("Familienname", { x: ML + 4, y: y - TABLE_HEADER_H + 4, size: 8, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("Vorname(n)", { x: ML + COL1_W + 4, y: y - TABLE_HEADER_H + 4, size: 8, font: bold, color: rgb(0.1, 0.1, 0.1) });

  // Data rows
  let rowY = y - TABLE_HEADER_H;
  for (let i = 0; i < TOTAL_ROWS; i++) {
    rowY -= TABLE_ROW_H;
    if (i < TOTAL_ROWS - 1) {
      page.drawLine({ start: { x: ML, y: rowY }, end: { x: ML + CW, y: rowY }, thickness: 0.3, color: rgb(0.76, 0.76, 0.76) });
    }
    if (i < input.mieterNamen.length) {
      const parts = input.mieterNamen[i].split(" ");
      const nachname = parts[parts.length - 1] ?? "";
      const vorname = parts.slice(0, -1).join(" ");
      page.drawText(nachname, { x: ML + 4, y: rowY + 5, size: 9, font, color: BLACK });
      if (vorname) page.drawText(vorname, { x: ML + COL1_W + 4, y: rowY + 5, size: 9, font, color: BLACK });
    }
  }
  y = tableBottom - 8;

  // "Weitere Personen" checkbox
  drawCheckbox(page, ML, y, false);
  page.drawText("weitere Personen – siehe Rückseite", { x: ML + 14, y: y - 8, size: 9, font, color: BLACK });
  y -= 20;

  // ── Rechtstext ────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.4, color: LGRAY });
  y -= 10;

  const confirmText =
    "Ich bestätige hiermit gemäß § 19 Abs. 3 BMG, dass die oben genannte(n) Person(en) in die angegebene Wohnung eingezogen ist/sind.";
  for (const l of wrapText(confirmText, bold, 9, CW)) {
    page.drawText(l, { x: ML, y, size: 9, font: bold, color: BLACK });
    y -= 13;
  }
  y -= 4;

  const warnText =
    "Gemäß § 54 Abs. 2 Nr. 6 BMG handelt ordnungswidrig, wer als Wohnungsgeber entgegen § 19 Abs. 3 eine Bestätigung nicht, nicht richtig, nicht vollständig oder nicht rechtzeitig ausstellt. Die Ordnungswidrigkeit kann mit einer Geldbuße bis zu 1.000 Euro geahndet werden.";
  for (const l of wrapText(warnText, font, 7.5, CW)) {
    page.drawText(l, { x: ML, y, size: 7.5, font, color: GRAY });
    y -= 11;
  }
  y -= 8;

  // ── Unterschrift ──────────────────────────────────────────────────────────
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.4, color: LGRAY });
  y -= 12;

  const SIG_COL = ML + CW / 2 + 10;

  page.drawText(`Ort, Datum:  ${input.ort ? `${input.ort}, ` : ""}${fmtDateShort(input.ausstellungsdatum)}`, {
    x: ML, y, size: 9, font, color: BLACK,
  });
  page.drawText("Unterschrift des Wohnungsgebers:", { x: SIG_COL, y, size: 9, font, color: BLACK });
  y -= 5;

  // Signature image
  const sigImg = await embedSignature(pdf, input.signature);
  if (sigImg) {
    const maxW = ML + CW - SIG_COL; // gesamte rechte Spaltenbreite
    const maxH = 70;
    const scale = Math.min(maxW / sigImg.width, maxH / sigImg.height);
    const w = sigImg.width * scale;
    const h = sigImg.height * scale;
    page.drawImage(sigImg, { x: SIG_COL, y: y - h, width: w, height: h });
    y -= h + 4;
  } else {
    y -= 70;
  }

  // Signature underline
  page.drawLine({ start: { x: SIG_COL, y }, end: { x: ML + CW, y }, thickness: 0.7, color: GRAY });
  y -= 11;
  page.drawText("Unterschrift des Wohnungsgebers oder des Wohnungseigentümers", {
    x: SIG_COL, y, size: 7, font, color: GRAY,
  });

  return Buffer.from(await pdf.save());
}

// ── Mietbescheinigung ──────────────────────────────────────────────────────
export type MietbescheinigungInput = {
  mieterNamen: string[];
  wohnungAnschrift: string;
  mietbeginn: Date | null;
  vermieterName: string;
  ort: string;
  ausstellungsdatum: Date;
  unterzeichner: string;
  issuer: DocumentIssuer; // Briefkopf der ausstellenden Verwaltung
  signature: SignatureImage;
};

export async function generateMietbescheinigung(input: MietbescheinigungInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(A4);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { page, font, bold, y: A4[1] - MARGIN };

  header(ctx, "Mietbescheinigung", "Bestätigung des Mietverhältnisses", input.issuer);

  line(ctx, "Mieter(in)", { bold: true, gap: 4 });
  for (const n of input.mieterNamen) line(ctx, n, { gap: 2 });
  space(ctx, 8);

  line(ctx, "Anschrift der Wohnung", { bold: true, gap: 4 });
  line(ctx, input.wohnungAnschrift, { gap: 14 });

  line(ctx, "Mietverhältnis", { bold: true, gap: 4 });
  line(ctx, `Mietbeginn: ${fmtDate(input.mietbeginn)}`, { gap: 2 });
  line(ctx, `Vermieter/Eigentümer: ${input.vermieterName}`, { gap: 16 });

  line(ctx, "Hiermit wird bestätigt, dass die oben genannte(n) Person(en) Mieter der", { gap: 2 });
  line(ctx, "genannten Wohnung ist/sind.", { gap: 18 });

  line(ctx, `${input.ort}, den ${fmtDate(input.ausstellungsdatum)}`, { gap: 4 });
  await drawSignature(pdf, ctx, input.signature, input.unterzeichner);

  return Buffer.from(await pdf.save());
}
