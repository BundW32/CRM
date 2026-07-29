// Betriebskostenabrechnung einer vermieteten Einheit als DIN-A4-Brief.
//
// Aufgebaut auf lib/documents/kit (DIN 5008 Form B). Die Abrechnung leitet sich
// aus der fertigen WEG-Jahresabrechnung ab; umlagefähig nach BetrKV, der
// CO2-Anteil nach CO2KostAufG zwischen Vermieter und Mieter aufgeteilt.
import { briefAnrede, anschriftZeilen, type Empfaenger } from "./anrede";
import { formatCents } from "@/lib/money";
import { HEIZKOSTEN_HINWEIS } from "@/lib/weg/umlageschluessel-text";
import {
  CONTENT_WIDTH,
  Doc,
  color,
  drawLetterHead,
  mm,
  size,
  type LetterIssuer,
  type TableCell,
} from "./kit";
import type { RGB } from "pdf-lib";

export type BetriebskostenZeile = {
  name: string;
  /** Anteil dieser Einheit. */
  cents: number;
  /** Gesamtkosten der Liegenschaft für diese Kostenart. */
  totalCents: number;
  /** Umlageschlüssel im Klartext, z. B. „Wohnfläche" oder „70 % Verbrauch, 30 % Wohnfläche". */
  keyLabel: string;
};

export type BetriebskostenInput = {
  issuer: LetterIssuer;
  brand?: RGB;
  logoPath?: string | null;
  propertyName: string;
  unitLabel: string;
  /** Mieter mit Anrede; ohne ihn bleibt das Anschriftfeld leer. */
  tenant: Empfaenger | null;
  /** „Straße\nPLZ Ort" */
  tenantAddress: string | null;
  year: number;
  /** Je Kostenart: Gesamtkosten der Liegenschaft, Umlageschlüssel, Anteil. */
  recoverableRows: BetriebskostenZeile[];
  nonRecoverableRows: BetriebskostenZeile[];
  recoverableSumCents: number;
  co2LandlordDeductionCents: number;
  tenantCostsCents: number;
  months: number;
  prepaymentMonthlyCents: number;
  prepaymentCents: number;
  /** + Nachzahlung, − Guthaben */
  balanceCents: number;
  /**
   * Enthält die Abrechnung Heiz-/Warmwasserkosten? Dann bekommt die Anlage die
   * Fußnote zur Aufteilung nach HeizkostenV.
   */
  heatingPresent?: boolean;
  city: string | null;
  createdAt: Date;
};

function fmtDate(value: Date): string {
  return `${String(value.getDate()).padStart(2, "0")}.${String(value.getMonth() + 1).padStart(2, "0")}.${value.getFullYear()}`;
}

export async function generateBetriebskosten(input: BetriebskostenInput): Promise<Buffer> {
  const nachzahlung = input.balanceCents >= 0;
  const doc = await Doc.create({
    title: `Betriebskostenabrechnung ${input.year} — ${input.unitLabel}`,
    author: input.issuer.legalName,
    subject: `Betriebskostenabrechnung ${input.year}, ${input.propertyName}`,
    brand: input.brand,
  });
  doc.newPage();

  await drawLetterHead(doc, {
    issuer: input.issuer,
    logoPath: input.logoPath,
    // Nur Firma und Anschrift: mehr passt nicht in die 85 mm des Felds.
    returnLine: [input.issuer.legalName, input.issuer.lines[0]].filter(Boolean).join(" · "),
    recipient: {
      // Ohne hinterlegte Anschrift bleibt es beim Hinweis auf die Einheit — der
      // Brief ist dann nicht versandfertig, aber wenigstens zuordenbar.
      lines: input.tenant
        ? anschriftZeilen(input.tenant, input.tenantAddress)
        : ["An den Mieter", `Einheit ${input.unitLabel}`],
    },
    infoBlock: [
      ["Objekt", input.propertyName],
      ["Einheit", input.unitLabel],
      ["Zeitraum", String(input.year)],
      ["Datum", `${input.city ? `${input.city}, ` : ""}${fmtDate(input.createdAt)}`],
    ],
  });

  doc.subject(
    `Betriebskostenabrechnung ${input.year}`,
    `${input.propertyName} · Einheit ${input.unitLabel}`,
  );
  doc.text(briefAnrede(input.tenant), { lead: mm(7) });
  doc.para(
    `anbei erhalten Sie die Abrechnung der Betriebskosten für das Jahr ${input.year}. Sie ` +
      `weist die umlagefähigen Kosten, Ihre Vorauszahlungen und den sich daraus ergebenden ` +
      `${nachzahlung ? "Nachzahlungsbetrag" : "Guthabenbetrag"} aus.`,
  );
  doc.space(mm(2));

  // ── Ergebnis (Seite 1) ─────────────────────────────────────────────────────
  // Nur die Rechenkette, nicht die Einzelposten: Wer den Brief öffnet, will
  // zuerst wissen, ob er zahlt oder Geld bekommt. Die vollständige Aufstellung
  // steht als Anlage auf der Folgeseite.
  doc.amountRow("Umlagefähige Kosten insgesamt", formatCents(input.recoverableSumCents));
  if (input.co2LandlordDeductionCents > 0) {
    doc.amountRow(
      "abzüglich Vermieteranteil CO2-Kosten (CO2KostAufG)",
      `− ${formatCents(input.co2LandlordDeductionCents)}`,
      { color: color.credit },
    );
  }
  doc.amountRow("Auf Sie entfallende Kosten", formatCents(input.tenantCostsCents), { strong: true });
  doc.amountRow(
    `abzüglich Vorauszahlungen (${input.months} × ${formatCents(input.prepaymentMonthlyCents)})`,
    `− ${formatCents(input.prepaymentCents)}`,
  );
  doc.space(mm(2));

  doc.amountPanel(
    nachzahlung ? "Nachzahlung" : "Guthaben",
    formatCents(Math.abs(input.balanceCents)),
    {
      tone: nachzahlung ? "due" : "credit",
      sub: nachzahlung
        ? "Bitte überweisen Sie den Betrag innerhalb von 30 Tagen."
        : "Der Betrag wird Ihnen erstattet bzw. mit der nächsten Zahlung verrechnet.",
    },
  );

  // Schlusshinweis und Grußformel bilden einen Block: rutscht er auf eine
  // Folgeseite, dann gemeinsam. Die Reserve wird gemessen statt geschätzt —
  // eine Seite, auf der allein „Mit freundlichen Grüßen" steht, sieht nach
  // Fehler aus, und eine zu großzügige Schätzung bricht unnötig um.
  const schluss =
    "Die Abrechnung leitet sich aus der Jahresabrechnung der Wohnungseigentümergemeinschaft " +
    "ab. Die Belege können Sie nach Absprache einsehen; Einwendungen teilen Sie uns bitte " +
    "innerhalb von zwölf Monaten nach Zugang dieser Abrechnung mit.";
  doc.ensure(doc.measure(schluss) + mm(3) + mm(10) + doc.measure(input.issuer.legalName));
  doc.para(schluss);
  doc.space(mm(3));
  doc.text("Mit freundlichen Grüßen", { lead: mm(10) });
  doc.para(input.issuer.legalName, { width: CONTENT_WIDTH });

  // ── Anlage: Kostenaufstellung (eigene Seite) ───────────────────────────────
  // Gesamtkosten, Umlageschlüssel und der daraus abgeleitete Anteil gehören in
  // jede Betriebskostenabrechnung — ohne sie kann der Mieter nicht prüfen, wie
  // sein Anteil zustande kommt. Auf einer eigenen Seite, weil die Tabelle das
  // Anschreiben sonst erdrückt.
  doc.newPage();
  doc.text(`Anlage — Kostenaufstellung ${input.year}`, {
    size: size.section,
    font: doc.bold,
    lead: mm(6),
  });
  doc.text(`${input.propertyName} · Einheit ${input.unitLabel}`, {
    size: size.small,
    color: color.muted,
    lead: mm(8),
  });

  const spalten = [
    // Beträge brauchen wenig Platz, der Schlüssel viel: „70 % Verbrauch,
    // 30 % Wohnfläche" ist länger als jede Zahl in der Tabelle.
    { header: "Kostenart", width: 36 },
    { header: "Gesamtkosten", width: 16, align: "right" as const },
    { header: "Umlageschlüssel", width: 32 },
    { header: "Ihr Anteil", width: 16, align: "right" as const },
  ];
  const zeile = (row: BetriebskostenZeile, muted = false): TableCell[] => [
    { text: row.name, color: muted ? color.muted : undefined },
    { text: formatCents(row.totalCents), color: muted ? color.muted : undefined },
    { text: row.keyLabel, color: color.muted },
    { text: formatCents(row.cents), color: muted ? color.muted : undefined },
  ];

  doc.text("Umlagefähig nach BetrKV", {
    size: size.small,
    font: doc.bold,
    color: color.muted,
    lead: mm(5),
  });
  doc.table(spalten, [
    ...input.recoverableRows.map((row) => zeile(row)),
    [
      { text: "Summe umlagefähig", strong: true },
      { text: "" },
      { text: "" },
      { text: formatCents(input.recoverableSumCents), strong: true },
    ],
  ]);

  if (input.nonRecoverableRows.length > 0) {
    doc.space(mm(6));
    doc.text("Nicht umlagefähig — trägt der Eigentümer", {
      size: size.small,
      font: doc.bold,
      color: color.muted,
      lead: mm(5),
    });
    doc.table(spalten, input.nonRecoverableRows.map((row) => zeile(row, true)));
  }

  doc.space(mm(6));
  if (input.heatingPresent) {
    doc.para(HEIZKOSTEN_HINWEIS, { size: size.small, color: color.muted });
    doc.space(mm(3));
  }
  doc.para(
    "Die Gesamtkosten stammen aus der Jahresabrechnung der Wohnungseigentümergemeinschaft. " +
      "Ihr Anteil ergibt sich aus dem jeweils angegebenen Umlageschlüssel.",
    { size: size.small, color: color.muted },
  );

  return doc.finish({
    left: input.issuer.legalName,
    right: `Erstellt am ${fmtDate(input.createdAt)}`,
  });
}
