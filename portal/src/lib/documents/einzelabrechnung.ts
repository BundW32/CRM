// Einzelabrechnung je Einheit (§ 28 Abs. 2 WEG).
//
// Eine A4-Seite je Einheit: Kostenanteile nach Umlageschlüsseln, Abrechnungs-
// spitze (Nachschuss/Guthaben), § 35a-Ausweis, tagesgenaue Eigentümerangabe.
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

export type EinzelabrechnungOwner = { name: string; days: number; cents: number };
export type EinzelabrechnungCostRow = {
  name: string;
  keyLabel: string;
  totalCents: number;
  shareCents: number;
};
export type EinzelabrechnungUnit = {
  label: string;
  owners: EinzelabrechnungOwner[];
  uncoveredCents: number;
  costRows: EinzelabrechnungCostRow[];
  kostenanteilCents: number;
  sollCents: number;
  peakCents: number; // + Nachschuss, − Guthaben
  laborHaushaltsnahCents: number;
  laborHandwerkerCents: number;
  /** Anteil an Kosten, für die kein Lohnanteil erfasst ist (§ 35a EStG). */
  laborUnerfasstCents: number;
};
export type EinzelabrechnungInput = {
  propertyName: string;
  issuer: LetterIssuer;
  brand?: RGB;
  /** Pfad zu einer PNG-Datei oder die Bilddaten selbst (Mandantenlogo). */
  logo?: string | Uint8Array | null;
  year: number;
  periodLabel: string; // "01.01.2026 – 31.12.2026"
  finalizedAt: Date | null; // null = Entwurf
  units: EinzelabrechnungUnit[];
  generatedAt: Date;
};

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export async function generateEinzelabrechnungen(input: EinzelabrechnungInput): Promise<Buffer> {
  const doc = await Doc.create({
    title: `Einzelabrechnung ${input.year} — ${input.propertyName}`,
    author: input.issuer.legalName,
    subject: `Einzelabrechnungen nach § 28 Abs. 2 WEG, ${input.propertyName}`,
    brand: input.brand,
  });

  for (const unit of input.units) {
    // Je Einheit eine eigene Seite: Die Blätter werden einzeln versandt.
    doc.newPage();

    const eigentuemer =
      unit.owners.length > 0
        ? unit.owners.map((o) => `${o.name} (${o.days} Tage)`).join(", ")
        : "kein Eigentümer erfasst";

    await drawReportHead(doc, {
      issuer: input.issuer,
      logo: input.logo,
      title: `Einzelabrechnung ${input.year}`,
      subtitle: `${input.propertyName} · Einheit ${unit.label}\nEigentümer: ${eigentuemer}`,
      status: input.finalizedAt
        ? { text: `Geprüft und abgeschlossen am ${fmtDate(input.finalizedAt)}`, tone: "final" }
        : { text: "Entwurf — noch in Bearbeitung", tone: "draft" },
      meta: [
        ["Wirtschaftsjahr", input.periodLabel],
        ["Einheit", unit.label],
      ],
    });

    doc.table(
      [
        { header: "Position", width: 38 },
        { header: "Umlageschlüssel", width: 30 },
        { header: "Gesamtkosten", width: 18, align: "right" },
        { header: "Ihr Anteil", width: 18, align: "right" },
      ],
      unit.costRows.map((row): TableCell[] => [
        { text: row.name },
        { text: row.keyLabel, color: color.muted },
        { text: formatCents(row.totalCents), color: color.muted },
        { text: formatCents(row.shareCents) },
      ]),
    );

    // ── Ergebniskette ────────────────────────────────────────────────────────
    doc.rule({ gapAbove: mm(2), gapBelow: mm(4) });
    doc.amountRow("Ihr Kostenanteil (Ist)", formatCents(unit.kostenanteilCents), { strong: true });
    doc.amountRow("Ihre Soll-Vorschüsse (Hausgeld)", formatCents(unit.sollCents));
    doc.space(mm(1));

    const nachschuss = unit.peakCents > 0;
    doc.amountPanel(
      nachschuss
        ? "Nachschuss (§ 28 Abs. 2 WEG)"
        : unit.peakCents < 0
          ? "Guthaben"
          : "Ausgeglichen",
      formatCents(Math.abs(unit.peakCents)),
      {
        sub: nachschuss
          ? "Fällig erst mit dem Beschluss der Eigentümerversammlung"
          : unit.peakCents < 0
            ? "Wird mit der nächsten Hausgeldzahlung verrechnet"
            : null,
        tone: nachschuss ? "due" : "credit",
      },
    );

    // ── § 35a EStG ───────────────────────────────────────────────────────────
    if (
      unit.laborHaushaltsnahCents > 0 ||
      unit.laborHandwerkerCents > 0 ||
      unit.laborUnerfasstCents > 0
    ) {
      // Die Lücke wird benannt, nicht geschätzt: Eine erfundene Zahl sähe
      // amtlich aus und hielte keiner Rückfrage des Finanzamts stand.
      // Kein „Muster —" davor: Diese Zahlen sind die Abrechnung dieser Einheit,
      // keine Vorlage. Der Vorbehalt zur Steuerberatung bleibt, er trifft zu.
      const erlaeuterung =
        unit.laborUnerfasstCents > 0
          ? "Ausgewiesen ist nur der Lohn-, Fahrt- und Maschinenkostenanteil — nur er ist " +
            `begünstigt, Material nicht. Für ${formatCents(unit.laborUnerfasstCents)} Ihres ` +
            "Kostenanteils liegt dieser Anteil nicht vor; er ist oben deshalb NICHT enthalten. " +
            "Bitte fragen Sie die Verwaltung nach den Rechnungen. Diese Angaben ersetzen keine " +
            "Steuerberatung."
          : "Ausgewiesen ist nur der in den Rechnungen ausgewiesene Lohn-, Fahrt- und " +
            "Maschinenkostenanteil — nur er ist begünstigt, Material nicht. Diese Angaben " +
            "ersetzen keine Steuerberatung.";
      // Überschrift, Zahlen und Erläuterung bleiben zusammen — die Zahlen allein
      // wären ohne den Hinweis missverständlich.
      doc.space(mm(2));
      doc.ensure(
        mm(8) +
          3 * mm(5) +
          doc.measure(erlaeuterung, { size: size.foot, width: CONTENT_WIDTH, lead: mm(4) }),
      );
      doc.text("Steuerlich begünstigte Aufwendungen (§ 35a EStG)", {
        size: size.small,
        font: doc.bold,
        color: color.muted,
        lead: mm(5),
      });
      doc.amountRow("Haushaltsnahe Dienstleistungen", formatCents(unit.laborHaushaltsnahCents));
      doc.amountRow("Handwerkerleistungen", formatCents(unit.laborHandwerkerCents));
      if (unit.laborUnerfasstCents > 0) {
        doc.amountRow(
          "davon Lohnanteil nicht erfasst",
          formatCents(unit.laborUnerfasstCents),
          { color: color.due },
        );
      }
      doc.space(mm(1));
      doc.para(erlaeuterung, {
        size: size.foot,
        color: color.muted,
        width: CONTENT_WIDTH,
        lead: mm(4),
      });
    }

    if (unit.uncoveredCents > 0) {
      doc.space(mm(3));
      doc.para(
        `Hinweis: ${formatCents(unit.uncoveredCents)} des Kostenanteils sind keinem erfassten ` +
          "Eigentümer zugeordnet.",
        { size: size.small, color: color.due, width: CONTENT_WIDTH, lead: mm(4.5) },
      );
    }

    // „Fertiggestellt" heißt: der Verwalter hat die Abrechnung geprüft und das
    // Ergebnis eingefroren — sie ist damit **versandfertige Beschlussvorlage**.
    // Beschlossen wird die Abrechnungsspitze erst von der Eigentümerversammlung
    // (§ 28 Abs. 2 Satz 1 WEG); erst damit wird ein Nachschuss fällig. Das
    // Dokument hat das vorher „Beschlossene Abrechnung" genannt — eine Aussage,
    // die zu diesem Zeitpunkt nicht stimmt und zu einer Zahlung auf eine noch
    // nicht beschlossene Forderung verleiten kann.
    //
    // **Ohne „Muster — ersetzt keine Rechtsberatung".** Der Satz stand hier und
    // war sachlich falsch: Eine Einzelabrechnung ist kein Textbaustein, sondern
    // die Abrechnung dieser Einheit für dieses Jahr, aus ihren Buchungen
    // gerechnet. Ein Eigentümer, der unten „Muster" liest, hat allen Grund, die
    // Zahlen darüber nicht für seine zu halten. Am Beschlussvorschlag auf der
    // Verwalterseite bleibt der Hinweis — dort ist es tatsächlich eine Vorlage.
    doc.space(mm(4));
    doc.para(
      input.finalizedAt
        ? `Erstellt am ${fmtDate(input.generatedAt)}, geprüft und abgeschlossen. Über die ` +
            "Abrechnungsspitze beschließt die Eigentümerversammlung (§ 28 Abs. 2 WEG) — erst mit " +
            "diesem Beschluss wird ein Nachschuss fällig."
        : `Entwurf, erstellt am ${fmtDate(input.generatedAt)} — noch in Bearbeitung. Die Zahlen ` +
            "können sich bis zur Fertigstellung noch ändern.",
      { size: size.foot, color: color.muted, width: CONTENT_WIDTH, lead: mm(4) },
    );
  }

  return doc.finish({
    left: input.issuer.legalName,
    right: input.finalizedAt
      ? `Einzelabrechnung ${input.year}`
      : `Einzelabrechnung ${input.year} (Entwurf)`,
  });
}
