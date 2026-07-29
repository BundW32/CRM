// **Einzelwirtschaftsplan** (§ 28 Abs. 1 WEG): je Einheit eine Seite mit der
// Aufschlüsselung des Jahresvorschusses nach Kostenposition, dem
// Verteilerschlüssel, dem eigenen Anteil und der Monatsrate.
//
// Abgrenzung zu `wirtschaftsplan.ts`: Das dortige Dokument ist der **Gesamt**plan
// samt Übersichtstabelle aller Einheiten — jeder Eigentümer sah dort eine Summe,
// nicht ihre Zusammensetzung, und nebenbei das Hausgeld aller anderen. Das Gesetz
// verlangt beides: Gesamtplan *und* Einzelwirtschaftspläne.
//
// Aufgebaut auf lib/documents/kit.
import { formatCents } from "@/lib/money";
import {
  CONTENT_WIDTH,
  Doc,
  color,
  drawReportHead,
  mm,
  size,
  type LetterIssuer,
  type TableCell,
} from "./kit";
import type { RGB } from "pdf-lib";

export type EinzelplanPosition = {
  name: string;
  keyLabel: string;
  /** Gesamtbetrag der Position im Objekt. */
  totalCents: number;
  /** Anteil dieser Einheit — bei Einnahmen negativ. */
  shareCents: number;
};

export type EinzelplanUnit = {
  label: string;
  /** Aktuelle Eigentümer der Einheit, für die Anschrift. */
  ownerNames: string[];
  positions: EinzelplanPosition[];
  /** Jahresvorschuss = Σ Anteile (Ausgaben − Einnahmen). */
  annualCents: number;
  monthlyCents: number[];
};

export type EinzelwirtschaftsplanInput = {
  propertyName: string;
  issuer: LetterIssuer;
  brand?: RGB;
  logoPath?: string | null;
  year: number;
  resolved: { date: Date; note: string | null } | null; // null = Entwurf
  units: EinzelplanUnit[];
  generatedAt: Date;
};

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

const HINWEIS =
  "Der Jahresvorschuss ist Ihr Anteil an den geplanten Kosten der Gemeinschaft, vermindert um " +
  "geplante Einnahmen. Er wird in zwölf Monatsraten erhoben; Restcents verteilen sich auf die " +
  "ersten Monate, deshalb kann eine Rate um einen Cent abweichen. Maßgeblich ist der " +
  "beschlossene Wirtschaftsplan.";

export async function generateEinzelwirtschaftsplaene(
  input: EinzelwirtschaftsplanInput,
): Promise<Buffer> {
  const doc = await Doc.create({
    title: `Einzelwirtschaftsplan ${input.year} — ${input.propertyName}`,
    author: input.issuer.legalName,
    subject: `Einzelwirtschaftspläne nach § 28 Abs. 1 WEG, ${input.propertyName}`,
    brand: input.brand,
  });

  for (const unit of input.units) {
    // Jede Einheit beginnt auf einer eigenen Seite: Die Seiten werden einzeln
    // versandt, und der Anteil eines fremden Eigentümers hat auf dem Blatt
    // nichts zu suchen.
    doc.newPage();

    await drawReportHead(doc, {
      issuer: input.issuer,
      logoPath: input.logoPath,
      title: `Einzelwirtschaftsplan ${input.year}`,
      subtitle: [input.propertyName, unit.label, unit.ownerNames.join(", ")]
        .filter(Boolean)
        .join(" · "),
      status: input.resolved
        ? {
            text: `Beschlossen am ${fmtDate(input.resolved.date)}${input.resolved.note ? ` (${input.resolved.note})` : ""}`,
            tone: "final",
          }
        : { text: "Entwurf — noch nicht beschlossen", tone: "draft" },
      meta: [
        ["Einheit", unit.label],
        ["Erstellt am", fmtDate(input.generatedAt)],
      ],
    });

    doc.table(
      [
        { header: "Kostenposition", width: 44 },
        { header: "Umlageschlüssel", width: 34 },
        { header: "Ihr Anteil", width: 22, align: "right" },
      ],
      // Positionen ohne Anteil bleiben stehen: „steht nicht drin" beantwortet
      // die Frage, warum ein Posten fehlt.
      unit.positions.map((p): TableCell[] => [
        { text: p.name },
        { text: p.keyLabel, color: color.muted },
        { text: formatCents(p.shareCents) },
      ]),
    );

    doc.rule({ gapAbove: mm(2), gapBelow: mm(4) });
    doc.amountRow("Jahresvorschuss", formatCents(unit.annualCents), { strong: true });
    doc.space(mm(2));

    const min = Math.min(...unit.monthlyCents);
    const max = Math.max(...unit.monthlyCents);
    doc.amountPanel(
      "Monatliches Hausgeld",
      min === max ? formatCents(max) : `${formatCents(min)} – ${formatCents(max)}`,
      { sub: "Fällig jeweils zum 1. eines Monats", tone: "due" },
    );

    doc.space(mm(2));
    doc.para(HINWEIS, { size: size.foot, color: color.muted, width: CONTENT_WIDTH, lead: mm(4) });
  }

  return doc.finish({
    left: input.issuer.legalName,
    right: input.resolved
      ? `Einzelwirtschaftsplan ${input.year}`
      : `Einzelwirtschaftsplan ${input.year} (Entwurf)`,
  });
}
