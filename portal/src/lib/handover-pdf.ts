import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";

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
  generalNotes: string | null;
  agreements: string | null;
  tenantSignature: string | null;
  managerSignature: string | null;
  rooms: Room[];
  meters: Meter[];
};

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

function fmt(d: Date) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

class PageWriter {
  private doc: PDFDocument;
  private page: PDFPage;
  private font: PDFFont;
  private fontBold: PDFFont;
  private y: number;
  private readonly margin = 50;
  private readonly pageWidth = 595;
  private readonly pageHeight = 842;
  private readonly lineHeight = 16;

  constructor(doc: PDFDocument, page: PDFPage, font: PDFFont, fontBold: PDFFont) {
    this.doc = doc;
    this.page = page;
    this.font = font;
    this.fontBold = fontBold;
    this.y = this.pageHeight - this.margin;
  }

  private newPage() {
    this.page = this.doc.addPage([this.pageWidth, this.pageHeight]);
    this.y = this.pageHeight - this.margin;
  }

  private ensureSpace(needed = 20) {
    if (this.y - needed < this.margin + 40) this.newPage();
  }

  text(text: string, size = 10, bold = false, color = rgb(0.1, 0.1, 0.1)) {
    this.ensureSpace(this.lineHeight);
    this.page.drawText(text.replace(/[^\x00-\x7E]/g, (c) => {
      const map: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss", "·": "-", "→": "->", "✓": "OK" };
      return map[c] ?? "?";
    }), {
      x: this.margin,
      y: this.y,
      size,
      font: bold ? this.fontBold : this.font,
      color,
    });
    this.y -= this.lineHeight;
  }

  heading(text: string) {
    this.ensureSpace(30);
    this.y -= 6;
    this.page.drawRectangle({
      x: this.margin,
      y: this.y - 4,
      width: this.pageWidth - this.margin * 2,
      height: 20,
      color: rgb(0.95, 0.95, 0.95),
    });
    this.text(text, 11, true);
    this.y -= 4;
  }

  row(label: string, value: string) {
    if (!value) return;
    this.ensureSpace(this.lineHeight);
    this.page.drawText(label.replace(/[^\x00-\x7E]/g, (c) => {
      const map: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" };
      return map[c] ?? "?";
    }) + ":", {
      x: this.margin,
      y: this.y,
      size: 9,
      font: this.fontBold,
      color: rgb(0.4, 0.4, 0.4),
    });
    this.page.drawText(value.replace(/[^\x00-\x7E]/g, (c) => {
      const map: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" };
      return map[c] ?? "?";
    }), {
      x: this.margin + 150,
      y: this.y,
      size: 9,
      font: this.font,
      color: rgb(0.1, 0.1, 0.1),
    });
    this.y -= this.lineHeight;
  }

  space(n = 8) {
    this.y -= n;
  }

  getY() { return this.y; }
  getPage() { return this.page; }

  async embedSignature(dataUrl: string, label: string) {
    try {
      const base64 = dataUrl.split(",")[1];
      if (!base64) return;
      const bytes = Buffer.from(base64, "base64");
      const img = await this.doc.embedPng(bytes);
      const sigW = 200;
      const sigH = 60;
      this.ensureSpace(sigH + 30);
      this.text(label, 9, true);
      this.page.drawImage(img, {
        x: this.margin,
        y: this.y - sigH,
        width: sigW,
        height: sigH,
      });
      this.page.drawRectangle({
        x: this.margin,
        y: this.y - sigH,
        width: sigW,
        height: sigH,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
      });
      this.y -= sigH + 10;
    } catch {
      this.text(`[${label}: Unterschrift konnte nicht eingebettet werden]`, 9);
    }
  }
}

export async function generateHandoverPdfBuffer(data: HandoverData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595, 842]);
  const w = new PageWriter(doc, page, font, fontBold);

  // Title
  page.drawRectangle({ x: 0, y: 792, width: 595, height: 50, color: rgb(0, 0.21, 0.19) });
  page.drawText("Wohnungsuebergabeprotokoll", { x: 50, y: 812, size: 16, font: fontBold, color: rgb(1, 1, 1) });
  w["y"] = 775;

  w.space(10);
  w.heading("Allgemeine Angaben");
  w.row("Typ", TYPE_LABELS[data.type] ?? data.type);
  w.row("Datum", fmt(data.handoverDate));
  w.row("Objekt", `${data.unit.property.name}${data.unit.property.street ? `, ${data.unit.property.street}` : ""}`);
  w.row("Einheit", data.unit.label);

  w.space();
  w.heading("Mieter");
  w.row("Name", data.tenantName ?? "");
  w.row("E-Mail", data.tenantEmail ?? "");
  w.row("Telefon", data.tenantPhone ?? "");
  w.row("Neue Adresse", data.tenantAddress ?? "");

  w.space();
  w.heading("Eigentuemer");
  w.row("Name", data.ownerName ?? "");
  w.row("E-Mail", data.ownerEmail ?? "");

  w.space();
  w.heading("Verwalter");
  w.row("Name", data.managerName ?? "");
  w.row("E-Mail", data.managerEmail ?? "");

  // Keys
  const keyParts: string[] = [];
  if (data.keysApartment != null) keyParts.push(`${data.keysApartment}x Wohnung`);
  if (data.keysMailbox != null) keyParts.push(`${data.keysMailbox}x Briefkasten`);
  if (data.keysBasement != null) keyParts.push(`${data.keysBasement}x Keller`);
  if (data.keysGarage != null) keyParts.push(`${data.keysGarage}x Garage`);
  if (data.keysOther) keyParts.push(data.keysOther);

  if (keyParts.length > 0 || data.parkingSpace || data.cellarSpace) {
    w.space();
    w.heading("Schluessel & Stellplaetze");
    if (keyParts.length) w.row("Schluessel", keyParts.join(", "));
    if (data.parkingSpace) w.row("Stellplatz", data.parkingSpace);
    if (data.cellarSpace) w.row("Kellerabteil", data.cellarSpace);
  }

  // Rooms
  if (data.rooms.length > 0) {
    w.space();
    w.heading("Raeume");
    for (const room of data.rooms) {
      w.space(6);
      w.text(`${room.name}`, 10, true);
      if (room.overallNote) w.row("Zustand", room.overallNote);
      if (room.wallsNote) w.row("Waende", room.wallsNote);
      if (room.ceilingNote) w.row("Decke", room.ceilingNote);
      if (room.floorNote) w.row("Boden", room.floorNote);
      if (room.windowsNote) w.row("Fenster", room.windowsNote);
      if (room.doorsNote) w.row("Tueren", room.doorsNote);
      if (room.heatingNote) w.row("Heizung", room.heatingNote);
      if (room.sanitaryNote) w.row("Sanitaer", room.sanitaryNote);
      if (room.otherNote) w.row("Sonstiges", room.otherNote);
      if (room.photos.length > 0) w.row("Fotos", `${room.photos.length} Foto(s) vorhanden`);
    }
  }

  // Meters
  if (data.meters.length > 0) {
    w.space();
    w.heading("Zaehlerstaende");
    for (const m of data.meters) {
      const parts: string[] = [];
      if (m.meterNumber) parts.push(`Nr. ${m.meterNumber}`);
      if (m.reading) parts.push(`Stand: ${m.reading}`);
      parts.push(`Datum: ${fmt(new Date(m.readingDate))}`);
      if (m.notes) parts.push(m.notes);
      w.row(METER_LABELS[m.meterType] ?? m.meterType, parts.join(" | "));
    }
  }

  // Notes & agreements
  if (data.generalNotes || data.agreements) {
    w.space();
    w.heading("Anmerkungen & Vereinbarungen");
    if (data.generalNotes) {
      w.text("Allgemeine Anmerkungen:", 9, true);
      w.text(data.generalNotes.slice(0, 300), 9);
      w.space(4);
    }
    if (data.agreements) {
      w.text("Vereinbarungen:", 9, true);
      w.text(data.agreements.slice(0, 300), 9);
    }
  }

  // Signatures
  w.space(20);
  w.heading("Unterschriften");
  w.space(8);
  if (data.tenantSignature) {
    await w.embedSignature(data.tenantSignature, "Mieter");
  } else {
    w.text("Unterschrift Mieter:", 9, true);
    w.space(40);
    w.getPage().drawLine({ start: { x: 50, y: w.getY() + 5 }, end: { x: 250, y: w.getY() + 5 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
  }
  w.space(10);
  if (data.managerSignature) {
    await w.embedSignature(data.managerSignature, "Verwalter / Eigentuemer");
  } else {
    w.text("Unterschrift Verwalter:", 9, true);
    w.space(40);
    w.getPage().drawLine({ start: { x: 50, y: w.getY() + 5 }, end: { x: 250, y: w.getY() + 5 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
  }

  // Footer
  const allPages = doc.getPages();
  const totalPages = allPages.length;
  for (let i = 0; i < totalPages; i++) {
    const p = allPages[i];
    p.drawText(`Seite ${i + 1} von ${totalPages}  |  Erstellt am ${fmt(new Date())}`, {
      x: 50,
      y: 30,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
