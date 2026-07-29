// Wohnungsübergabeprotokoll (Einzug, Auszug, Zwischenzustand).
//
// Aufgebaut auf lib/documents/kit. Vorher trug diese Datei eine eigene
// `PageWriter`-Klasse mit eigenen Rändern (42 pt statt 20 mm), eigener Fußzeile
// und eigenem Kopf mit randabfallendem Farbbalken — den schneidet jeder
// Bürodrucker ab, und die Maße passten zu keinem anderen Dokument des Portals.
import {
  CONTENT_WIDTH,
  Doc,
  color,
  drawReportHead,
  mm,
  size,
} from "@/lib/documents/kit";
import type { RGB } from "pdf-lib";
import {
  checksForRoomType,
  ALL_ROOM_CHECK_LABELS,
  GENERAL_CHECKLIST_LABELS,
  ROOM_TYPE_LABELS,
} from "@/lib/handover-checks";

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
  /** Mandantenfarbe aus dem Branding. */
  brand?: RGB;
  /** Pfad zu einer PNG-Datei oder die Bilddaten selbst (Mandantenlogo). */
  logo?: string | Uint8Array | null;
  /** Kontaktzeilen der Verwaltung für den Kopf. */
  issuerLines?: string[];
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

/** Eine Unterschrift aus dem Formular kommt als Data-URL. */
function signatureBytes(dataUrl: string | null): Uint8Array | null {
  if (!dataUrl) return null;
  const base64 = dataUrl.split(",")[1];
  if (!base64) return null;
  try {
    return new Uint8Array(Buffer.from(base64, "base64"));
  } catch {
    return null;
  }
}

/** Nur belegte Zeilen — leere Felder sollen keine leeren Zeilen erzeugen. */
function rows(entries: [string, string | null | undefined][]): [string, string][] {
  return entries.filter(
    (entry): entry is [string, string] => Boolean(entry[1] && String(entry[1]).trim()),
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateHandoverPdfBuffer(data: HandoverData): Promise<Buffer> {
  const company =
    (data.managerCompany ?? "").trim() || (data.fallbackCompany ?? "").trim() || DEFAULT_COMPANY;
  const prop = data.unit.property;
  const objektAnschrift = prop.street
    ? `${prop.street}, ${prop.zip ?? ""} ${prop.city ?? ""}`.trim()
    : "";

  const doc = await Doc.create({
    title: `Wohnungsübergabeprotokoll — ${prop.name}, ${data.unit.label}`,
    author: company,
    subject: `${TYPE_LABELS[data.type] ?? data.type} am ${fmt(data.handoverDate)}`,
    brand: data.brand,
    // Das Protokoll wird vor Ort unterschrieben und ausgehändigt.
    marks: false,
  });
  doc.newPage();

  await drawReportHead(doc, {
    // Der Firmenname bleibt `managerCompany`: Das ist die Verwaltung, die DIESE
    // Übergabe protokolliert hat — nicht zwingend der Mandant, dem das Portal
    // gehört. Farbe, Logo und Kontaktzeilen kommen dagegen aus dem Branding.
    issuer: { legalName: company, lines: data.issuerLines ?? [] },
    logo: data.logo,
    title: "Wohnungsübergabeprotokoll",
    subtitle: [`${prop.name} · ${data.unit.label}`, objektAnschrift].filter(Boolean).join("\n"),
    status: { text: TYPE_LABELS[data.type] ?? data.type, tone: "neutral" },
    meta: [
      ["Protokolldatum", fmt(data.handoverDate)],
      ...(data.moveDate
        ? ([[MOVE_DATE_LABELS[data.type] ?? "Übergabedatum", fmtOpt(data.moveDate)]] as [
            string,
            string,
          ][])
        : []),
    ],
  });

  // ── Eckdaten ───────────────────────────────────────────────────────────────
  doc.section("Eckdaten der Übergabe");
  doc.defList(
    rows([
      ["Art der Übergabe", TYPE_LABELS[data.type] ?? data.type],
      ["Protokolldatum", fmt(data.handoverDate)],
      data.moveDate
        ? [MOVE_DATE_LABELS[data.type] ?? "Übergabedatum", fmtOpt(data.moveDate)]
        : ["", null],
      data.livingArea != null ? ["Wohnfläche", `${numFmt(data.livingArea)} m²`] : ["", null],
      data.roomCount != null ? ["Zimmer", numFmt(data.roomCount)] : ["", null],
      data.personCount != null ? ["Personen im Haushalt", String(data.personCount)] : ["", null],
      ["Etage", data.unit.floor],
    ]),
    { labelWidth: mm(48) },
  );

  // ── Beteiligte ─────────────────────────────────────────────────────────────
  doc.section("Beteiligte Personen");

  const gruppe = (titel: string, eintraege: [string, string][]) => {
    if (eintraege.length === 0) return;
    // Überschrift und erste Zeile bleiben zusammen.
    doc.ensure(mm(12));
    doc.text(titel, { size: size.small, font: doc.bold, color: doc.brand, lead: mm(5) });
    doc.defList(eintraege, { labelWidth: mm(44), indent: mm(4) });
    doc.space(mm(3));
  };

  gruppe(
    "Mieter",
    rows([
      ["Name", data.tenantName],
      data.tenantBirthDate ? ["Geburtsdatum", fmtOpt(data.tenantBirthDate)] : ["", null],
      ["E-Mail", data.tenantEmail],
      ["Telefon", data.tenantPhone],
      [TENANT_ADDRESS_LABELS[data.type] ?? "Anschrift", data.tenantAddress],
    ]),
  );
  gruppe(
    "2. Mieter / Mitbewohner",
    rows([
      ["Name", data.tenant2Name],
      data.tenant2BirthDate ? ["Geburtsdatum", fmtOpt(data.tenant2BirthDate)] : ["", null],
    ]),
  );
  gruppe(
    "Eigentümer",
    rows([
      ["Name", data.ownerName],
      ["E-Mail", data.ownerEmail],
      ["Telefon", data.ownerPhone],
    ]),
  );
  gruppe(
    "Verwaltung und Protokollführer",
    rows([
      ["Verwaltung", company],
      ["Protokollführer", data.managerName],
      ["E-Mail", data.managerEmail],
      ["Telefon", data.managerPhone],
    ]),
  );

  // ── Schlüssel und Stellplätze ──────────────────────────────────────────────
  const keyParts: string[] = [];
  if (data.keysApartment != null && data.keysApartment > 0) keyParts.push(`${data.keysApartment}× Wohnungsschlüssel`);
  if (data.keysMailbox != null && data.keysMailbox > 0) keyParts.push(`${data.keysMailbox}× Briefkasten`);
  if (data.keysBasement != null && data.keysBasement > 0) keyParts.push(`${data.keysBasement}× Keller`);
  if (data.keysGarage != null && data.keysGarage > 0) keyParts.push(`${data.keysGarage}× Garage`);
  if (data.keysOther) keyParts.push(...data.keysOther.split(",").map((s) => s.trim()).filter(Boolean));

  if (keyParts.length > 0 || data.parkingSpace || data.cellarSpace) {
    doc.section("Schlüssel und Stellplätze");
    doc.defList(
      rows([
        ["Schlüssel übergeben", keyParts.join(", ")],
        ["Stellplatz Nr.", data.parkingSpace],
        ["Kellerabteil Nr.", data.cellarSpace],
      ]),
      { labelWidth: mm(48) },
    );
  }

  // ── Räume ──────────────────────────────────────────────────────────────────
  if (data.rooms.length > 0) {
    doc.section(`Räume (${data.rooms.length})`);
    for (const room of data.rooms) {
      const checks = (room.checks ?? {}) as Record<string, string>;
      const points = checksForRoomType(room.roomType);
      const flagged = points.filter(
        (p) => checks[p.key] === "maengel" || checks[p.key] === "na" || checks[`note_${p.key}`],
      );

      // Raumname und erster Befund bleiben zusammen — ein Mangel ohne seinen
      // Raum ist im Streitfall wertlos.
      doc.ensure(mm(16));
      doc.space(mm(1));
      // Die Typbezeichnung nur, wenn sie etwas hinzufügt — bei „Wohnzimmer /
      // Wohnzimmer" stand sie doppelt da.
      const typLabel = ROOM_TYPE_LABELS[room.roomType] ?? "";
      const raumTyp = typLabel.toLowerCase() === room.name.trim().toLowerCase() ? "" : typLabel;
      doc.text(room.name, { font: doc.bold, lead: raumTyp ? mm(4.2) : mm(5.5) });
      if (raumTyp) doc.text(raumTyp, { size: size.foot, color: color.muted, lead: mm(5) });

      if (flagged.length === 0 && !room.overallNote) {
        doc.text("Keine Mängel festgestellt", {
          size: size.small,
          color: color.muted,
          x: mm(24),
          lead: mm(5),
        });
      } else {
        doc.defList(
          [
            ...flagged.map((p): [string, string] => [
              ALL_ROOM_CHECK_LABELS[p.key] ?? p.label,
              [checks[p.key] ? (STATE_LABELS[checks[p.key]] ?? checks[p.key]) : "", checks[`note_${p.key}`]]
                .filter(Boolean)
                .join(" — "),
            ]),
            ...(room.overallNote ? ([["Anmerkung", room.overallNote]] as [string, string][]) : []),
          ],
          { labelWidth: mm(52), indent: mm(4) },
        );
      }
      if (room.photos.length > 0) {
        doc.text(`${room.photos.length} Foto(s) dokumentiert`, {
          size: size.foot,
          color: color.muted,
          x: mm(24),
          lead: mm(5),
        });
      }
      doc.space(mm(2));
    }
  }

  // ── Zählerstände ───────────────────────────────────────────────────────────
  if (data.meters.length > 0) {
    doc.section("Zählerstände");
    doc.table(
      [
        { header: "Zähler", width: 22 },
        { header: "Zählernummer", width: 24 },
        { header: "Stand", width: 20 },
        { header: "Ablesedatum", width: 20 },
      ],
      data.meters.map((m) => [
        { text: METER_LABELS[m.meterType] ?? m.meterType },
        { text: m.meterNumber ?? "—" },
        { text: m.reading ?? "—" },
        { text: fmt(new Date(m.readingDate)) },
      ]),
    );
    const notizen = data.meters.filter((m) => m.notes);
    if (notizen.length > 0) {
      doc.space(mm(2));
      doc.defList(
        notizen.map((m): [string, string] => [
          METER_LABELS[m.meterType] ?? m.meterType,
          m.notes as string,
        ]),
        { labelWidth: mm(38) },
      );
    }
  }

  // ── Allgemeine Checkliste ──────────────────────────────────────────────────
  if (data.checklist && Object.keys(data.checklist).length > 0) {
    const cl = data.checklist;
    const maengelKeys = Object.keys(cl).filter((k) => !k.startsWith("note_") && cl[k] === "maengel");
    const naKeys = Object.keys(cl).filter((k) => !k.startsWith("note_") && cl[k] === "na");

    if (maengelKeys.length > 0 || naKeys.length > 0) {
      doc.section("Checkliste — Auffälligkeiten");
      if (maengelKeys.length > 0) {
        doc.text(`Mängel (${maengelKeys.length})`, {
          size: size.small,
          font: doc.bold,
          color: color.due,
          lead: mm(5),
        });
        doc.defList(
          maengelKeys.map((k): [string, string] => [
            GENERAL_CHECKLIST_LABELS[k] ?? k.replace(/_/g, " "),
            cl[`note_${k}`] ?? "Mangel festgestellt",
          ]),
          { labelWidth: mm(60), indent: mm(4) },
        );
        doc.space(mm(3));
      }
      if (naKeys.length > 0) {
        doc.text(`Nicht vorhanden (${naKeys.length})`, {
          size: size.small,
          font: doc.bold,
          color: color.muted,
          lead: mm(5),
        });
        for (const k of naKeys) {
          doc.text(GENERAL_CHECKLIST_LABELS[k] ?? k.replace(/_/g, " "), {
            size: size.small,
            color: color.muted,
            x: mm(24),
            lead: mm(5),
          });
        }
      }
    }
  }

  // ── Anmerkungen und Vereinbarungen ─────────────────────────────────────────
  if (data.generalNotes || data.agreements) {
    doc.section("Anmerkungen und Vereinbarungen");
    if (data.generalNotes) {
      doc.text("Allgemeine Anmerkungen", {
        size: size.small,
        font: doc.bold,
        color: color.muted,
        lead: mm(5),
      });
      doc.para(data.generalNotes, { width: CONTENT_WIDTH });
      doc.space(mm(3));
    }
    if (data.agreements) {
      doc.text("Getroffene Vereinbarungen", {
        size: size.small,
        font: doc.bold,
        color: color.muted,
        lead: mm(5),
      });
      doc.para(data.agreements, { width: CONTENT_WIDTH });
    }
  }

  // ── Unterschriften ─────────────────────────────────────────────────────────
  // Überschrift und erste Unterschrift bleiben zusammen — sonst steht
  // „Unterschriften" allein am Seitenfuß und das Feld auf der Folgeseite.
  doc.space(mm(4));
  doc.ensure(mm(55));
  doc.section("Unterschriften");
  await doc.signature(signatureBytes(data.tenantSignature), `Mieter${data.tenantName ? ` — ${data.tenantName}` : ""}`);
  if (data.tenant2Name) {
    doc.space(mm(6));
    await doc.signature(signatureBytes(data.tenant2Signature), `2. Mieter — ${data.tenant2Name}`);
  }
  doc.space(mm(6));
  await doc.signature(
    signatureBytes(data.managerSignature),
    `Protokollführer${data.managerName ? ` — ${data.managerName}` : ""}`,
  );

  return doc.finish({
    left: `${company} · ${prop.name}, ${data.unit.label}`,
    right: `Übergabe ${TYPE_LABELS[data.type] ?? data.type} am ${fmt(data.handoverDate)}`,
  });
}
