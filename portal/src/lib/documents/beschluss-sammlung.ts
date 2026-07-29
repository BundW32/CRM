// Beschluss-Sammlung einer WEG (§ 24 Abs. 7 WEG): alle gefassten Beschlüsse
// eines Objekts, fortlaufend nummeriert.
//
// Aufgebaut auf lib/documents/kit. Die Sammlung ist ein Nachweisdokument —
// jeder Käufer einer Einheit sieht hier hinein —, deshalb trägt jede Seite
// Objekt, Stand und Seitenzählung.
import { wrapText } from "./pdf-text";
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

export type BeschlussSammlungEntry = {
  number: number | null;
  title: string;
  decidedAt: Date | null;
  status: "ANGENOMMEN" | "ABGELEHNT" | "ZURUECKGEZOGEN" | "OFFEN";
  ja: number;
  nein: number;
  enthaltung: number;
};

export type BeschlussSammlungInput = {
  propertyName: string;
  issuer: LetterIssuer;
  brand?: RGB;
  /** Pfad zu einer PNG-Datei oder die Bilddaten selbst (Mandantenlogo). */
  logo?: string | Uint8Array | null;
  entries: BeschlussSammlungEntry[];
  generatedAt: Date;
};

const STATUS_LABELS: Record<BeschlussSammlungEntry["status"], string> = {
  ANGENOMMEN: "Angenommen",
  ABGELEHNT: "Abgelehnt",
  ZURUECKGEZOGEN: "Zurückgezogen",
  OFFEN: "Offen",
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export async function generateBeschlussSammlung(input: BeschlussSammlungInput): Promise<Buffer> {
  const doc = await Doc.create({
    title: `Beschluss-Sammlung — ${input.propertyName}`,
    author: input.issuer.legalName,
    subject: `Beschluss-Sammlung nach § 24 Abs. 7 WEG, ${input.propertyName}`,
    brand: input.brand,
    // Die Sammlung wird abgelegt und eingesehen, nie kuvertiert.
    marks: false,
  });
  doc.newPage();

  await drawReportHead(doc, {
    issuer: input.issuer,
    logo: input.logo,
    title: "Beschluss-Sammlung",
    subtitle: `${input.propertyName}\nGeführt nach § 24 Abs. 7 WEG`,
    meta: [
      ["Stand", fmtDate(input.generatedAt)],
      ["Beschlüsse", String(input.entries.length)],
    ],
  });

  if (input.entries.length === 0) {
    doc.para("Es wurden noch keine Beschlüsse gefasst.", { color: color.muted });
    return doc.finish({ left: input.issuer.legalName, right: input.propertyName });
  }

  const NUMMER_BREITE = mm(22);
  for (const entry of input.entries) {
    const titel = entry.title;
    // Nummer, Titel und Abstimmungsergebnis bleiben zusammen: Ein Beschluss,
    // dessen Ergebnis auf der Folgeseite steht, ist als Nachweis wertlos.
    doc.ensure(
      mm(6) +
        doc.measure(titel, { width: CONTENT_WIDTH - NUMMER_BREITE }) +
        mm(11),
    );

    const kopfY = doc.y;
    doc.page.drawText(entry.number != null ? `Nr. ${entry.number}` : "—", {
      x: mm(20),
      y: kopfY,
      size: size.body,
      font: doc.bold,
      color: doc.brand,
    });
    doc.right(STATUS_LABELS[entry.status] ?? entry.status, {
      size: size.small,
      font: doc.bold,
      color:
        entry.status === "ANGENOMMEN"
          ? color.credit
          : entry.status === "ABGELEHNT"
            ? color.due
            : color.muted,
    });

    // Titel und Fußzeile des Eintrags rücken hinter die Nummernspalte ein.
    const einzug = mm(20) + NUMMER_BREITE;
    for (const zeile of wrapText(titel, doc.font, size.body, CONTENT_WIDTH - NUMMER_BREITE - mm(24))) {
      doc.page.drawText(zeile, {
        x: einzug,
        y: doc.y,
        size: size.body,
        font: doc.font,
        color: color.ink,
      });
      doc.y -= mm(5);
    }
    doc.page.drawText(
      `Beschlossen am ${fmtDate(entry.decidedAt)}  ·  Ja ${entry.ja} · Nein ${entry.nein} · Enthaltung ${entry.enthaltung}`,
      { x: einzug, y: doc.y, size: size.foot, font: doc.font, color: color.muted },
    );
    doc.y -= mm(3);
    doc.rule({ gapAbove: mm(2), gapBelow: mm(5) });
  }

  return doc.finish({
    left: `${input.issuer.legalName} · ${input.propertyName}`,
    right: `Beschluss-Sammlung, Stand ${fmtDate(input.generatedAt)}`,
  });
}
