// Anmeldefrist der Bauabzugsteuer (§ 48a Abs. 1 EStG).
//
// **Die Regel.** Wer nach § 48 EStG einbehalten hat, muss bis zum **10. Tag
// nach Ablauf des Monats**, in dem die Gegenleistung erbracht wurde, eine
// Anmeldung beim Finanzamt des Leistenden abgeben **und** den Betrag abführen.
//
// **Warum das ein eigenes Modul ist.** Bisher warnte das Programm vor der
// Zahlung — das war die halbe Pflicht. Die andere Hälfte kommt danach: Wer
// einbehält und nicht anmeldet, hat dem Handwerker 15 % vorenthalten und dem
// Finanzamt nichts gegeben. Das Geld liegt auf dem Gemeinschaftskonto, sieht
// nach Guthaben aus und ist keines — und die Haftung nach § 48a Abs. 3 EStG
// besteht unverändert fort. Diese Frist verstreicht lautlos; genau deshalb
// gehört sie ins Programm und nicht in den Kopf des Verwalters.
//
// **§ 108 Abs. 3 AO.** Fällt das Fristende auf einen Samstag, Sonntag oder
// gesetzlichen Feiertag, endet die Frist mit Ablauf des nächstfolgenden
// Werktags. Ohne diese Regel meldete das Programm eine Frist als versäumt, die
// noch offen ist — oder drängte zwei Tage zu früh.

/**
 * Ostersonntag eines Jahres (gregorianischer Kalender, Meeus/Butcher).
 *
 * Nötig, weil vier der bundeseinheitlichen Feiertage beweglich sind und drei
 * davon auf einen Zehnten fallen können (Karfreitag und Ostermontag im April,
 * Christi Himmelfahrt im Mai).
 */
export function ostersonntag(jahr: number): Date {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31); // 3 = März, 4 = April
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, monat - 1, tag);
}

/**
 * Die **bundeseinheitlichen** gesetzlichen Feiertage eines Jahres.
 *
 * Bewusst nur diese neun. Landesfeiertage (Fronleichnam, Allerheiligen,
 * Reformationstag …) gelten nicht überall, und § 108 Abs. 3 AO stellt auf den
 * Feiertag am Ort des zuständigen Finanzamts ab. Wer sie hier einträgt, träfe
 * für die Hälfte der Nutzer eine falsche Aussage. Die Folge des Weglassens ist
 * die harmlosere: Das Programm nennt dann höchstens einen Tag zu früh — nie
 * einen zu spät.
 */
export function bundesfeiertage(jahr: number): Date[] {
  const ostern = ostersonntag(jahr);
  const relativ = (tage: number): Date => {
    const d = new Date(ostern);
    d.setDate(d.getDate() + tage);
    return d;
  };
  return [
    new Date(jahr, 0, 1), // Neujahr
    relativ(-2), // Karfreitag
    relativ(1), // Ostermontag
    new Date(jahr, 4, 1), // Tag der Arbeit
    relativ(39), // Christi Himmelfahrt
    relativ(50), // Pfingstmontag
    new Date(jahr, 9, 3), // Tag der Deutschen Einheit
    new Date(jahr, 11, 25),
    new Date(jahr, 11, 26),
  ];
}

function istFeiertag(tag: Date): boolean {
  return bundesfeiertage(tag.getFullYear()).some(
    (f) =>
      f.getFullYear() === tag.getFullYear() &&
      f.getMonth() === tag.getMonth() &&
      f.getDate() === tag.getDate(),
  );
}

/** Samstag, Sonntag oder bundeseinheitlicher Feiertag? */
export function istWerktag(tag: Date): boolean {
  const wochentag = tag.getDay();
  if (wochentag === 0 || wochentag === 6) return false;
  return !istFeiertag(tag);
}

/**
 * Bis wann muss die Zahlung vom `zahlungstag` angemeldet sein?
 *
 * Rückgabe ist der **letzte** Tag der Frist (kein Zeitanteil), nach § 108
 * Abs. 3 AO auf den nächsten Werktag geschoben.
 */
export function anmeldefrist(zahlungstag: Date): Date {
  // Der 10. des Folgemonats. Über `getMonth() + 1` mit Tag 10 — der
  // Date-Konstruktor rollt den Dezember von selbst ins nächste Jahr.
  const frist = new Date(zahlungstag.getFullYear(), zahlungstag.getMonth() + 1, 10);
  while (!istWerktag(frist)) frist.setDate(frist.getDate() + 1);
  return frist;
}

/** Der Monat, auf den sich eine Anmeldung bezieht — als „2026-03". */
export function anmeldemonat(zahlungstag: Date): string {
  return `${zahlungstag.getFullYear()}-${String(zahlungstag.getMonth() + 1).padStart(2, "0")}`;
}

export type Fristlage = "OFFEN" | "BALD" | "UEBERFAELLIG";

/**
 * Wie dringend ist eine Anmeldung?
 *
 * Die Schwelle von sieben Tagen ist kein Gesetz, sondern eine Setzung: Eine
 * Anmeldung braucht die Steuernummer des Leistenden und den Vordruck des
 * Finanzamts — eine Woche ist knapp, aber machbar. Am Fristtag selbst ist die
 * Frist noch offen (§ 108 Abs. 1 AO i. V. m. § 188 Abs. 1 BGB: sie endet mit
 * **Ablauf** des Tages), deshalb `>` und nicht `>=`.
 */
export function fristlage(frist: Date, heute: Date): Fristlage {
  const tagesbeginn = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const differenzTage =
    (tagesbeginn(frist).getTime() - tagesbeginn(heute).getTime()) / 86_400_000;
  if (differenzTage < 0) return "UEBERFAELLIG";
  if (differenzTage <= 7) return "BALD";
  return "OFFEN";
}
