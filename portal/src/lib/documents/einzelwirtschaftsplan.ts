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
import { hausgeldRoundingLabels } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { ueberdeckungsText, type Monatsraten } from "@/lib/weg/economic-plan";
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
  /**
   * Jahresvorschuss (= Σ Anteile, Ausgaben − Einnahmen), die zwölf Monatsraten
   * und die Überdeckung, die durch das Aufrunden der Rate entsteht.
   */
  raten: Monatsraten;
};

export type EinzelwirtschaftsplanInput = {
  propertyName: string;
  issuer: LetterIssuer;
  brand?: RGB;
  /** Pfad zu einer PNG-Datei oder die Bilddaten selbst (Mandantenlogo). */
  logo?: string | Uint8Array | null;
  year: number;
  resolved: { date: Date; note: string | null } | null; // null = Entwurf
  units: EinzelplanUnit[];
  generatedAt: Date;
};

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

const HINWEIS_KOPF =
  "Der Jahresvorschuss ist Ihr Anteil an den geplanten Kosten der Gemeinschaft, vermindert um " +
  "geplante Einnahmen. Er wird in zwölf Monatsraten erhoben. Maßgeblich ist der beschlossene " +
  "Wirtschaftsplan.";

/**
 * Der Hinweis unter dem Betrag — er muss zu den Zahlen darüber passen.
 *
 * Bei centgenauer Rundung erklärt er die ungleichen Raten, bei aufgerundeter
 * Rate die Überdeckung. Der Satz zur Überdeckung kommt wörtlich aus
 * `ueberdeckungsText`, damit Portal und PDF nicht zwei Fassungen desselben
 * Sachverhalts zeigen.
 */
function hinweisFuer(raten: Monatsraten): string {
  if (raten.rounding === "CENT") {
    return (
      `${HINWEIS_KOPF} Restcents verteilen sich auf die ersten Monate, deshalb kann eine Rate ` +
      "um einen Cent abweichen."
    );
  }
  const ausweis = ueberdeckungsText(raten);
  const stufe = hausgeldRoundingLabels[raten.rounding];
  if (!ausweis) {
    return `${HINWEIS_KOPF} Die Rate ist ${stufe} gerundet; alle zwölf Raten sind gleich hoch.`;
  }
  return (
    `${HINWEIS_KOPF} Die Rate ist ${stufe} aufgerundet, damit alle zwölf Raten gleich hoch sind ` +
    `und Ihr Dauerauftrag das ganze Jahr passt: ${ausweis} ` +
    "Die Gemeinschaft behält den Betrag nicht — er ist Ihr Guthaben (§ 28 Abs. 2 WEG)."
  );
}

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
      logo: input.logo,
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
    doc.amountRow("Jahresvorschuss", formatCents(unit.raten.annualCents), { strong: true });
    // Zwölf gerundete Raten ergeben mehr als der Jahresvorschuss. Diese Zeile
    // steht direkt darunter, weil dort die Frage entsteht: Wer die Rate mit
    // zwölf multipliziert, kommt auf eine andere Zahl als die Zeile darüber.
    if (unit.raten.overpayCents > 0) {
      doc.amountRow(
        `Summe der zwölf Raten (gerundet, Überdeckung ${formatCents(unit.raten.overpayCents)})`,
        formatCents(unit.raten.billedCents),
      );
    }
    doc.space(mm(2));

    const min = Math.min(...unit.raten.rates);
    const max = Math.max(...unit.raten.rates);
    doc.amountPanel(
      "Monatliches Hausgeld",
      min === max ? formatCents(max) : `${formatCents(min)} – ${formatCents(max)}`,
      { sub: "Fällig jeweils zum 1. eines Monats", tone: "due" },
    );

    doc.space(mm(2));
    doc.para(hinweisFuer(unit.raten), {
      size: size.foot,
      color: color.muted,
      width: CONTENT_WIDTH,
      lead: mm(4),
    });
  }

  return doc.finish({
    left: input.issuer.legalName,
    right: input.resolved
      ? `Einzelwirtschaftsplan ${input.year}`
      : `Einzelwirtschaftsplan ${input.year} (Entwurf)`,
  });
}
