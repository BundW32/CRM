// Kopf für Berichte — Wirtschaftsplan, Abrechnungen, Protokolle,
// Beschluss-Sammlung, Übergabeprotokoll.
//
// Berichte haben keinen Empfänger im Fensterumschlag: Sie werden abgelegt,
// beigefügt oder ausgehändigt. Statt des Anschriftfelds tragen sie deshalb
// Titel, Objekt und Bearbeitungsstand — und beginnen dafür deutlich höher auf
// der Seite als ein Brief.
import type { Doc } from "./doc";
import { drawBrandHead, type LetterIssuer } from "./letter";
import { CONTENT_WIDTH, DIN, color, mm, size } from "./theme";
import { fitText } from "../pdf-text";

export type ReportHead = {
  issuer: LetterIssuer;
  /** Pfad zu einer PNG-Datei oder die Bilddaten selbst (Mandantenlogo). */
  logo?: string | Uint8Array | null;
  title: string;
  /** Objektname o. Ä. — steht unter dem Titel. */
  subtitle?: string | null;
  /**
   * Bearbeitungsstand, z. B. „Entwurf — noch nicht beschlossen".
   * Als Wort, nicht als diagonales Wasserzeichen: Das lag quer über der Seite
   * und war im Schwarzweißdruck kaum zu erkennen.
   *
   * `neutral` für Angaben, die gar kein Stand sind, sondern eine Art — „Einzug"
   * ist weder gut noch schlecht und darf nicht wie „beschlossen" aussehen.
   */
  status?: { text: string; tone?: "draft" | "final" | "neutral" } | null;
  /** Kennzahlen rechts neben dem Titel: Zeitraum, Stand, Beschlussdatum. */
  meta?: [string, string][];
};

export async function drawReportHead(doc: Doc, head: ReportHead): Promise<void> {
  const lineY = await drawBrandHead(doc, head.issuer, head.logo);
  doc.y = lineY - mm(12);

  // Der Metablock rechts wird zuerst gesetzt: Er bestimmt, wie viel Breite dem
  // Titel bleibt — ein zu langer Objektname lief sonst darüber.
  const metaWidth = head.meta?.length ? mm(58) : 0;
  const titleWidth = CONTENT_WIDTH - metaWidth - (metaWidth ? mm(6) : 0);
  const startY = doc.y;

  doc.para(head.title, {
    size: size.title,
    font: doc.bold,
    width: titleWidth,
    lead: mm(8),
  });
  if (head.subtitle) {
    // Mehrzeilige Untertitel (Objekt, Einheit, Eigentümer) kommen als ein Wert
    // mit Zeilenumbrüchen — `para` umbricht nur nach Breite.
    for (const zeile of head.subtitle.split("\n")) {
      doc.para(zeile, {
        size: size.small,
        color: color.muted,
        width: titleWidth,
        lead: mm(5),
      });
    }
  }
  if (head.status) {
    doc.text(head.status.text, {
      size: size.small,
      font: doc.bold,
      color:
        head.status.tone === "final"
          ? color.credit
          : head.status.tone === "neutral"
            ? doc.brand
            : color.due,
      lead: mm(6),
    });
  }

  if (head.meta?.length) {
    const xRight = DIN.marginLeft + CONTENT_WIDTH;
    let my = startY;
    for (const [key, value] of head.meta) {
      const k = fitText(key, doc.font, size.foot, metaWidth);
      doc.page.drawText(k, {
        x: xRight - doc.font.widthOfTextAtSize(k, size.foot),
        y: my,
        size: size.foot,
        font: doc.font,
        color: color.muted,
      });
      my -= mm(4);
      const v = fitText(value, doc.bold, size.small, metaWidth);
      doc.page.drawText(v, {
        x: xRight - doc.bold.widthOfTextAtSize(v, size.small),
        y: my,
        size: size.small,
        font: doc.bold,
        color: color.ink,
      });
      my -= mm(6);
    }
    // Der Cursor folgt dem tieferen der beiden Blöcke.
    doc.y = Math.min(doc.y, my);
  }

  doc.rule({ gapAbove: mm(2), gapBelow: mm(7) });
}
