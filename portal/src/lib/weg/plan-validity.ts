// Geltungszeitraum des Wirtschaftsplans und Fälligkeit der Vorschüsse.
//
// Bisher war der Plan starr an sein Wirtschaftsjahr gebunden und erzeugte mit
// dem Beschluss genau zwölf Sollstellungen. Zwei Löcher folgten daraus:
//
// 1. **Kein Nachfolgeplan, keine Forderung.** Tagt die Versammlung erst im
//    April — oder gar nicht —, schuldete ab Januar niemand mehr Hausgeld. Keine
//    Rückstände, keine Mahnung, kein Geld auf dem Konto der Gemeinschaft.
//    § 28 Abs. 1 Satz 2 WEG sagt das Gegenteil: Der beschlossene Plan gilt
//    **fort**, bis ein neuer beschlossen ist.
// 2. **Ein geänderter Plan war nicht abbildbar.** Steigen die Heizkosten im
//    Sommer, beschließt die Gemeinschaft einen geänderten Wirtschaftsplan, der
//    unterjährig greift. Das ist ein zweiter Plan desselben Jahres — mit dem
//    alten Eindeutigkeitsschlüssel schlicht nicht speicherbar.
//
// Beides löst derselbe Gedanke: Nicht das Jahr bestimmt, was gilt, sondern der
// Geltungszeitraum. Reine Funktionen — DB und UI liegen daneben.
import type { DueDayRule } from "@/generated/prisma/client";
import { fiscalYearMonths } from "./economic-plan";

export type Monat = { year: number; month: number };

/** Erster Tag eines Monats als UTC-Datum (die Zeitachse dieses Projekts). */
export function monatsBeginn(m: Monat): Date {
  return new Date(Date.UTC(m.year, m.month - 1, 1));
}

/**
 * Fälligkeitstag eines Monats nach der Regel des Objekts.
 *
 * Der dritte Werktag ist die im Hausgeld übliche Alternative zum Monatsersten:
 * Er gibt der Bank Zeit und trifft trotzdem den Monatsanfang. Samstag zählt
 * dabei **nicht** als Werktag — im Zahlungsverkehr wird an ihm nicht gebucht,
 * und eine Mahnung, die sich auf einen Samstag stützt, träfe ins Leere.
 */
export function faelligkeitFuer(
  m: Monat,
  rule: DueDayRule,
  dayOfMonth: number | null | undefined,
): Date {
  if (rule === "FREIER_TAG") {
    // Auf den 28. begrenzt, damit es den Termin in jedem Monat gibt.
    const tag = Math.min(Math.max(dayOfMonth ?? 1, 1), 28);
    return new Date(Date.UTC(m.year, m.month - 1, tag));
  }
  if (rule === "DRITTER_WERKTAG") {
    let gezaehlt = 0;
    for (let tag = 1; tag <= 31; tag++) {
      const d = new Date(Date.UTC(m.year, m.month - 1, tag));
      if (d.getUTCMonth() !== m.month - 1) break; // Monatsende überschritten
      const wochentag = d.getUTCDay(); // 0 = Sonntag, 6 = Samstag
      if (wochentag === 0 || wochentag === 6) continue;
      if (++gezaehlt === 3) return d;
    }
  }
  return new Date(Date.UTC(m.year, m.month - 1, 1));
}

/** Lesbare Form der Regel — für Oberfläche und Beschlussvorlage identisch. */
export function faelligkeitsText(rule: DueDayRule, dayOfMonth: number | null | undefined): string {
  switch (rule) {
    case "DRITTER_WERKTAG":
      return "zum dritten Werktag eines jeden Monats";
    case "FREIER_TAG":
      return `zum ${Math.min(Math.max(dayOfMonth ?? 1, 1), 28)}. eines jeden Monats`;
    default:
      return "zum Ersten eines jeden Monats";
  }
}

export type PlanGeltung = {
  /** Beginn der Geltung (Tagesdatum, inklusive). */
  validFrom: Date;
  /** Ende der Geltung (exklusiv) — null = gilt fort. */
  validUntil: Date | null;
  /** Wirtschaftsjahr des Plans; bestimmt die Zuordnung der Monatsraten. */
  year: number;
};

/**
 * Monate, für die dieser Plan Sollstellungen trägt — bis einschließlich `bis`.
 *
 * Das ist der Kern der Fortgeltung: Der Plan liefert seine zwölf Monatsraten
 * für sein eigenes Wirtschaftsjahr und, solange kein Nachfolger beschlossen
 * ist, **dieselben Raten** für jeden weiteren Monat. Der Eigentümer zahlt also
 * unverändert weiter — genau das ordnet § 28 Abs. 1 Satz 2 WEG an.
 *
 * `rateIndex` ist die Position des Monats im jeweiligen Wirtschaftsjahr (0–11)
 * und damit der Zugriff auf die Ratenliste. Über die Jahresgrenze hinweg
 * beginnt sie wieder bei 0: Die Restcent-Verteilung der Raten soll sich in
 * jedem Jahr gleich verhalten, sonst summierte sich der Jahresbetrag nicht.
 */
export function sollMonate(
  geltung: PlanGeltung,
  fiscalYearStartMonth: number,
  bis: Date,
): (Monat & { rateIndex: number; fiscalYear: number })[] {
  const ergebnis: (Monat & { rateIndex: number; fiscalYear: number })[] = [];
  const grenze = geltung.validUntil && geltung.validUntil < bis ? geltung.validUntil : bis;

  // Bis zu fünf Wirtschaftsjahre vorausdenken. Eine Gemeinschaft, die fünf
  // Jahre lang keinen Plan beschließt, hat ein anderes Problem als fehlende
  // Sollstellungen — und eine unbegrenzte Schleife wäre hier gefährlich.
  for (let fy = geltung.year; fy <= geltung.year + 5; fy++) {
    for (const [index, m] of fiscalYearMonths(fy, fiscalYearStartMonth).entries()) {
      const beginn = monatsBeginn(m);
      if (beginn < geltung.validFrom) continue;
      if (beginn >= grenze) return ergebnis;
      ergebnis.push({ ...m, rateIndex: index, fiscalYear: fy });
    }
  }
  return ergebnis;
}

/**
 * Letzter Monat, für den Sollstellungen entstehen sollen.
 *
 * Bewusst nicht „bis in alle Ewigkeit": Vorschüsse werden monatlich fällig, und
 * eine Forderung, die erst in zwei Jahren fällig wird, hat in den offenen
 * Posten nichts zu suchen. Zugleich reicht der laufende Monat nicht — die
 * Lastschrift des Folgemonats wird vorher eingereicht. Ein Vorlauf von zwei
 * Monaten deckt beides ab.
 */
export function sollHorizont(now: Date, monateVoraus = 2): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monateVoraus + 1, 1));
}
