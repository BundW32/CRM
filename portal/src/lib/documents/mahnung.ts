// Hausgeld-Zahlungserinnerung und Mahnung als DIN-A4-Brief.
//
// Aufgebaut auf lib/documents/kit: Anschriftfeld nach DIN 5008 Form B (20 mm
// von links, Anschrift ab 62,7 mm, Betreff auf 98,4 mm), Falz- und Lochmarken,
// Fußzeile mit Seitenzahl. Stufen und Fristen richten sich nach lib/dunning.ts;
// automatische Gebühren oder Verzugszinsen setzt das Portal bewusst nicht an.
import { briefAnrede, anschriftZeilen, type Empfaenger } from "./anrede";
import { formatCents } from "@/lib/money";
import { reminderLevelLabel } from "@/lib/dunning";
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

export type MahnungPosition = { label: string; cents: number };

export type MahnungInput = {
  /** Absender (WEG bzw. Verwaltung). */
  issuer: LetterIssuer;
  /** Mandantenfarbe und Logo, beides optional. */
  brand?: RGB;
  logoPath?: string | null;
  propertyName: string;
  unitLabel: string;
  /** 1–3, siehe reminderLevelLabel. */
  level: number;
  recipient: Empfaenger;
  /** „Straße\nPLZ Ort" */
  recipientAddress: string | null;
  /** Zusatzvermerk der Vermerkzone, z. B. „Einschreiben mit Rückschein". */
  versandVermerk?: string | null;
  arrearsCents: number;
  /** Einzelne offene Posten; ohne Angabe erscheint nur die Summe. */
  positions?: MahnungPosition[];
  paymentDeadline: Date;
  /** Girokonto der Gemeinschaft. */
  iban: string | null;
  accountHolder: string | null;
  /** Frühere Stufe, auf die sich der Text bezieht. */
  previousReminderAt?: Date | null;
  createdAt: Date;
  /** Ortsangabe der Datumszeile. */
  city: string | null;
  /** Aktenzeichen für den Informationsblock. */
  vorgang?: string | null;
};

function fmtDate(value: Date): string {
  return `${String(value.getDate()).padStart(2, "0")}.${String(value.getMonth() + 1).padStart(2, "0")}.${value.getFullYear()}`;
}

// Der Brieftext je Stufe.
//
// Bewusst ohne die Fußnote „Muster — ersetzt keine Rechtsberatung": Dieses
// Schreiben ist kein Muster, es geht so an den Eigentümer. Der Hinweis stand
// vorher unter jedem versendeten Brief und stellte das eigene Schreiben infrage.
export function mahnungAbsaetze(input: MahnungInput): string[] {
  const betrag = formatCents(input.arrearsCents);
  const frist = fmtDate(input.paymentDeadline);
  const einheit = input.unitLabel;
  const vorher = input.previousReminderAt ? ` vom ${fmtDate(input.previousReminderAt)}` : "";

  if (input.level <= 1) {
    return [
      `bei der Durchsicht der Hausgeld-Konten ist uns aufgefallen, dass für Ihre Einheit ` +
        `${einheit} derzeit ein Rückstand von ${betrag} offen steht.`,
      `Wir gehen davon aus, dass es sich um ein Versehen handelt, und bitten Sie, den Betrag ` +
        `bis zum ${frist} auszugleichen. Hat sich Ihre Zahlung mit diesem Schreiben ` +
        `überschnitten, betrachten Sie es bitte als erledigt.`,
    ];
  }
  if (input.level === 2) {
    return [
      `unsere Zahlungserinnerung${vorher} ist bisher ohne Ausgleich geblieben. Für Ihre ` +
        `Einheit ${einheit} besteht weiterhin ein Hausgeld-Rückstand von ${betrag}.`,
      `Wir bitten Sie, den offenen Betrag bis zum ${frist} auf das unten genannte Konto der ` +
        `Gemeinschaft zu überweisen. Sollten Sie die Forderung für unzutreffend halten oder ` +
        `eine Ratenzahlung wünschen, melden Sie sich bitte vor Ablauf der Frist bei uns.`,
    ];
  }
  return [
    `trotz Zahlungserinnerung und Mahnung${vorher} ist der Hausgeld-Rückstand für Ihre ` +
      `Einheit ${einheit} in Höhe von ${betrag} bis heute offen.`,
    `Wir fordern Sie letztmalig auf, den Betrag bis zum ${frist} auszugleichen. Nach ` +
      `fruchtlosem Fristablauf behält sich die Gemeinschaft der Wohnungseigentümer vor, die ` +
      `Forderung gerichtlich geltend zu machen; die damit verbundenen Kosten gehen zu Ihren ` +
      `Lasten. Falls einer Zahlung etwas entgegensteht, sprechen Sie uns bitte vorher an — ` +
      `eine Verständigung ist beiden Seiten lieber als ein Verfahren.`,
  ];
}

export async function generateMahnung(input: MahnungInput): Promise<Buffer> {
  const stufe = reminderLevelLabel(input.level);
  const doc = await Doc.create({
    title: `${stufe} Hausgeld — ${input.unitLabel}`,
    author: input.issuer.legalName,
    subject: `${stufe}, ${input.propertyName}, Einheit ${input.unitLabel}`,
    brand: input.brand,
  });
  doc.newPage();

  await drawLetterHead(doc, {
    issuer: input.issuer,
    logoPath: input.logoPath,
    // Nur Firma und Anschrift: mehr passt nicht in die 85 mm des Felds.
    returnLine: [input.issuer.legalName, input.issuer.lines[0]].filter(Boolean).join(" · "),
    recipient: {
      note: input.versandVermerk,
      lines: anschriftZeilen(input.recipient, input.recipientAddress),
    },
    infoBlock: [
      ["Objekt", input.propertyName],
      ["Einheit", input.unitLabel],
      ...(input.vorgang ? ([["Vorgang", input.vorgang]] as [string, string][]) : []),
      ["Datum", `${input.city ? `${input.city}, ` : ""}${fmtDate(input.createdAt)}`],
    ],
  });

  doc.subject(
    `${stufe} — rückständiges Hausgeld`,
    `${input.propertyName} · Einheit ${input.unitLabel}`,
  );
  doc.text(briefAnrede(input.recipient), { lead: mm(7) });
  for (const absatz of mahnungAbsaetze(input)) {
    doc.para(absatz);
    doc.space(mm(2));
  }
  doc.space(mm(2));

  // ── Offene Posten ──────────────────────────────────────────────────────────
  if (input.positions?.length) {
    doc.text("Offene Posten", { size: size.small, font: doc.bold, color: color.muted, lead: mm(2) });
    doc.rule({ gapAbove: mm(2), gapBelow: mm(4) });
    for (const position of input.positions) {
      doc.amountRow(position.label, formatCents(position.cents));
    }
    doc.rule({ gapAbove: mm(2), gapBelow: mm(3) });
    doc.space(mm(1));
  }

  doc.amountPanel("Offener Betrag", formatCents(input.arrearsCents), {
    sub: `Zahlbar bis ${fmtDate(input.paymentDeadline)} · Verwendungszweck: Hausgeld ${input.unitLabel}`,
  });

  // ── Bankverbindung ─────────────────────────────────────────────────────────
  if (input.iban) {
    doc.text("Bankverbindung der Gemeinschaft", {
      size: size.small,
      font: doc.bold,
      color: color.muted,
      lead: mm(5),
    });
    doc.defList([
      ...(input.accountHolder ? ([["Kontoinhaber", input.accountHolder]] as [string, string][]) : []),
      ["IBAN", input.iban],
      ["Verwendungszweck", `Hausgeld ${input.unitLabel}`],
    ]);
    doc.space(mm(5));
  }

  doc.para(
    "Bereits geleistete Zahlungen sind in dieser Aufstellung möglicherweise noch nicht berücksichtigt.",
  );
  doc.space(mm(4));
  doc.text("Mit freundlichen Grüßen", { lead: mm(11) });
  doc.para(input.issuer.legalName, { width: CONTENT_WIDTH });

  return doc.finish({
    left: input.issuer.legalName,
    right: `Erstellt am ${fmtDate(input.createdAt)}`,
  });
}
