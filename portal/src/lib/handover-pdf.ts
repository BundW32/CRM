import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import path from "path";
import fs from "fs";
import {
  checksForRoomType,
  ALL_ROOM_CHECK_LABELS,
  GENERAL_CHECKLIST_LABELS,
  ROOM_TYPE_LABELS,
} from "@/lib/handover-checks";
import { encodeWinAnsi } from "@/lib/documents/pdf-text";

// ─── Types ────────────────────────────────────────────────────────────────────

type Room = {
  name: string;
  roomType: string;
  checks: unknown; // { key: "ok"|"maengel"|"na", note_key: "…" }
  overallNote: string | null;
  photos: { storedName: string }[];
};

type Meter = {
  meterType: string;
  meterNumber: string | null;
  reading: string | null;
  readingDate: Date;
  notes: string | null;
};

type HandoverData = {
  type: string;
  handoverDate: Date;
  moveDate: Date | null;
  unit: { label: string; floor: string | null; property: { name: string; street: string | null; zip: string | null; city: string | null } };
  livingArea: number | null;
  roomCount: number | null;
  personCount: number | null;
  tenantName: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  tenantAddress: string | null;
  tenantBirthDate: Date | null;
  tenant2Name: string | null;
  tenant2BirthDate: Date | null;
  tenant2Signature: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  managerCompany: string | null;
  managerName: string | null;
  managerEmail: string | null;
  managerPhone: string | null;
  keysApartment: number | null;
  keysMailbox: number | null;
  keysBasement: number | null;
  keysGarage: number | null;
  keysOther: string | null;
  parkingSpace: string | null;
  cellarSpace: string | null;
  checklist: Record<string, string> | null;
  generalNotes: string | null;
  agreements: string | null;
  tenantSignature: string | null;
  managerSignature: string | null;
  rooms: Room[];
  meters: Meter[];
  // Fallback-Firmenname (Org-Branding), falls managerCompany leer ist.
  fallbackCompany?: string | null;
};

// ─── Brand ────────────────────────────────────────────────────────────────────

const C = {
  green:      rgb(0,       0.212,  0.188),  // #003630
  greenDark:  rgb(0,       0.141,  0.122),  // #00241f
  greenLight: rgb(0.047,   0.325,  0.290),  // #0c534a
  orange:     rgb(0.965,   0.565,  0.094),  // #f69018
  white:      rgb(1,       1,      1),
  text:       rgb(0.1,     0.1,    0.1),
  textLight:  rgb(0.45,    0.45,   0.45),
  gray:       rgb(0.965,   0.965,  0.965),
  grayMid:    rgb(0.87,    0.87,   0.87),
  yellow:     rgb(1,       0.95,   0.8),
  amber:      rgb(0.7,     0.5,    0),
};

const DEFAULT_COMPANY = "B&W Immobilien Management UG";

// ─── Label maps ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  EINZUG: "Einzug",
  AUSZUG: "Auszug",
  ZWISCHENZUSTAND: "Zwischenzustand",
};
const MOVE_DATE_LABELS: Record<string, string> = {
  EINZUG: "Einzugsdatum",
  AUSZUG: "Auszugsdatum",
  ZWISCHENZUSTAND: "Stichtag",
};
const TENANT_ADDRESS_LABELS: Record<string, string> = {
  EINZUG: "Vorherige Anschrift",
  AUSZUG: "Neue Anschrift",
  ZWISCHENZUSTAND: "Anschrift",
};
const METER_LABELS: Record<string, string> = {
  STROM: "Strom",
  GAS: "Gas",
  WASSER_KALT: "Wasser kalt",
  WASSER_WARM: "Wasser warm",
  HEIZUNG: "Heizung",
  SONSTIGES: "Sonstiges",
};
const STATE_LABELS: Record<string, string> = {
  ok: "in Ordnung",
  maengel: "Mängel",
  na: "nicht vorhanden",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtOpt(d: Date | null): string {
  return d ? fmt(new Date(d)) : "—";
}
function numFmt(n: number | null): string {
  return n != null ? String(n).replace(".", ",") : "";
}

// Macht Text für die Standard-Schrift (WinAnsi) sicher – inkl. astraler Emoji,
// die der frühere Bereichs-Filter nicht erfasst hat. Siehe lib/documents/pdf-text.
function enc(s: string): string {
  return encodeWinAnsi(s);
}

// ─── PageWriter ───────────────────────────────────────────────────────────────

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 28;

class PageWriter {
  private doc: PDFDocument;
  page: PDFPage;
  private font: PDFFont;
  private fontBold: PDFFont;
  y: number;
  private readonly lineH = 15;
  private readonly startY: number;

  constructor(doc: PDFDocument, page: PDFPage, font: PDFFont, fontBold: PDFFont, startY: number) {
    this.doc = doc;
    this.page = page;
    this.font = font;
    this.fontBold = fontBold;
    this.startY = startY;
    this.y = startY;
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN - 10;
  }

  ensureSpace(needed = 20) {
    if (this.y - needed < MARGIN + FOOTER_H + 8) this.newPage();
  }

  text(t: string, size = 9, bold = false, color = C.text, x = MARGIN) {
    this.ensureSpace(this.lineH);
    this.page.drawText(enc(t), { x, y: this.y, size, font: bold ? this.fontBold : this.font, color });
    this.y -= this.lineH;
  }

  private wrap(t: string, size: number, maxW: number, f: PDFFont): string[] {
    const lines: string[] = [];
    for (const raw of t.split(/\r?\n/)) {
      const words = raw.split(/\s+/).filter(Boolean);
      let cur = "";
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (cur && f.widthOfTextAtSize(test, size) > maxW) { lines.push(cur); cur = w; }
        else cur = test;
      }
      lines.push(cur || "");
    }
    return lines.length ? lines : [""];
  }

  paragraph(t: string, size = 9, indent = 0) {
    const maxW = CONTENT_W - indent;
    for (const line of this.wrap(enc(t), size, maxW, this.font)) {
      this.ensureSpace(this.lineH);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font: this.font, color: C.text });
      this.y -= this.lineH;
    }
  }

  row(label: string, value: string, indented = false) {
    if (!value) return;
    const labelX = MARGIN + (indented ? 10 : 0);
    const valueX = labelX + 140;
    const maxW = PAGE_W - MARGIN - valueX;
    const lines = this.wrap(enc(value), 9, maxW, this.font);
    this.ensureSpace(this.lineH * lines.length);
    this.page.drawText(enc(label) + ":", {
      x: labelX, y: this.y, size: 9, font: this.fontBold, color: C.textLight,
    });
    lines.forEach((l, i) => {
      this.page.drawText(l, {
        x: valueX, y: this.y - i * this.lineH, size: 9, font: this.font, color: C.text,
      });
    });
    this.y -= this.lineH * lines.length;
  }

  // Section heading: light gray bg + dark text + green left accent bar
  heading(title: string) {
    this.ensureSpace(32);
    this.y -= 8;
    this.page.drawRectangle({ x: MARGIN, y: this.y - 6, width: CONTENT_W, height: 22, color: C.gray });
    this.page.drawRectangle({ x: MARGIN, y: this.y - 6, width: 4, height: 22, color: C.green });
    this.page.drawText(enc(title), {
      x: MARGIN + 12, y: this.y + 2, size: 10, font: this.fontBold, color: C.text,
    });
    this.y -= 20;
  }

  divider() {
    this.ensureSpace(8);
    this.y -= 3;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT_W, y: this.y },
      thickness: 0.4,
      color: C.grayMid,
    });
    this.y -= 5;
  }

  space(n = 8) { this.y -= n; }

  async embedSignature(dataUrl: string, label: string) {
    try {
      const base64 = dataUrl.split(",")[1];
      if (!base64) return;
      const bytes = Buffer.from(base64, "base64");
      const img = await this.doc.embedPng(bytes);
      const maxW = 200, maxH = 70;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const sW = img.width * scale, sH = img.height * scale;
      this.ensureSpace(sH + 36);
      this.text(label, 8, true, C.textLight);
      this.page.drawImage(img, { x: MARGIN, y: this.y - sH, width: sW, height: sH });
      this.page.drawLine({
        start: { x: MARGIN, y: this.y - sH - 2 },
        end: { x: MARGIN + Math.max(sW, 170), y: this.y - sH - 2 },
        thickness: 0.5, color: C.grayMid,
      });
      this.page.drawText(enc(label.replace("Unterschrift ", "")), {
        x: MARGIN, y: this.y - sH - 12, size: 8, font: this.font, color: C.textLight,
      });
      this.y -= sH + 20;
    } catch {
      this.text(`[${label}: Unterschrift konnte nicht eingebettet werden]`, 9);
    }
  }

  blankSignatureLine(label: string) {
    this.ensureSpace(52);
    this.text(label, 8, true, C.textLight);
    this.space(36);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y + 4 },
      end: { x: MARGIN + 200, y: this.y + 4 },
      thickness: 0.5, color: C.grayMid,
    });
    this.page.drawText(enc(label.replace("Unterschrift ", "")), {
      x: MARGIN, y: this.y - 4, size: 8, font: this.font, color: C.textLight,
    });
    this.y -= 8;
  }
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function drawFooter(page: PDFPage, font: PDFFont, pageNum: number, total: number, createdAt: string, company: string) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: FOOTER_H, color: C.gray });
  page.drawRectangle({ x: 0, y: FOOTER_H - 1, width: PAGE_W, height: 1, color: C.grayMid });

  page.drawText(enc(company), {
    x: MARGIN, y: 10, size: 7, font, color: C.textLight,
  });

  const right = enc(`Seite ${pageNum} / ${total}  |  Erstellt am ${createdAt}`);
  const rw = font.widthOfTextAtSize(right, 7);
  page.drawText(right, {
    x: PAGE_W - MARGIN - rw, y: 10, size: 7, font, color: C.textLight,
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateHandoverPdfBuffer(data: HandoverData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const company =
    (data.managerCompany ?? "").trim() || (data.fallbackCompany ?? "").trim() || DEFAULT_COMPANY;

  const firstPage = doc.addPage([PAGE_W, PAGE_H]);

  const HEADER_H = 72;
  const SUB_H = 26;

  // Green header bar + orange accent strip
  firstPage.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: C.green });
  firstPage.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - 3, width: PAGE_W, height: 3, color: C.orange });

  // Logo — auf weißer, abgerundeter Fläche, damit ein opaker PNG-Hintergrund
  // nicht hart gegen das dunkle Grün abgeschnitten wirkt.
  let logoRight = MARGIN;
  try {
    const logoPath = path.join(process.cwd(), "public", "bw-logo.png");
    const logoBytes = fs.readFileSync(logoPath);
    const logoImg = await doc.embedPng(logoBytes);
    const logH = 44;
    const logW = logoImg.width * (logH / logoImg.height);
    const pillPad = 6;
    const pillX = MARGIN - pillPad;
    const pillY = PAGE_H - HEADER_H + (HEADER_H - logH) / 2 - pillPad;
    firstPage.drawRectangle({
      x: pillX, y: pillY,
      width: logW + pillPad * 2, height: logH + pillPad * 2,
      color: C.white,
      borderRadius: 6,
    } as Parameters<PDFPage["drawRectangle"]>[0]);
    firstPage.drawImage(logoImg, {
      x: MARGIN,
      y: PAGE_H - HEADER_H + (HEADER_H - logH) / 2,
      width: logW,
      height: logH,
    });
    logoRight = MARGIN + logW + pillPad * 2 + 10;
  } catch { /* logo unavailable */ }

  // Title + Typ
  firstPage.drawText("Wohnungsübergabeprotokoll", {
    x: logoRight, y: PAGE_H - 30, size: 16, font: fontBold, color: C.white,
  });
  firstPage.drawText(enc(TYPE_LABELS[data.type] ?? data.type), {
    x: logoRight, y: PAGE_H - 50, size: 10, font, color: C.orange,
  });
  // Protokolldatum oben rechts
  const dateStr = enc(`Protokoll: ${fmt(data.handoverDate)}`);
  const dateW = font.widthOfTextAtSize(dateStr, 9);
  firstPage.drawText(dateStr, {
    x: PAGE_W - MARGIN - dateW, y: PAGE_H - 36, size: 9, font: fontBold, color: C.white,
  });

  // Sub-header: Objektzeile
  firstPage.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - SUB_H - 3, width: PAGE_W, height: SUB_H, color: C.gray });
  const prop = data.unit.property;
  const propStr = enc(
    `${prop.name} · ${data.unit.label}` +
    (prop.street ? `  -  ${prop.street}, ${prop.zip ?? ""} ${prop.city ?? ""}` : "")
  );
  firstPage.drawText(propStr, {
    x: MARGIN, y: PAGE_H - HEADER_H - 3 - SUB_H + 8, size: 9, font: fontBold, color: C.text,
  });

  const startY = PAGE_H - HEADER_H - 3 - SUB_H - 14;
  const w = new PageWriter(doc, firstPage, font, fontBold, startY);

  // ── Eckdaten ───────────────────────────────────────────────────────────────

  w.heading("Eckdaten der Übergabe");
  w.space(4);
  w.row("Art der Übergabe", TYPE_LABELS[data.type] ?? data.type);
  w.row("Protokolldatum", fmt(data.handoverDate));
  if (data.moveDate) w.row(MOVE_DATE_LABELS[data.type] ?? "Übergabedatum", fmtOpt(data.moveDate));
  if (data.livingArea != null) w.row("Wohnfläche", `${numFmt(data.livingArea)} m²`);
  if (data.roomCount != null) w.row("Zimmer", numFmt(data.roomCount));
  if (data.personCount != null) w.row("Personen im Haushalt", String(data.personCount));
  if (data.unit.floor) w.row("Etage", data.unit.floor);

  // ── Beteiligte ─────────────────────────────────────────────────────────────

  w.heading("Beteiligte Personen");

  if (data.tenantName || data.tenantEmail || data.tenantPhone || data.tenantAddress || data.tenantBirthDate) {
    w.space(4);
    w.text("Mieter", 9, true, C.green);
    w.row("Name", data.tenantName ?? "");
    if (data.tenantBirthDate) w.row("Geburtsdatum", fmtOpt(data.tenantBirthDate));
    w.row("E-Mail", data.tenantEmail ?? "");
    w.row("Telefon", data.tenantPhone ?? "");
    w.row(TENANT_ADDRESS_LABELS[data.type] ?? "Anschrift", data.tenantAddress ?? "");
  }

  if (data.tenant2Name) {
    w.space(4);
    w.text("2. Mieter / Mitbewohner", 9, true, C.green);
    w.row("Name", data.tenant2Name);
    if (data.tenant2BirthDate) w.row("Geburtsdatum", fmtOpt(data.tenant2BirthDate));
  }

  if (data.ownerName || data.ownerEmail || data.ownerPhone) {
    w.space(4);
    w.text("Eigentümer", 9, true, C.green);
    w.row("Name", data.ownerName ?? "");
    w.row("E-Mail", data.ownerEmail ?? "");
    w.row("Telefon", data.ownerPhone ?? "");
  }

  if (company || data.managerName || data.managerEmail) {
    w.space(4);
    w.text("Verwaltung & Protokollführer", 9, true, C.green);
    w.row("Verwaltung", company);
    w.row("Protokollführer", data.managerName ?? "");
    w.row("E-Mail", data.managerEmail ?? "");
    w.row("Telefon", data.managerPhone ?? "");
  }

  // ── Schlüssel & Stellplätze ────────────────────────────────────────────────

  const keyParts: string[] = [];
  if (data.keysApartment != null && data.keysApartment > 0) keyParts.push(`${data.keysApartment}x Wohnungsschlüssel`);
  if (data.keysMailbox != null && data.keysMailbox > 0) keyParts.push(`${data.keysMailbox}x Briefkasten`);
  if (data.keysBasement != null && data.keysBasement > 0) keyParts.push(`${data.keysBasement}x Keller`);
  if (data.keysGarage != null && data.keysGarage > 0) keyParts.push(`${data.keysGarage}x Garage`);
  if (data.keysOther) keyParts.push(...data.keysOther.split(",").map((s) => s.trim()).filter(Boolean));

  if (keyParts.length > 0 || data.parkingSpace || data.cellarSpace) {
    w.space(4);
    w.heading("Schlüssel & Stellplätze");
    if (keyParts.length) w.row("Schlüssel übergeben", keyParts.join(", "));
    if (data.parkingSpace) w.row("Stellplatz Nr.", data.parkingSpace);
    if (data.cellarSpace) w.row("Kellerabteil Nr.", data.cellarSpace);
  }

  // ── Räume ──────────────────────────────────────────────────────────────────

  if (data.rooms.length > 0) {
    w.space(4);
    w.heading(`Räume (${data.rooms.length})`);
    for (const room of data.rooms) {
      w.ensureSpace(30);
      w.space(6);
      // Raum-Kopfzeile
      w.page.drawRectangle({ x: MARGIN, y: w.y - 4, width: CONTENT_W, height: 18, color: C.gray });
      w.page.drawText(enc(room.name), { x: MARGIN + 6, y: w.y + 1, size: 9, font: fontBold, color: C.text });
      const rtLabel = ROOM_TYPE_LABELS[room.roomType] ?? "";
      if (rtLabel) {
        const rw = font.widthOfTextAtSize(rtLabel, 8);
        w.page.drawText(enc(rtLabel), { x: MARGIN + CONTENT_W - rw - 6, y: w.y + 2, size: 8, font, color: C.textLight });
      }
      w.y -= 18;

      const checks = (room.checks ?? {}) as Record<string, string>;
      const points = checksForRoomType(room.roomType);
      const flagged = points.filter(
        (p) => checks[p.key] === "maengel" || checks[p.key] === "na" || checks[`note_${p.key}`],
      );

      if (flagged.length === 0 && !room.overallNote) {
        w.text("  Keine Mängel festgestellt", 9, false, C.textLight);
      } else {
        for (const p of flagged) {
          const state = checks[p.key];
          const note = checks[`note_${p.key}`];
          const value = [state ? STATE_LABELS[state] ?? state : "", note].filter(Boolean).join(" - ");
          w.row(ALL_ROOM_CHECK_LABELS[p.key] ?? p.label, value, true);
        }
        if (room.overallNote) w.row("Anmerkung", room.overallNote, true);
      }
      if (room.photos.length > 0) {
        w.text(`  ${room.photos.length} Foto(s) dokumentiert`, 8, false, C.textLight);
      }
    }
  }

  // ── Zählerstände ───────────────────────────────────────────────────────────

  if (data.meters.length > 0) {
    w.space(4);
    w.heading("Zählerstände");
    for (const m of data.meters) {
      const label = METER_LABELS[m.meterType] ?? m.meterType;
      const parts: string[] = [];
      if (m.meterNumber) parts.push(`Nr. ${m.meterNumber}`);
      if (m.reading) parts.push(`Stand: ${m.reading}`);
      parts.push(`Datum: ${fmt(new Date(m.readingDate))}`);
      if (m.notes) parts.push(m.notes);
      w.row(label, parts.join("  |  "));
    }
  }

  // ── Allgemeine Checkliste ──────────────────────────────────────────────────

  if (data.checklist && Object.keys(data.checklist).length > 0) {
    const cl = data.checklist;
    const maengelKeys = Object.keys(cl).filter((k) => !k.startsWith("note_") && cl[k] === "maengel");
    const naKeys = Object.keys(cl).filter((k) => !k.startsWith("note_") && cl[k] === "na");

    if (maengelKeys.length > 0 || naKeys.length > 0) {
      w.space(4);
      w.heading("Checkliste - Auffälligkeiten");

      if (maengelKeys.length > 0) {
        w.space(4);
        w.text(`Mängel (${maengelKeys.length})`, 9, true, C.amber);
        for (const k of maengelKeys) {
          const note = cl[`note_${k}`];
          const label = GENERAL_CHECKLIST_LABELS[k] ?? k.replace(/_/g, " ");
          w.text(`  ! ${label}${note ? `:  ${note}` : ""}`, 9, false, C.text);
        }
      }
      if (naKeys.length > 0) {
        w.space(4);
        w.text(`Nicht vorhanden (${naKeys.length})`, 9, true, C.textLight);
        for (const k of naKeys) {
          w.text(`  - ${GENERAL_CHECKLIST_LABELS[k] ?? k.replace(/_/g, " ")}`, 9, false, C.textLight);
        }
      }
    }
  }

  // ── Anmerkungen & Vereinbarungen ───────────────────────────────────────────

  if (data.generalNotes || data.agreements) {
    w.space(4);
    w.heading("Anmerkungen & Vereinbarungen");
    if (data.generalNotes) {
      w.space(4);
      w.text("Allgemeine Anmerkungen:", 9, true);
      w.paragraph(data.generalNotes, 9, 8);
    }
    if (data.agreements) {
      w.space(4);
      w.text("Getroffene Vereinbarungen:", 9, true);
      w.paragraph(data.agreements, 9, 8);
    }
  }

  // ── Unterschriften ─────────────────────────────────────────────────────────

  w.space(12);
  w.heading("Unterschriften");
  w.space(8);

  if (data.tenantSignature) {
    await w.embedSignature(data.tenantSignature, "Unterschrift Mieter");
  } else {
    w.blankSignatureLine("Mieter");
  }

  if (data.tenant2Name) {
    w.space(14);
    if (data.tenant2Signature) {
      await w.embedSignature(data.tenant2Signature, "Unterschrift 2. Mieter");
    } else {
      w.blankSignatureLine("2. Mieter");
    }
  }

  w.space(14);

  const mgrLabel = `Protokollführer${data.managerName ? ` (${data.managerName})` : ""}`;
  if (data.managerSignature) {
    await w.embedSignature(data.managerSignature, `Unterschrift ${mgrLabel}`);
  } else {
    w.blankSignatureLine(mgrLabel);
  }

  // ── Footer auf jeder Seite ─────────────────────────────────────────────────

  const pages = doc.getPages();
  const total = pages.length;
  const createdAt = new Date().toLocaleDateString("de-DE");
  for (let i = 0; i < total; i++) {
    drawFooter(pages[i], font, i + 1, total, createdAt, company);
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
