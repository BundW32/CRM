// Betriebskostenabrechnung einer vermieteten Einheit als DIN-A4-Brief.
//
// Aufgebaut auf lib/documents/kit (DIN 5008 Form B). Die Abrechnung leitet sich
// aus der fertigen WEG-Jahresabrechnung ab; umlagefähig nach BetrKV, der
// CO2-Anteil nach CO2KostAufG zwischen Vermieter und Mieter aufgeteilt.
import { briefAnrede, anschriftZeilen, type Empfaenger } from "./anrede";
import { formatCents } from "@/lib/money";
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
  recoverableRows: { name: string; cents: number }[];
  nonRecoverableRows: { name: string; cents: number }[];
  recoverableSumCents: number;
  co2LandlordDeductionCents: number;
  tenantCostsCents: number;
  months: number;
  prepaymentMonthlyCents: number;
  prepaymentCents: number;
  /** + Nachzahlung, − Guthaben */
  balanceCents: number;
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
    returnLine: [input.issuer.legalName, ...input.issuer.lines].join(" · "),
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

  // ── Umlagefähige Kosten ────────────────────────────────────────────────────
  doc.text("Umlagefähige Kosten nach BetrKV", {
    size: size.small,
    font: doc.bold,
    color: color.muted,
    lead: mm(2),
  });
  doc.rule({ gap: mm(2.5) });
  for (const row of input.recoverableRows) {
    doc.amountRow(row.name, formatCents(row.cents));
  }
  doc.rule({ gap: mm(2) });
  doc.amountRow("Summe umlagefähig", formatCents(input.recoverableSumCents), { strong: true });

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

  // ── Nicht umlagefähig ──────────────────────────────────────────────────────
  if (input.nonRecoverableRows.length > 0) {
    doc.text("Nicht umlagefähig — trägt der Eigentümer", {
      size: size.small,
      font: doc.bold,
      color: color.muted,
      lead: mm(5),
    });
    for (const row of input.nonRecoverableRows) {
      doc.amountRow(row.name, formatCents(row.cents), { color: color.muted });
    }
    doc.space(mm(3));
  }

  // Schlusshinweis und Grußformel bilden einen Block: rutscht er auf eine
  // Folgeseite, dann gemeinsam. Eine Seite, auf der allein „Mit freundlichen
  // Grüßen" steht, sieht nach Fehler aus.
  doc.ensure(mm(42));
  doc.para(
    "Die Abrechnung leitet sich aus der Jahresabrechnung der Wohnungseigentümergemeinschaft " +
      "ab. Die Belege können Sie nach Absprache einsehen; Einwendungen teilen Sie uns bitte " +
      "innerhalb von zwölf Monaten nach Zugang dieser Abrechnung mit.",
  );
  doc.space(mm(3));
  doc.text("Mit freundlichen Grüßen", { lead: mm(10) });
  doc.para(input.issuer.legalName, { width: CONTENT_WIDTH });

  return doc.finish({
    left: input.issuer.legalName,
    right: `Erstellt am ${fmtDate(input.createdAt)}`,
  });
}
