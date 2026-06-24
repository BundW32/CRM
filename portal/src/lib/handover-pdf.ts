import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import path from "path";
import fs from "fs";

// ─── Types ────────────────────────────────────────────────────────────────────

type Room = {
  name: string;
  roomType: string;
  overallNote: string | null;
  wallsNote: string | null;
  ceilingNote: string | null;
  floorNote: string | null;
  windowsNote: string | null;
  doorsNote: string | null;
  heatingNote: string | null;
  sanitaryNote: string | null;
  otherNote: string | null;
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
  unit: { label: string; property: { name: string; street: string | null; zip: string | null; city: string | null } };
  tenantName: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  tenantAddress: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  managerName: string | null;
  managerEmail: string | null;
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
};

// ─── Label maps ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  EINZUG: "Einzug",
  AUSZUG: "Auszug",
  ZWISCHENZUSTAND: "Zwischenzustand",
};
const METER_LABELS: Record<string, string> = {
  STROM: "Strom",
  GAS: "Gas",
  WASSER_KALT: "Wasser kalt",
  WASSER_WARM: "Wasser warm",
  HEIZUNG: "Heizung",
  SONSTIGES: "Sonstiges",
};
const CHECKLIST_LABELS: Record<string, string> = {
  heizung: "Heizungsanlage",
  warmwasser: "Warmwasser",
  elektrik: "Elektrische Anlage",
  rauchmelder: "Rauchmelder",
  co_melder: "CO-Melder",
  kueche_einbau: "Einbaukueche",
  kueche_herd: "Herd / Kochfeld",
  kueche_spuele: "Sueule & Armaturen",
  kueche_dunstabzug: "Dunstabzugshaube",
  bad_wanne: "Badewanne / Dusche",
  bad_wc: "WC-Spuelung",
  bad_armaturen: "Armaturen",
  bad_abfluss: "Abfluesse",
  bad_schimmel: "Schimmel",
  fenster_dicht: "Fenster dicht",
  fenster_griffe: "Fenstergriffe",
  tueren_schliessen: "Tueren",
  tueren_schloesser: "Schloesser",
  rolllaeden: "Rolllaeden / Jalousien",
  waende_ok: "Waende",
  boden_ok: "Bodenbelag",
  decke_ok: "Decken",
  keller_ok: "Kellerabteil",
  garage_ok: "Garage / Stellplatz",
  briefkasten: "Briefkasten",
  benutzungshinweise: "Einweisungen",
  muell: "Besenrein uebergeben",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Keeps German umlauts (Latin-1/WinAnsi), strips non-Latin-1 chars.
function enc(s: string): string {
  return s
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/✓/g, "x")
    .replace(/[Ā-￿]/g, "?");
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

  // Section heading with left accent bar
  heading(title: string) {
    this.ensureSpace(32);
    this.y -= 8;
    // Full-width background
    this.page.drawRectangle({ x: MARGIN, y: this.y - 6, width: CONTENT_W, height: 22, color: C.gray });
    // Left accent bar
    this.page.drawRectangle({ x: MARGIN, y: this.y - 6, width: 3, height: 22, color: C.green });
    this.page.drawText(enc(title), {
      x: MARGIN + 10, y: this.y + 2, size: 10, font: this.fontBold, color: C.green,
    });
    this.y -= 20;
  }

  // Thin horizontal divider
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

// ─── Branding helpers ─────────────────────────────────────────────────────────

async function drawHeader(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  type: string,
  data: HandoverData
): Promise<number> {
  const HEADER_H = 72;
  const SUB_H = 26;

  // Main green bar
  page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: C.green });

  // Decorative orange accent strip
  page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - 3, width: PAGE_W, height: 3, color: C.orange });

  // Logo
  let logoRight = MARGIN;
  try {
    const logoPath = path.join(process.cwd(), "public", "bw-logo.png");
    const logoBytes = fs.readFileSync(logoPath);
    const logoImg = await PDFDocument.create().then((tmp) => tmp.embedPng(logoBytes).catch(() => null));
    if (logoImg) {
      const logH = 46;
      const logW = logoImg.width * (logH / logoImg.height);
      page.drawImage(logoImg, {
        x: MARGIN,
        y: PAGE_H - HEADER_H + (HEADER_H - logH) / 2,
        width: logW,
        height: logH,
      });
      logoRight = MARGIN + logW + 16;
    }
  } catch {/* no logo */}

  // Title
  page.drawText("Wohnungsübergabeprotokoll", {
    x: logoRight, y: PAGE_H - 30, size: 16, font: fontBold, color: C.white,
  });
  // Type badge
  const typeLabel = enc(TYPE_LABELS[type] ?? type);
  page.drawText(typeLabel, {
    x: logoRight, y: PAGE_H - 50, size: 10, font, color: C.orange,
  });
  // Date on right
  const dateStr = enc(data.handoverDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }));
  const dateW = fontBold.widthOfTextAtSize(dateStr, 9);
  page.drawText(dateStr, {
    x: PAGE_W - MARGIN - dateW, y: PAGE_H - 36, size: 9, font: fontBold, color: C.white,
  });

  // Sub-header: property info
  page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - SUB_H - 3, width: PAGE_W, height: SUB_H, color: C.gray });
  const prop = data.unit.property;
  const propStr = enc(
    `${prop.name} · ${data.unit.label}` +
    (prop.street ? `  –  ${prop.street}, ${prop.zip ?? ""} ${prop.city ?? ""}` : "")
  );
  page.drawText(propStr, {
    x: MARGIN, y: PAGE_H - HEADER_H - 3 - SUB_H + 8, size: 9, font: fontBold, color: C.text,
  });

  return PAGE_H - HEADER_H - 3 - SUB_H - 12;
}

function drawFooter(page: PDFPage, font: PDFFont, pageNum: number, total: number, createdAt: string) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: FOOTER_H, color: C.gray });
  page.drawRectangle({ x: 0, y: FOOTER_H - 1, width: PAGE_W, height: 1, color: C.grayMid });

  page.drawText("B&W Immobilien Management UG", {
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

  const firstPage = doc.addPage([PAGE_W, PAGE_H]);

  // Draw first page header (logo embedding requires per-doc embed)
  const HEADER_H = 72;
  const SUB_H = 26;

  // Green header bar
  firstPage.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: C.green });
  firstPage.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - 3, width: PAGE_W, height: 3, color: C.orange });

  // Logo
  let logoRight = MARGIN;
  let logoEmbedded = false;
  try {
    const logoPath = path.join(process.cwd(), "public", "bw-logo.png");
    const logoBytes = fs.readFileSync(logoPath);
    const logoImg = await doc.embedPng(logoBytes);
    const logH = 46;
    const logW = logoImg.width * (logH / logoImg.height);
    firstPage.drawImage(logoImg, {
      x: MARGIN,
      y: PAGE_H - HEADER_H + (HEADER_H - logH) / 2,
      width: logW,
      height: logH,
    });
    logoRight = MARGIN + logW + 16;
    logoEmbedded = true;
  } catch { /* logo unavailable */ }

  // Title
  firstPage.drawText("Wohnungsübergabeprotokoll", {
    x: logoRight, y: PAGE_H - 30, size: 16, font: fontBold, color: C.white,
  });
  firstPage.drawText(enc(TYPE_LABELS[data.type] ?? data.type), {
    x: logoRight, y: PAGE_H - 50, size: 10, font, color: C.orange,
  });
  const dateStr = enc(fmt(data.handoverDate));
  const dateW = fontBold.widthOfTextAtSize(dateStr, 9);
  firstPage.drawText(dateStr, {
    x: PAGE_W - MARGIN - dateW, y: PAGE_H - 36, size: 9, font: fontBold, color: C.white,
  });

  // Sub-header
  firstPage.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - SUB_H - 3, width: PAGE_W, height: SUB_H, color: C.gray });
  const prop = data.unit.property;
  const propStr = enc(
    `${prop.name} · ${data.unit.label}` +
    (prop.street ? `  –  ${prop.street}, ${prop.zip ?? ""} ${prop.city ?? ""}` : "")
  );
  firstPage.drawText(propStr, {
    x: MARGIN, y: PAGE_H - HEADER_H - 3 - SUB_H + 8, size: 9, font: fontBold, color: C.text,
  });

  const startY = PAGE_H - HEADER_H - 3 - SUB_H - 14;
  const w = new PageWriter(doc, firstPage, font, fontBold, startY);

  // ── Beteiligte ────────────────────────────────────────────────────────────

  w.heading("Beteiligte Personen");

  if (data.tenantName || data.tenantEmail || data.tenantPhone || data.tenantAddress) {
    w.space(4);
    w.text("Mieter", 9, true, C.green);
    w.row("Name", data.tenantName ?? "");
    w.row("E-Mail", data.tenantEmail ?? "");
    w.row("Telefon", data.tenantPhone ?? "");
    w.row("Neue Adresse", data.tenantAddress ?? "");
  }

  if (data.ownerName || data.ownerEmail) {
    w.space(4);
    w.text("Eigentümer", 9, true, C.green);
    w.row("Name", data.ownerName ?? "");
    w.row("E-Mail", data.ownerEmail ?? "");
  }

  if (data.managerName || data.managerEmail) {
    w.space(4);
    w.text("Protokollführer", 9, true, C.green);
    w.row("Name", data.managerName ?? "");
    w.row("E-Mail", data.managerEmail ?? "");
  }

  // ── Schlüssel & Stellplätze ────────────────────────────────────────────────

  const keyParts: string[] = [];
  if (data.keysApartment != null && data.keysApartment > 0) keyParts.push(`${data.keysApartment}x Wohnungsschluessel`);
  if (data.keysMailbox != null && data.keysMailbox > 0) keyParts.push(`${data.keysMailbox}x Briefkasten`);
  if (data.keysBasement != null && data.keysBasement > 0) keyParts.push(`${data.keysBasement}x Keller`);
  if (data.keysGarage != null && data.keysGarage > 0) keyParts.push(`${data.keysGarage}x Garage`);
  if (data.keysOther) keyParts.push(...data.keysOther.split(",").map((s) => s.trim()).filter(Boolean));

  if (keyParts.length > 0 || data.parkingSpace || data.cellarSpace) {
    w.space(4);
    w.heading("Schluessel & Stellplaetze");
    if (keyParts.length) w.row("Schluessel uebergeben", keyParts.join(", "));
    if (data.parkingSpace) w.row("Stellplatz Nr.", data.parkingSpace);
    if (data.cellarSpace) w.row("Kellerabteil Nr.", data.cellarSpace);
  }

  // ── Räume ─────────────────────────────────────────────────────────────────

  if (data.rooms.length > 0) {
    w.space(4);
    w.heading(`Raeume (${data.rooms.length})`);
    const roomNotes: { key: keyof Room; label: string }[] = [
      { key: "overallNote", label: "Allgemeiner Zustand" },
      { key: "wallsNote", label: "Waende" },
      { key: "ceilingNote", label: "Decke" },
      { key: "floorNote", label: "Boden" },
      { key: "windowsNote", label: "Fenster" },
      { key: "doorsNote", label: "Tueren" },
      { key: "heatingNote", label: "Heizung" },
      { key: "sanitaryNote", label: "Sanitaer" },
      { key: "otherNote", label: "Sonstiges" },
    ];
    for (const room of data.rooms) {
      w.ensureSpace(28);
      w.space(6);
      // Room name bar
      w.page.drawRectangle({ x: MARGIN, y: w.y - 4, width: CONTENT_W, height: 18, color: C.yellow });
      w.page.drawText(enc(room.name), { x: MARGIN + 6, y: w.y + 1, size: 9, font: fontBold, color: C.text });
      w.y -= 18;
      const anyNote = roomNotes.some((n) => room[n.key]);
      if (anyNote) {
        for (const n of roomNotes) {
          const val = room[n.key];
          if (val) w.row(n.label, String(val), true);
        }
      } else {
        w.text("  Keine Anmerkungen", 9, false, C.textLight);
      }
      if (room.photos.length > 0) {
        w.text(`  ${room.photos.length} Foto(s) dokumentiert`, 8, false, C.textLight);
      }
    }
  }

  // ── Zählerstände ──────────────────────────────────────────────────────────

  if (data.meters.length > 0) {
    w.space(4);
    w.heading("Zaehlerstaende");
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

  // ── Checkliste ────────────────────────────────────────────────────────────

  if (data.checklist && Object.keys(data.checklist).length > 0) {
    const cl = data.checklist;
    const maengelKeys = Object.keys(cl).filter((k) => !k.startsWith("note_") && cl[k] === "maengel");
    const naKeys = Object.keys(cl).filter((k) => !k.startsWith("note_") && cl[k] === "na");

    if (maengelKeys.length > 0 || naKeys.length > 0) {
      w.space(4);
      w.heading("Checkliste – Auffaelligkeiten");

      if (maengelKeys.length > 0) {
        w.space(4);
        w.text(`Maengel (${maengelKeys.length})`, 9, true, rgb(0.7, 0.5, 0));
        for (const k of maengelKeys) {
          const note = cl[`note_${k}`];
          const label = CHECKLIST_LABELS[k] ?? enc(k.replace(/_/g, " "));
          w.text(`  ! ${label}${note ? `:  ${enc(note)}` : ""}`, 9, false, C.text);
        }
      }
      if (naKeys.length > 0) {
        w.space(4);
        w.text(`Nicht vorhanden (${naKeys.length})`, 9, true, C.textLight);
        for (const k of naKeys) {
          w.text(`  – ${CHECKLIST_LABELS[k] ?? enc(k.replace(/_/g, " "))}`, 9, false, C.textLight);
        }
      }
    }
  }

  // ── Anmerkungen & Vereinbarungen ──────────────────────────────────────────

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

  // ── Unterschriften ────────────────────────────────────────────────────────

  w.space(12);
  w.heading("Unterschriften");
  w.space(8);

  if (data.tenantSignature) {
    await w.embedSignature(data.tenantSignature, "Unterschrift Mieter");
  } else {
    w.blankSignatureLine("Mieter");
  }

  w.space(14);

  if (data.managerSignature) {
    await w.embedSignature(data.managerSignature, "Unterschrift Verwalter / Eigentümer");
  } else {
    w.blankSignatureLine("Verwalter / Eigentümer");
  }

  // ── Footer on every page ─────────────────────────────────────────────────

  const pages = doc.getPages();
  const total = pages.length;
  const createdAt = new Date().toLocaleDateString("de-DE");
  for (let i = 0; i < total; i++) {
    drawFooter(pages[i], font, i + 1, total, createdAt);
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
