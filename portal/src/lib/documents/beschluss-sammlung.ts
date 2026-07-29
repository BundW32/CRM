// Beschluss-Sammlung einer WEG (§ 24 Abs. 7 WEG): alle gefassten Beschlüsse
// eines Objekts, fortlaufend nummeriert.
//
// Aufgebaut auf lib/documents/kit. Die Sammlung ist ein Nachweisdokument —
// jeder Käufer einer Einheit sieht hier hinein —, deshalb trägt jede Seite
// Objekt, Stand und Seitenzählung.
import { wrapText } from "./pdf-text";
import {
  CONTENT_WIDTH,
  DIN,
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
  // Rechts bleibt Platz für das Ergebniswort („Zurückgezogen" ist das längste).
  const STATUS_BREITE = mm(24);
  const TITEL_BREITE = CONTENT_WIDTH - NUMMER_BREITE - STATUS_BREITE;
  const TITEL_ZEILE = mm(5);

  for (const entry of input.entries) {
    const titel = entry.title;
    const zeilen = wrapText(titel, doc.font, size.body, TITEL_BREITE);
    // Nummer, Titel und Abstimmungsergebnis bleiben zusammen: Ein Beschluss,
    // dessen Ergebnis auf der Folgeseite steht, ist als Nachweis wertlos.
    // Gemessen wird mit DERSELBEN Breite, mit der gezeichnet wird — sonst
    // reserviert man für weniger Zeilen, als am Ende entstehen.
    doc.ensure(mm(6) + zeilen.length * TITEL_ZEILE + mm(11));

    const kopfY = doc.y;
    doc.page.drawText(entry.number != null ? `Nr. ${entry.number}` : "—", {
      x: DIN.marginLeft,
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
    const einzug = DIN.marginLeft + NUMMER_BREITE;
    for (const zeile of zeilen) {
      // Rückfallebene für den Fall, dass ein einzelner Titel länger ist als
      // eine ganze Seite: dann lieber umbrechen als die Fußzeile überdrucken.
      doc.ensure(TITEL_ZEILE);
      doc.page.drawText(zeile, {
        x: einzug,
        y: doc.y,
        size: size.body,
        font: doc.font,
        color: color.ink,
      });
      doc.y -= TITEL_ZEILE;
    }
    doc.ensure(mm(8));
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
