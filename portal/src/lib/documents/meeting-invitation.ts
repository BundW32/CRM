// Einladung zur Eigentümerversammlung als DIN-A4-Brief.
//
// Aufgebaut auf lib/documents/kit (DIN 5008 Form B). Ohne Empfängerangaben
// entsteht ein neutraler Vorlagendruck („An alle Eigentümerinnen und
// Eigentümer") — den nutzt die Verwaltung für den Aushang und den Selbstdruck.
import { briefAnrede, anschriftZeilen, type Empfaenger } from "./anrede";
import { INVITATION_MIN_WEEKS } from "@/lib/weg/meeting-invitation";
import {
  CONTENT_WIDTH,
  Doc,
  color,
  drawLetterHead,
  mm,
  size,
  type LetterIssuer,
} from "./kit";
import type { RGB } from "pdf-lib";

export type InvitationAgendaItem = {
  index: number;
  title: string;
  description: string | null;
  type: "INFO" | "BESCHLUSS";
};

export type MeetingInvitationInput = {
  issuer: LetterIssuer;
  brand?: RGB;
  /** Pfad zu einer PNG-Datei oder die Bilddaten selbst (Mandantenlogo). */
  logo?: string | Uint8Array | null;
  propertyName: string;
  meetingTitle: string;
  scheduledAt: Date;
  location: string | null;
  videoLink: string | null;
  agenda: InvitationAgendaItem[];
  /** Ohne Empfänger entsteht ein neutraler Vorlagendruck. */
  recipient?: Empfaenger | null;
  /** „Straße\nPLZ Ort" */
  recipientAddress?: string | null;
  /** Ortsangabe der Datumszeile. */
  city: string | null;
  createdAt: Date;
};

function fmtDate(value: Date): string {
  return `${String(value.getDate()).padStart(2, "0")}.${String(value.getMonth() + 1).padStart(2, "0")}.${value.getFullYear()}`;
}
function fmtDateTime(value: Date): string {
  return `${fmtDate(value)}, ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")} Uhr`;
}

export async function generateMeetingInvitation(
  input: MeetingInvitationInput,
): Promise<Buffer> {
  const doc = await Doc.create({
    title: `Einladung — ${input.meetingTitle}`,
    author: input.issuer.legalName,
    subject: `Eigentümerversammlung ${input.propertyName} am ${fmtDate(input.scheduledAt)}`,
    brand: input.brand,
  });
  doc.newPage();

  await drawLetterHead(doc, {
    issuer: input.issuer,
    logo: input.logo,
    returnLine: [input.issuer.legalName, input.issuer.lines[0]].filter(Boolean).join(" · "),
    recipient: {
      lines: input.recipient
        ? anschriftZeilen(input.recipient, input.recipientAddress)
        : ["An alle Eigentümerinnen und Eigentümer", `der ${input.propertyName}`],
    },
    infoBlock: [
      ["Objekt", input.propertyName],
      ["Versammlung", fmtDate(input.scheduledAt)],
      ["Datum", `${input.city ? `${input.city}, ` : ""}${fmtDate(input.createdAt)}`],
    ],
  });

  doc.subject("Einladung zur Eigentümerversammlung", input.meetingTitle);
  doc.text(
    input.recipient
      ? briefAnrede(input.recipient)
      : "Sehr geehrte Eigentümerinnen und Eigentümer,",
    { lead: mm(7) },
  );
  doc.para(
    `hiermit laden wir Sie zur Eigentümerversammlung der ${input.propertyName} ein. Die ` +
      `Ladungsfrist von mindestens ${INVITATION_MIN_WEEKS} Wochen nach § 24 Abs. 4 WEG ist ` +
      `gewahrt.`,
  );
  doc.space(mm(4));

  // ── Eckdaten ───────────────────────────────────────────────────────────────
  doc.defList(
    [
      ["Termin", fmtDateTime(input.scheduledAt)],
      ["Ort", input.location || "wird noch bekannt gegeben"],
      // Die hybride Teilnahme ist seit § 23 Abs. 1a WEG zulässig, muss aber
      // beschlossen sein — das Portal streamt nicht selbst.
      ...(input.videoLink ? ([["Video-Zuschaltung", input.videoLink]] as [string, string][]) : []),
    ],
    { labelWidth: mm(42) },
  );
  doc.space(mm(5));

  // ── Tagesordnung ───────────────────────────────────────────────────────────
  doc.text("Tagesordnung", { size: size.section, font: doc.bold, color: doc.brand, lead: mm(7) });

  if (input.agenda.length === 0) {
    doc.para("Die Tagesordnung wird noch ergänzt.", { color: color.muted });
  } else {
    for (const item of input.agenda) {
      // Punkt und Erläuterung gehören zusammen — ein TOP, dessen Erklärung auf
      // der nächsten Seite steht, ist schwer zu lesen.
      doc.ensure(mm(16));
      doc.para(
        `TOP ${item.index}: ${item.title}${item.type === "BESCHLUSS" ? "  (Beschlussfassung)" : ""}`,
        { font: doc.bold, width: CONTENT_WIDTH, lead: mm(5) },
      );
      if (item.description) {
        doc.para(item.description, { size: size.small, color: color.muted, lead: mm(4.5) });
      }
      doc.space(mm(2));
    }
  }
  doc.space(mm(2));

  // ── Hinweise und Gruß ──────────────────────────────────────────────────────
  // Hinweise, Grußformel und Absender bilden EINEN Block — gemessen, nicht
  // geschätzt: Eine zu knappe Reserve ließ den Gruß auf Seite 1 und den
  // Firmennamen allein auf Seite 2 zurück, eine zu großzügige brach um, obwohl
  // alles gepasst hätte.
  const hinweise =
    "Sind Sie am Termin verhindert, können Sie sich vertreten lassen; die Vollmacht ist " +
    "schriftlich zu erteilen und zu Beginn der Versammlung vorzulegen. Über Punkte, die " +
    "nicht angekündigt sind, kann kein Beschluss gefasst werden (§ 23 Abs. 2 WEG) — " +
    "Ergänzungen zur Tagesordnung teilen Sie uns daher bitte vor dem Termin mit.";
  doc.ensure(doc.measure(hinweise) + mm(4) + mm(10) + doc.measure(input.issuer.legalName));
  doc.para(hinweise);
  doc.space(mm(4));
  doc.text("Mit freundlichen Grüßen", { lead: mm(10) });
  doc.para(input.issuer.legalName, { width: CONTENT_WIDTH });

  return doc.finish({
    left: input.issuer.legalName,
    right: `Erstellt am ${fmtDate(input.createdAt)}`,
  });
}
