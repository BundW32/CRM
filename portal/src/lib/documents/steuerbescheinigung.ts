// Bescheinigung nach § 35a EStG — ein Blatt je Einheit.
//
// Die Einzelabrechnung trägt den § 35a-Ausweis bereits als Abschnitt. Der
// Steuerberater will aber ein eigenes Blatt: nur die begünstigten
// Aufwendungen, je Kostenart mit Gesamtbetrag, Umlageschlüssel und dem Anteil
// der Einheit, ohne Hausgeld, Abrechnungsspitze und Rücklage drumherum
// (Rückmeldung aus dem Produkttest 09/2026; Befund C2 der
// Buchhaltungsprüfung). Dieselben Zahlen wie in der Einzelabrechnung — es ist
// ein Auszug, keine zweite Rechnung.
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
} from "./kit";
import type { RGB } from "pdf-lib";
import {
  zeichneLaborTabelle,
  type EinzelabrechnungLaborRow,
  type EinzelabrechnungOwner,
} from "./einzelabrechnung";

export type SteuerbescheinigungUnit = {
  label: string;
  owners: EinzelabrechnungOwner[];
  laborRows: EinzelabrechnungLaborRow[];
  laborHaushaltsnahCents: number;
  laborHandwerkerCents: number;
  /** Anteil an Kosten, für die kein Lohnanteil erfasst ist. */
  laborUnerfasstCents: number;
};

export type SteuerbescheinigungInput = {
  propertyName: string;
  issuer: LetterIssuer;
  brand?: RGB;
  logo?: string | Uint8Array | null;
  year: number;
  periodLabel: string;
  finalizedAt: Date | null;
  units: SteuerbescheinigungUnit[];
  generatedAt: Date;
};

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export async function generateSteuerbescheinigungen(input: SteuerbescheinigungInput): Promise<Buffer> {
  const doc = await Doc.create({
    title: `Bescheinigung § 35a EStG ${input.year} — ${input.propertyName}`,
    author: input.issuer.legalName,
    subject: `Steuerlich begünstigte Aufwendungen nach § 35a EStG, ${input.propertyName}`,
    brand: input.brand,
  });

  for (const unit of input.units) {
    doc.newPage();

    const eigentuemer =
      unit.owners.length > 0
        ? unit.owners.map((o) => `${o.name} (${o.days} Tage)`).join(", ")
        : "kein Eigentümer erfasst";

    await drawReportHead(doc, {
      issuer: input.issuer,
      logo: input.logo,
      title: `Bescheinigung nach § 35a EStG ${input.year}`,
      subtitle: `${input.propertyName} · Einheit ${unit.label}\nEigentümer: ${eigentuemer}`,
      status: input.finalizedAt
        ? { text: `Aus der geprüften Jahresabrechnung vom ${fmtDate(input.finalizedAt)}`, tone: "final" }
        : { text: "Entwurf — Jahresabrechnung noch in Bearbeitung", tone: "draft" },
      meta: [
        ["Wirtschaftsjahr", input.periodLabel],
        ["Einheit", unit.label],
      ],
    });

    doc.para(
      "Auf Ihre Einheit entfallen aus der Jahresabrechnung der Gemeinschaft die folgenden " +
        "Aufwendungen für haushaltsnahe Dienstleistungen und Handwerkerleistungen. Ausgewiesen " +
        "ist je Position der begünstigte Lohn-, Fahrt- und Maschinenkostenanteil laut Rechnung " +
        "und der Anteil Ihrer Einheit nach dem genannten Umlageschlüssel.",
      { size: size.small, color: color.muted, width: CONTENT_WIDTH, lead: mm(4.5) },
    );
    doc.space(mm(3));

    if (unit.laborRows.length === 0) {
      doc.para(
        "Für dieses Wirtschaftsjahr sind auf Ihre Einheit keine begünstigten Aufwendungen " +
          "entfallen oder es liegt kein Lohnanteil laut Rechnung vor.",
        { size: size.small, width: CONTENT_WIDTH, lead: mm(4.5) },
      );
    } else {
      zeichneLaborTabelle(doc, unit.laborRows);
    }

    doc.rule({ gapAbove: mm(2), gapBelow: mm(4) });
    doc.amountRow(
      "Haushaltsnahe Dienstleistungen (§ 35a Abs. 2 EStG)",
      formatCents(unit.laborHaushaltsnahCents),
      { strong: true },
    );
    doc.amountRow("Handwerkerleistungen (§ 35a Abs. 3 EStG)", formatCents(unit.laborHandwerkerCents), {
      strong: true,
    });
    if (unit.laborUnerfasstCents > 0) {
      doc.amountRow("Aufwand ohne erfassten Lohnanteil (nicht enthalten)", formatCents(unit.laborUnerfasstCents), {
        color: color.due,
      });
    }

    doc.space(mm(3));
    const erlaeuterung =
      unit.laborUnerfasstCents > 0
        ? `Für ${formatCents(unit.laborUnerfasstCents)} Ihres Kostenanteils liegt der Lohnanteil ` +
          "nicht vor; dieser Betrag ist oben bewusst nicht enthalten, weil eine geschätzte Zahl " +
          "einer Rückfrage des Finanzamts nicht standhielte. Bitte fragen Sie die Verwaltung nach " +
          "den Rechnungen. "
        : "";
    doc.para(
      erlaeuterung +
        "Die Steuerermäßigung setzt voraus, dass die Leistungen unbar bezahlt wurden und die " +
        "Rechnungen vorliegen (§ 35a Abs. 5 EStG); die Belege werden bei der Verwaltung " +
        "aufbewahrt und stehen zur Einsicht bereit. Diese Bescheinigung ersetzt keine Steuerberatung.",
      { size: size.foot, color: color.muted, width: CONTENT_WIDTH, lead: mm(4) },
    );

    doc.space(mm(4));
    doc.para(
      input.finalizedAt
        ? `Erstellt am ${fmtDate(input.generatedAt)} aus der geprüften und abgeschlossenen Jahresabrechnung ${input.year}.`
        : `Entwurf, erstellt am ${fmtDate(input.generatedAt)} — die Jahresabrechnung ist noch in Bearbeitung, die Zahlen können sich ändern.`,
      { size: size.foot, color: color.muted, width: CONTENT_WIDTH, lead: mm(4) },
    );
  }

  return doc.finish({
    left: input.issuer.legalName,
    right: input.finalizedAt
      ? `Bescheinigung § 35a EStG ${input.year}`
      : `Bescheinigung § 35a EStG ${input.year} (Entwurf)`,
  });
}
