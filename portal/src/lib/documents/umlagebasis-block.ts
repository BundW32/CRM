// Der Block „Grundlage der Verteilung" — Umlageschlüssel mit Zähler und
// Nenner je Einheit. Einmal gezeichnet, zweimal gebraucht: Einzelabrechnung
// und Einzelwirtschaftsplan. Der Schlüsselname allein („Wohn-/Nutzfläche")
// sagt, wonach verteilt wurde, aber nicht, ob es stimmt. Erst mit Zähler und
// Nenner kann der Eigentümer jede Zeile nachrechnen: Gesamt × Anteil ÷ Summe.
import { CONTENT_WIDTH, Doc, color, mm, size, type TableCell } from "./kit";

export type UmlagebasisBlockZeile = { schluessel: string; einheit: string; gesamt: string };

export function zeichneUmlagebasisBlock(
  doc: Doc,
  zeilen: UmlagebasisBlockZeile[] | undefined,
  /** Ein Satz unter der Tabelle, z. B. der Hinweis zum Vorschuss nach MEA. */
  hinweis?: string | null,
): void {
  if (!zeilen || zeilen.length === 0) return;
  doc.text("Grundlage der Verteilung", {
    size: size.small,
    font: doc.bold,
    color: color.muted,
    lead: mm(5),
  });
  doc.table(
    [
      { header: "Umlageschlüssel", width: 44 },
      { header: "Ihre Einheit", width: 26, align: "right" },
      { header: "Gemeinschaft gesamt", width: 30, align: "right" },
    ],
    zeilen.map((z): TableCell[] => [
      { text: z.schluessel },
      { text: z.einheit },
      { text: z.gesamt, color: color.muted },
    ]),
  );
  if (hinweis) {
    doc.space(mm(1));
    doc.para(hinweis, { size: size.foot, color: color.muted, width: CONTENT_WIDTH, lead: mm(4) });
  }
  doc.space(mm(5));
}
