// Protokoll der Eigentümerversammlung.
//
// Aufgebaut auf lib/documents/kit. Das Protokoll ist der Nachweis darüber, was
// beschlossen wurde — jeder Tagesordnungspunkt trägt deshalb sein Ergebnis
// unmittelbar unter sich und wird nie davon getrennt umbrochen.
import {
  CONTENT_WIDTH,
  Doc,
  color,
  drawReportHead,
  mm,
  size,
  type LetterIssuer,
} from "./kit";
import type { RGB } from "pdf-lib";

export type ProtocolAgendaItem = {
  index: number;
  title: string;
  description: string | null;
  type: "INFO" | "BESCHLUSS";
  result: string | null; // z. B. "Angenommen (Ja 3 · Nein 1 · Enthaltung 0)"
};

export type MeetingProtocolInput = {
  propertyName: string;
  issuer: LetterIssuer;
  brand?: RGB;
  logoPath?: string | null;
  meetingTitle: string;
  scheduledAt: Date;
  location: string | null;
  // Link zur Video-Zuschaltung → Protokoll dokumentiert die hybride Teilnahme-
  // möglichkeit (§ 23 Abs. 1a WEG). Kein Streaming durch das Portal.
  videoLink?: string | null;
  attendance: string | null;
  boardMembers?: string[]; // Verwaltungsbeirat (Namen)
  items: ProtocolAgendaItem[];
  generatedAt: Date;
};

function fmtDate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function fmtDateTime(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  return `${fmtDate(d)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} Uhr`;
}

export async function generateMeetingProtocol(input: MeetingProtocolInput): Promise<Buffer> {
  const doc = await Doc.create({
    title: `Protokoll — ${input.meetingTitle}`,
    author: input.issuer.legalName,
    subject: `Protokoll der Eigentümerversammlung ${input.propertyName} vom ${fmtDate(input.scheduledAt)}`,
    brand: input.brand,
  });
  doc.newPage();

  await drawReportHead(doc, {
    issuer: input.issuer,
    logoPath: input.logoPath,
    title: "Protokoll der Eigentümerversammlung",
    subtitle: `${input.propertyName}\n${input.meetingTitle}`,
    meta: [
      ["Versammlung", fmtDate(input.scheduledAt)],
      ["Erstellt am", fmtDate(input.generatedAt)],
    ],
  });

  // ── Eckdaten ───────────────────────────────────────────────────────────────
  doc.defList(
    [
      ["Termin", fmtDateTime(input.scheduledAt)],
      ["Ort", input.location || "nicht angegeben"],
      ...(input.videoLink
        ? ([
            ["Video-Zuschaltung", input.videoLink],
            ["Form", "Hybride Versammlung (§ 23 Abs. 1a WEG)"],
          ] as [string, string][])
        : []),
      ...(input.attendance ? ([["Anwesenheit", input.attendance]] as [string, string][]) : []),
      ...(input.boardMembers?.length
        ? ([["Verwaltungsbeirat", input.boardMembers.join(", ")]] as [string, string][])
        : []),
    ],
    { labelWidth: mm(42) },
  );
  doc.space(mm(5));

  // ── Tagesordnung und Ergebnisse ────────────────────────────────────────────
  doc.text("Tagesordnung und Ergebnisse", {
    size: size.section,
    font: doc.bold,
    color: doc.brand,
    lead: mm(7),
  });

  for (const item of input.items) {
    const titel = `TOP ${item.index}: ${item.title}`;
    const ergebnis =
      item.type === "BESCHLUSS" ? `Beschluss: ${item.result ?? "offen"}` : "Zur Information";
    // Punkt, Erläuterung und Ergebnis bilden einen Block: Ein Ergebnis ohne
    // seinen Tagesordnungspunkt ist kein Protokoll.
    doc.ensure(
      doc.measure(titel, { font: doc.bold, width: CONTENT_WIDTH }) +
        (item.description
          ? doc.measure(item.description, {
              size: size.small,
              width: CONTENT_WIDTH,
              lead: mm(4.5),
            })
          : 0) +
        mm(10),
    );
    doc.para(titel, { font: doc.bold, width: CONTENT_WIDTH, lead: mm(5) });
    if (item.description) {
      doc.para(item.description, { size: size.small, color: color.muted, lead: mm(4.5) });
    }
    doc.text(ergebnis, {
      size: size.small,
      font: doc.bold,
      color: item.type === "BESCHLUSS" ? doc.brand : color.muted,
      lead: mm(7),
    });
  }

  return doc.finish({
    left: `${input.issuer.legalName} · ${input.propertyName}`,
    right: `Protokoll vom ${fmtDate(input.scheduledAt)}`,
  });
}
