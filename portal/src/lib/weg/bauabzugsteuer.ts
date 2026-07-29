// Bauabzugsteuer nach §§ 48–48d EStG.
//
// **Worum es geht.** Wer eine Bauleistung für sein Unternehmen bezieht, muss
// 15 % des Rechnungsbetrags einbehalten und ans Finanzamt abführen (§ 48
// Abs. 1 Satz 1 EStG). Eine Wohnungseigentümergemeinschaft ist seit 2020
// rechtsfähig und gilt als Leistungsempfängerin in diesem Sinne.
//
// **Warum das hier steht.** Unterbleibt der Einbehalt zu Unrecht, haftet der
// Leistungsempfänger für den nicht abgeführten Betrag (§ 48a Abs. 3 EStG) —
// also die Gemeinschaft, und damit alle Eigentümer. Ein selbstverwaltender
// Eigentümer weiß davon in aller Regel nichts. Das ist kein Komfortmerkmal,
// sondern der Grund, warum dieses Modul existiert.
//
// **Zwei Auswege, beide im Programm abgebildet:**
//
// 1. **Freistellungsbescheinigung** (§ 48b EStG). Legt der Handwerker eine
//    gültige vor, entfällt der Einbehalt. Das ist der Normalfall — die meisten
//    Betriebe haben eine. Deshalb hält `Craftsman` sie fest; ohne diese Angabe
//    warnte das Programm bei jedem einzelnen Handwerker und wäre nach dem
//    dritten Mal weggeklickt.
// 2. **Bagatellgrenze** (§ 48 Abs. 2 EStG). Bleibt die Gegenleistung an
//    denselben Leistenden im laufenden Kalenderjahr unter 5.000 €, entfällt der
//    Einbehalt ebenfalls.
//
// **Was dieses Modul bewusst NICHT tut:** rechnen, was abzuführen ist, und
// Formulare erzeugen. Es warnt, bevor gezahlt wird — danach ist ein Einbehalt
// nicht mehr möglich und es bleibt nur noch die Haftung.

/**
 * Bagatellgrenze je Leistendem und Kalenderjahr (§ 48 Abs. 2 Satz 1 Nr. 2 EStG).
 *
 * Der bewusst einzige Ort, an dem diese Zahl steht.
 *
 * **Zur zweiten Grenze von 15.000 €** (§ 48 Abs. 2 Satz 1 Nr. 1 EStG): Sie gilt,
 * wenn der Leistungsempfänger ausschließlich steuerfreie Vermietungsumsätze
 * nach § 4 Nr. 12 Satz 1 UStG ausführt. Die Leistungen einer WEG an ihre
 * Eigentümer sind nach § 4 Nr. **13** UStG steuerfrei — eine andere Nummer.
 * Ob die höhere Grenze für eine WEG greift, ist deshalb eine Frage an den
 * Steuerberater und nicht aus dem Gesetzeswortlaut zu beantworten. Bis das
 * geklärt ist, rechnet das Programm mit der **niedrigeren** Grenze: Wer zu früh
 * warnt, verursacht eine Rückfrage. Wer zu spät warnt, verursacht eine Haftung.
 */
export const BAGATELLGRENZE_CENTS = 500_000;

/** Einbehalt in Prozent (§ 48 Abs. 1 Satz 1 EStG). */
export const EINBEHALT_PROZENT = 15;

export type Freistellung = {
  /** Sicherheitsnummer der Bescheinigung; ohne sie gilt sie als nicht vorgelegt. */
  nummer: string | null;
  gueltigBis: Date | null;
};

export type Pruefung =
  | { pflicht: false; grund: "KEINE_BAULEISTUNG" | "FREISTELLUNG" | "UNTER_GRENZE" }
  | {
      pflicht: true;
      grund: "GRENZE_UEBERSCHRITTEN" | "FREISTELLUNG_ABGELAUFEN";
      /** Was dieses Jahr bereits an denselben Handwerker gezahlt wurde. */
      bisherCents: number;
      /** Summe inklusive der geplanten Zahlung. */
      gesamtCents: number;
      /** 15 % der geplanten Zahlung — der Betrag, der einzubehalten wäre. */
      einbehaltCents: number;
    };

/**
 * Ist eine Freistellungsbescheinigung am Stichtag gültig?
 *
 * Maßgeblich ist der Tag der Zahlung, nicht der Tag der Rechnung: Der Einbehalt
 * knüpft an die Gegenleistung an. Eine Bescheinigung ohne Nummer zählt nicht —
 * dann ist nichts vorgelegt worden, sondern nur ein Datum eingetragen.
 */
export function freistellungGueltig(f: Freistellung, stichtag: Date): boolean {
  if (!f.nummer) return false;
  if (!f.gueltigBis) return false;
  // Der Gültigkeitstag selbst zählt noch mit — die Bescheinigung läuft mit
  // Ablauf des Tages ab, nicht um 0:00 Uhr.
  return endeDesTages(f.gueltigBis) >= stichtag;
}

function endeDesTages(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

/**
 * Muss von dieser Zahlung etwas einbehalten werden?
 *
 * @param bisherCents  Bereits in diesem Kalenderjahr an denselben Leistenden
 *                     gezahlte Bauleistungen (siehe `bauleistungenImJahr`).
 * @param betragCents  Die geplante Zahlung.
 */
export function pruefeEinbehalt(opt: {
  bauleistung: boolean;
  freistellung: Freistellung;
  bisherCents: number;
  betragCents: number;
  stichtag: Date;
}): Pruefung {
  if (!opt.bauleistung) return { pflicht: false, grund: "KEINE_BAULEISTUNG" };

  const gesamtCents = opt.bisherCents + opt.betragCents;
  const einbehaltCents = Math.round((opt.betragCents * EINBEHALT_PROZENT) / 100);

  // Reihenfolge mit Bedacht: Erst die Grenze, dann die Bescheinigung. Bleibt
  // man unter der Bagatellgrenze, ist die Bescheinigung gleichgültig — eine
  // Warnung „Bescheinigung abgelaufen" wäre dort schlicht überflüssig.
  if (gesamtCents <= BAGATELLGRENZE_CENTS) return { pflicht: false, grund: "UNTER_GRENZE" };

  if (freistellungGueltig(opt.freistellung, opt.stichtag)) {
    return { pflicht: false, grund: "FREISTELLUNG" };
  }

  return {
    pflicht: true,
    // Eine abgelaufene Bescheinigung ist die häufigere und ärgerlichere Lage:
    // Sie lag einmal vor, niemand hat auf das Datum geschaut. Das gehört anders
    // benannt als „gab es noch nie", weil die Abhilfe eine andere ist — beim
    // Handwerker die neue Bescheinigung anfordern.
    grund: opt.freistellung.nummer ? "FREISTELLUNG_ABGELAUFEN" : "GRENZE_UEBERSCHRITTEN",
    bisherCents: opt.bisherCents,
    gesamtCents,
    einbehaltCents,
  };
}

/** Grenzen des Kalenderjahres — nicht des Wirtschaftsjahres. */
export function kalenderjahr(stichtag: Date): { von: Date; bis: Date } {
  // § 48 Abs. 2 EStG stellt auf das **laufende Kalenderjahr** ab. Das
  // Wirtschaftsjahr einer WEG darf davon abweichen (`fiscalYearStartMonth`);
  // wer hier das Wirtschaftsjahr nähme, käme bei jeder WEG mit abweichendem
  // Jahr auf eine falsche Summe.
  const jahr = stichtag.getFullYear();
  return { von: new Date(jahr, 0, 1), bis: new Date(jahr + 1, 0, 1) };
}

/**
 * Wie nah ist der Handwerker an der Grenze? Für die Anzeige in der Liste.
 *
 * Die Warnung erst beim Überschreiten zu zeigen, wäre zu spät gedacht: Wer bei
 * 4.800 € steht, sollte die Bescheinigung **vor** dem nächsten Auftrag
 * anfordern, nicht mitten in der Zahlung.
 */
export function naeheZurGrenze(bisherCents: number): "FREI" | "NAH" | "UEBER" {
  if (bisherCents > BAGATELLGRENZE_CENTS) return "UEBER";
  if (bisherCents >= (BAGATELLGRENZE_CENTS * 4) / 5) return "NAH";
  return "FREI";
}
