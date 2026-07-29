// Kontoauszug einer Einheit — die Gegenseite der Mahnung.
//
// **Warum es das braucht.** Der Verwalter sieht Rückstände, Zinsen und
// Mahnstufen. Der Eigentümer sah bisher nur zwei Summen: „Soll" und „Gezahlt".
// Wer bei einer Differenz wissen will, *woran* es liegt — welcher Monat offen
// ist, ob die Überweisung vom März angekommen ist —, konnte das nicht
// nachvollziehen. Was gemahnt wird, muss der Gemahnte prüfen können; sonst
// bleibt ihm nur, dem Programm zu glauben.
//
// **Warum aus den Zuordnungen und nicht aus zwei Summen.** Genau diese
// Differenzrechnung war der Fehler, den KP9 beseitigt hat: Eine Vorauszahlung
// konnte einen offenen Monat verdecken. Der Auszug führt deshalb Bewegungen,
// keine Salden — jede Sollstellung als Belastung, jede angerechnete Zahlung als
// Gutschrift, in der Reihenfolge, in der sie entstanden sind.

export type AuszugZeile = {
  datum: Date;
  art: "SOLL" | "ZAHLUNG";
  text: string;
  /** Positiv = Forderung der Gemeinschaft, negativ = Zahlung des Eigentümers. */
  betragCents: number;
  /** Stand nach dieser Zeile. Positiv = offen. */
  saldoCents: number;
  /**
   * Fällig erst in der Zukunft — noch kein Rückstand.
   *
   * Der Auszug zeigt kommende Monate bewusst mit an: Wer wissen will, was auf
   * ihn zukommt, findet es hier. Sie dürfen aber **nicht** in den Stand von
   * heute einfließen. Genau das war beim ersten Prüflauf der Fall: Ein
   * Eigentümer mit 1.575 € Rückstand las „3.599,80 € offen", weil zwölf noch
   * nicht fällige Monate mitgezählt wurden. Ein Programm, das jemandem das
   * Doppelte seiner Schuld nennt, verliert sein Vertrauen an dieser Stelle
   * endgültig.
   */
  kuenftig: boolean;
};

export type Sollstellung = {
  dueDate: Date;
  amountCents: number;
  periodYear: number;
  periodMonth: number;
  source: string;
};

export type Anrechnung = {
  /** Tag der Zahlung, nicht der Zuordnung — es zählt, wann das Geld da war. */
  bookingDate: Date;
  betragCents: number;
  text: string;
};

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/**
 * Baut den Auszug.
 *
 * **Sortierung nach Datum, bei Gleichstand die Belastung vor der Gutschrift.**
 * Sonst stünde am Fälligkeitstag erst die Zahlung und danach die Forderung, und
 * der Saldo sähe zwischendurch nach einem Guthaben aus, das es nie gab.
 */
export function baueKontoauszug(
  sollstellungen: Sollstellung[],
  anrechnungen: Anrechnung[],
  stichtag: Date = new Date(),
): AuszugZeile[] {
  const zeilen: Omit<AuszugZeile, "saldoCents" | "kuenftig">[] = [
    ...sollstellungen.map((s) => ({
      datum: s.dueDate,
      art: "SOLL" as const,
      text:
        s.source === "SONDERUMLAGE"
          ? "Sonderumlage"
          : `Hausgeld ${MONATE[s.periodMonth - 1] ?? ""} ${s.periodYear}`.trim(),
      betragCents: s.amountCents,
    })),
    ...anrechnungen.map((a) => ({
      datum: a.bookingDate,
      art: "ZAHLUNG" as const,
      text: a.text,
      betragCents: -a.betragCents,
    })),
  ];

  zeilen.sort((a, b) => {
    const d = a.datum.getTime() - b.datum.getTime();
    if (d !== 0) return d;
    if (a.art === b.art) return 0;
    return a.art === "SOLL" ? -1 : 1;
  });

  let saldo = 0;
  return zeilen.map((z) => {
    saldo += z.betragCents;
    return { ...z, saldoCents: saldo, kuenftig: z.datum > stichtag };
  });
}

/**
 * Der Stand **heute** — positiv heißt „offen".
 *
 * Nimmt die letzte Zeile, die nicht in der Zukunft liegt. Bewusst aus der
 * Tabelle und nicht getrennt gerechnet: Zwei Wege zu derselben Zahl laufen
 * früher oder später auseinander, und dann widerspricht die Fußzeile der
 * Tabelle darüber.
 */
export function saldoHeute(zeilen: AuszugZeile[]): number {
  const bisHeute = zeilen.filter((z) => !z.kuenftig);
  return bisHeute.length === 0 ? 0 : bisHeute[bisHeute.length - 1].saldoCents;
}
