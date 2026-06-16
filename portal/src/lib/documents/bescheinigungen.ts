// Automatische Erstellung von Standard-Bescheinigungen als PDF (pdf-lib).
// Inhalte richten sich nach den gesetzlichen Vorgaben (z. B. § 19 BMG).
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const GREEN = rgb(0, 0.21, 0.19);
const GRAY = rgb(0.3, 0.3, 0.3);

export type SignatureImage = { bytes: Uint8Array; mime: string } | null;

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
  if (signature) {
    try {
      const img = signature.mime.includes("png")
        ? await pdf.embedPng(signature.bytes)
        : await pdf.embedJpg(signature.bytes);
      const w = 140;
      const h = (img.height / img.width) * w;
      ctx.page.drawImage(img, { x: MARGIN, y: ctx.y - h + 14, width: w, height: h });
      ctx.y -= h;
    } catch {
      /* ungültiges Bild ignorieren */
    }
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

function header(ctx: Ctx, title: string, subtitle: string) {
  ctx.page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GREEN });
  line(ctx, "B & W Immobilien Management UG (haftungsbeschränkt)", { size: 10, bold: true, color: GREEN, gap: 2 });
  line(ctx, "Goethestraße 42 · 45964 Gladbeck · info@bundwimmobilien.de", { size: 8, color: GRAY, gap: 16 });
  line(ctx, title, { size: 16, bold: true, gap: 4 });
  line(ctx, subtitle, { size: 10, color: GRAY, gap: 16 });
}

// ── Wohnungsgeberbestätigung (§ 19 Abs. 3 BMG) ─────────────────────────────
export type WohnungsgeberInput = {
  wohnungsgeberName: string;
  wohnungsgeberAnschrift: string;
  wohnungAnschrift: string;
  mieterNamen: string[];
  einzugsdatum: Date | null;
  ort: string;
  ausstellungsdatum: Date;
  unterzeichner: string;
  signature: SignatureImage;
};

export async function generateWohnungsgeberbescheinigung(input: WohnungsgeberInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(A4);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { page, font, bold, y: A4[1] - MARGIN };

  header(
    ctx,
    "Wohnungsgeberbestätigung",
    "gemäß § 19 Abs. 3 Bundesmeldegesetz (BMG)"
  );

  line(ctx, "Wohnungsgeber (Vermieter/Eigentümer)", { bold: true, gap: 4 });
  line(ctx, input.wohnungsgeberName);
  line(ctx, input.wohnungsgeberAnschrift, { gap: 14 });

  line(ctx, "Art des meldepflichtigen Vorgangs", { bold: true, gap: 4 });
  line(ctx, `[X] Einzug   am: ${fmtDate(input.einzugsdatum)}`, { gap: 2 });
  line(ctx, "[ ] Auszug", { gap: 14 });

  line(ctx, "Anschrift der Wohnung", { bold: true, gap: 4 });
  line(ctx, input.wohnungAnschrift, { gap: 14 });

  line(ctx, "Meldepflichtige Person(en)", { bold: true, gap: 4 });
  for (const n of input.mieterNamen) line(ctx, n, { gap: 2 });
  space(ctx, 12);

  line(
    ctx,
    "Hiermit wird gemäß § 19 BMG bestätigt, dass die oben genannte(n) Person(en)",
    { gap: 2 }
  );
  line(ctx, "in die genannte Wohnung eingezogen ist/sind.", { gap: 18 });

  line(ctx, `${input.ort}, den ${fmtDate(input.ausstellungsdatum)}`, { gap: 4 });
  await drawSignature(pdf, ctx, input.signature, input.unterzeichner);

  space(ctx, 18);
  line(ctx, "Diese Bestätigung ist der Meldebehörde bei der Anmeldung vorzulegen.", { size: 8, color: GRAY });

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
  signature: SignatureImage;
};

export async function generateMietbescheinigung(input: MietbescheinigungInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(A4);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { page, font, bold, y: A4[1] - MARGIN };

  header(ctx, "Mietbescheinigung", "Bestätigung des Mietverhältnisses");

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
