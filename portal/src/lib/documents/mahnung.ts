// Hausgeld-Zahlungserinnerung und Mahnung als DIN-A4-Brief.
//
// Aufgebaut auf lib/documents/kit: Anschriftfeld nach DIN 5008 Form B (20 mm
// von links, Anschrift ab 62,7 mm, Betreff auf 98,4 mm), Falz- und Lochmarken,
// Fußzeile mit Seitenzahl. Stufen und Fristen richten sich nach lib/dunning.ts.
//
// Verzugszinsen und Mahnkosten setzt das Portal **nicht von selbst** an — sie
// kommen als fertige Beträge herein (`interestCents`, `feeCents`), festgeschrieben
// zum Erstellzeitpunkt der Mahnung. Ein Schreiben, dessen Beträge sich später von
// selbst ändern, ist als Nachweis wertlos.
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
  /** Pfad zu einer PNG-Datei oder die Bilddaten selbst (Mandantenlogo). */
  logo?: string | Uint8Array | null;
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
  /**
   * Verzugszinsen (§ 288 Abs. 1 BGB) zum Erstellzeitpunkt.
   *
   * `null` = für den Zeitraum ist kein Basiszinssatz hinterlegt. Dann nennt das
   * Schreiben **keine** Zinsen — statt einer Null, die wie „keine Zinsen
   * entstanden" aussieht.
   */
  interestCents?: number | null;
  /** Mahnkosten (tatsächlicher Aufwand). Erst ab der zweiten Stufe. */
  feeCents?: number;
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
    logo: input.logo,
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
  //
  // Zinsen und Kosten sind eigene Forderungen neben der Hauptforderung
  // (§ 367 Abs. 1 BGB) und stehen deshalb als eigene Zeilen. Eine Mahnung, die
  // nur einen Endbetrag nennt, gibt dem Empfänger nichts, was er prüfen kann —
  // und genau daran scheitert sie, wenn er widerspricht.
  const zusatz: MahnungPosition[] = [];
  if (input.interestCents && input.interestCents > 0) {
    zusatz.push({ label: "Verzugszinsen (§ 288 Abs. 1 BGB)", cents: input.interestCents });
  }
  if (input.feeCents && input.feeCents > 0) {
    zusatz.push({ label: "Mahnkosten", cents: input.feeCents });
  }
  const gesamtCents = input.arrearsCents + zusatz.reduce((s, p) => s + p.cents, 0);

  // Steht nur der Rückstand da, ist eine Aufstellung mit einer einzigen Zeile
  // Ballast — dann bleibt es beim einzeiligen Betrag.
  const posten: MahnungPosition[] = [
    ...(input.positions ?? (zusatz.length ? [{ label: "Hausgeld-Rückstand", cents: input.arrearsCents }] : [])),
    ...zusatz,
  ];

  if (posten.length) {
    doc.text("Offene Posten", { size: size.small, font: doc.bold, color: color.muted, lead: mm(2) });
    doc.rule({ gapAbove: mm(2), gapBelow: mm(4) });
    for (const position of posten) {
      doc.amountRow(position.label, formatCents(position.cents));
    }
    doc.rule({ gapAbove: mm(2), gapBelow: mm(3) });
    doc.space(mm(1));
  }

  doc.amountPanel(zusatz.length ? "Gesamtforderung" : "Offener Betrag", formatCents(gesamtCents), {
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

  // Hinweis, Grußformel und Absender bleiben zusammen.
  const hinweis =
    "Bereits geleistete Zahlungen sind in dieser Aufstellung möglicherweise noch nicht berücksichtigt.";
  doc.ensure(doc.measure(hinweis) + mm(4) + mm(11) + doc.measure(input.issuer.legalName));
  doc.para(hinweis);
  doc.space(mm(4));
  doc.text("Mit freundlichen Grüßen", { lead: mm(11) });
  doc.para(input.issuer.legalName, { width: CONTENT_WIDTH });

  return doc.finish({
    left: input.issuer.legalName,
    right: `Erstellt am ${fmtDate(input.createdAt)}`,
  });
}
