// Plattform-Rechnung (Betreiber → Verwaltung) als DIN-A4-Brief.
//
// Aufgebaut auf lib/documents/kit (DIN 5008 Form B). Eine Rechnung ist das
// klassische Fensterumschlag-Dokument; vorher stand der Empfänger als
// gewöhnlicher Textblock mitten im Satz und war nicht versandfertig.
//
// Die Pflichtangaben einer Rechnung stehen im Informationsblock
// (Rechnungsnummer, Rechnungsdatum) und in der Fußzeile (USt-IdNr. des
// Ausstellers).
import {
  CONTENT_WIDTH,
  Doc,
  color,
  drawLetterHead,
  mm,
  size,
  type TableCell,
} from "./kit";
import { formatCents, formatInvoiceNumber, type PlatformIssuer } from "@/lib/platform";

export type InvoiceItemInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
};

export type PlatformInvoiceInput = {
  year: number;
  number: number;
  title: string;
  status: "ENTWURF" | "OFFEN" | "BEZAHLT" | "STORNIERT";
  vatRate: number;
  issuedAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
  recipient: {
    name: string;
    legalName: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
  };
  items: InvoiceItemInput[];
  issuer: PlatformIssuer;
  /** Pfad zu einem PNG-Logo des Betreibers. */
  logoPath?: string | null;
};

function fmtDate(value: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return "—";
  return `${String(value.getDate()).padStart(2, "0")}.${String(value.getMonth() + 1).padStart(2, "0")}.${value.getFullYear()}`;
}

// Der Status gehört in den Text, nicht in ein diagonales Wasserzeichen: Das
// alte lag quer über der Seite, machte den Ausdruck unruhig und war in
// Schwarzweiß kaum zu erkennen.
const STATUS_HINWEIS: Record<PlatformInvoiceInput["status"], string | null> = {
  ENTWURF: "Entwurf — diese Rechnung ist noch nicht gestellt.",
  OFFEN: null,
  BEZAHLT: "Diese Rechnung ist bereits ausgeglichen.",
  STORNIERT: "Diese Rechnung wurde storniert.",
};

export async function renderPlatformInvoicePdf(input: PlatformInvoiceInput): Promise<Buffer> {
  const nummer = formatInvoiceNumber(input.year, input.number);
  const doc = await Doc.create({
    title: `Rechnung ${nummer}`,
    author: input.issuer.legalName,
    subject: input.title,
  });
  doc.newPage();

  await drawLetterHead(doc, {
    issuer: { legalName: input.issuer.legalName, lines: [input.issuer.contactLine] },
    logoPath: input.logoPath,
    returnLine: [input.issuer.legalName, input.issuer.contactLine].filter(Boolean).join(" · "),
    recipient: {
      lines: [
        input.recipient.legalName || input.recipient.name,
        input.recipient.street ?? "",
        [input.recipient.zip, input.recipient.city].filter(Boolean).join(" "),
      ],
    },
    infoBlock: [
      ["Rechnung", nummer],
      ["Rechnungsdatum", fmtDate(input.issuedAt ?? input.createdAt)],
      ...(input.dueAt ? ([["Fällig bis", fmtDate(input.dueAt)]] as [string, string][]) : []),
    ],
  });

  doc.subject(`Rechnung ${nummer}`, input.title);

  const hinweis = STATUS_HINWEIS[input.status];
  if (hinweis) {
    doc.text(hinweis, {
      font: doc.bold,
      color: input.status === "STORNIERT" ? color.due : color.muted,
    });
    doc.space(mm(4));
  }

  // ── Positionen ─────────────────────────────────────────────────────────────
  const netto = input.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const ust = Math.round(netto * (input.vatRate / 100));
  const brutto = netto + ust;

  doc.table(
    [
      { header: "Beschreibung", width: 52 },
      { header: "Menge", width: 12, align: "right" },
      { header: "Einzelpreis", width: 18, align: "right" },
      { header: "Betrag", width: 18, align: "right" },
    ],
    input.items.map((item): TableCell[] => [
      { text: item.description },
      { text: String(item.quantity) },
      { text: formatCents(item.unitPriceCents) },
      { text: formatCents(item.quantity * item.unitPriceCents) },
    ]),
  );

  doc.rule({ gapAbove: mm(2), gapBelow: mm(4) });
  doc.amountRow("Nettobetrag", formatCents(netto));
  doc.amountRow(`zuzüglich ${input.vatRate} % Umsatzsteuer`, formatCents(ust));
  doc.space(mm(1));
  doc.amountPanel("Gesamtbetrag", formatCents(brutto), {
    sub: input.dueAt ? `Zahlbar bis ${fmtDate(input.dueAt)}` : null,
    tone: input.status === "BEZAHLT" ? "credit" : "due",
  });

  // ── Zahlungshinweis ────────────────────────────────────────────────────────
  if (input.status !== "STORNIERT" && (input.issuer.iban || input.issuer.bank)) {
    doc.text("Bankverbindung", { size: size.small, font: doc.bold, color: color.muted, lead: mm(5) });
    doc.defList([
      ...(input.issuer.iban ? ([["IBAN", input.issuer.iban]] as [string, string][]) : []),
      ...(input.issuer.bank ? ([["Bank", input.issuer.bank]] as [string, string][]) : []),
    ]);
    doc.space(mm(4));
    const zahlung =
      `Bitte überweisen Sie den Betrag ohne Abzug${input.dueAt ? ` bis zum ${fmtDate(input.dueAt)}` : ""} ` +
      `unter Angabe der Rechnungsnummer ${nummer}.`;
    // Zahlungshinweis, Grußformel und Absender bleiben zusammen.
    doc.ensure(doc.measure(zahlung) + mm(4) + mm(10) + doc.measure(input.issuer.legalName));
    doc.para(zahlung);
  }

  doc.space(mm(4));
  doc.text("Mit freundlichen Grüßen", { lead: mm(10) });
  doc.para(input.issuer.legalName, { width: CONTENT_WIDTH });

  return doc.finish({
    left: [input.issuer.legalName, input.issuer.vatId ? `USt-IdNr. ${input.issuer.vatId}` : null]
      .filter(Boolean)
      .join(" · "),
    right: `Rechnung ${nummer}`,
  });
}
