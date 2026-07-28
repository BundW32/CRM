// Inhalte der geführten Ersteinrichtung.
//
// Getrennt von der Mechanik (`components/tour.tsx`), weil hier das Eigentliche
// steht: **was das Programm tut** — nicht, wo welcher Knopf sitzt. Eine Führung,
// die nur auf Schaltflächen zeigt, erklärt Bedienung. Wer seine WEG zum ersten
// Mal selbst verwaltet, braucht aber zuerst die Antwort auf „wozu ist das da".
//
// Drei Regeln für jeden Text hier:
//
// 1. **In der Sprache eines Eigentümers.** Kein „Sollstellung", kein „Umlage" —
//    dafür gibt es das Glossar an der Stelle, an der es gebraucht wird.
// 2. **Zwei Sätze, höchstens drei.** Wer eine Führung wegklickt, tut es beim
//    vierten Satz.
// 3. **Sagen, was es einem bringt.** „Hier stehen Ihre Konten" ist eine
//    Ortsangabe. „Hier sehen Sie, ob das Geld der Gemeinschaft reicht" ist eine
//    Antwort.
//
// Höchstens sieben Schritte. Länger liest niemand — und wenn eine Führung
// nötig ist, damit jemand einen Knopf findet, ist zuerst der Knopf falsch.

export type TourSchritt = {
  /** Marker am Ziel (`data-tour="…"`). Ohne Ziel: zentrierte Karte. */
  ziel?: string;
  /**
   * Seite, auf der das Ziel steht. Die Führung wechselt dorthin, bevor sie den
   * Lichtkegel setzt.
   *
   * Ohne diese Angabe zeigte die Führung ins Leere, sobald ein Ziel nicht
   * zufällig auf der aktuellen Seite lag — beim ersten Prüflauf traf genau ein
   * Schritt von sechs. Marker in der Navigation und im Rahmen (Assistent)
   * brauchen sie nicht: Die stehen auf jeder Seite.
   */
  pfad?: string;
  titel: string;
  text: string;
  /**
   * Nur für Selbstverwaltung zeigen. Zwei Gründe: Ein professioneller
   * Verwalter kennt seine Werkzeuge, und die Ziele „Einrichtung" und „Was
   * ansteht" stehen auf dem Selbstverwalter-Dashboard — bei ihm gäbe es sie
   * gar nicht.
   */
  nurSelbstverwaltung?: boolean;
  /**
   * Nur zeigen, wenn der Assistent überhaupt eingeschaltet ist.
   *
   * Beim Prüflauf fiel auf: Ohne API-Schlüssel gibt es das Widget nicht — die
   * Führung pries damit ein Merkmal an, das der Nutzer anschließend vergeblich
   * sucht. Eine Einführung, die Dinge verspricht, die es nicht gibt, ist
   * schlimmer als eine, die schweigt.
   */
  nurMitAssistent?: boolean;
};

export const TOUR_SCHRITTE: TourSchritt[] = [
  {
    titel: "Willkommen — kurz erklärt",
    text:
      "Sie verwalten Ihre Gemeinschaft ab jetzt selbst. Dieses Programm nimmt Ihnen dabei das ab, wofür man sonst eine Hausverwaltung bezahlt: Hausgeld einziehen, abrechnen, Beschlüsse festhalten. In einer Minute zeigen wir Ihnen, wo was liegt.",
  },
  {
    ziel: "hinweise-schalter",
    pfad: "/konto",
    titel: "Erklärungen sind eingeschaltet",
    text:
      "Überall im Programm stehen kurze Erläuterungen zu Fachbegriffen und Eingaben — unterstrichene Wörter erklären sich, wenn Sie darauf zeigen. Wenn Sie das Programm kennen, schalten Sie die Hinweise unter „Konto“ wieder ab.",
  },
  {
    ziel: "navigation",
    titel: "Die Bereichsleiste",
    // Bewusst geräteunabhängig formuliert. „Alles liegt links" stimmte nur am
    // Rechner — auf dem Handy sitzt die Leiste hinter dem Menü-Knopf, und der
    // Prüflauf bei 390 px zeigte eine Erklärung, die dort nicht zutrifft.
    text:
      "Hier ist alles nach Themen sortiert: Alltag fürs Tagesgeschäft, Stammdaten für Objekte und Personen, WEG für Beschlüsse und Geld, Betrieb für Zähler und Wartung. Am Rechner steht sie links, auf dem Handy hinter dem Menü-Knopf.",
  },
  {
    ziel: "nav-verwaltung-weg",
    titel: "Hier lebt das Geld der Gemeinschaft",
    text:
      "Unter „WEG-Finanzen“ liegen Kontostände, Hausgeld, Wirtschaftsplan und Jahresabrechnung. Das Programm rechnet die Verteilung auf die Einheiten selbst aus und erzeugt die Abrechnung, die Sie in der Versammlung vorlegen.",
    nurSelbstverwaltung: true,
  },
  {
    ziel: "einrichtung",
    pfad: "/dashboard",
    nurSelbstverwaltung: true,
    titel: "Ihr nächster Schritt steht oben",
    text:
      "Die Einrichtung hat eine feste Reihenfolge, weil eines auf dem anderen aufbaut. Sie müssen sie nicht kennen: Es ist immer genau ein Schritt hervorgehoben, und daneben steht, wozu er gut ist.",
  },
  {
    ziel: "was-ansteht",
    pfad: "/dashboard",
    nurSelbstverwaltung: true,
    titel: "Was ansteht — ohne Kalender im Kopf",
    text:
      "Eine Gemeinschaft hat Fristen: einmal im Jahr eine Versammlung, danach die Abrechnung, vorher der Plan fürs nächste Jahr. Das Programm sagt Ihnen, was jetzt dran ist, und warnt, bevor etwas überfällig wird.",
  },
  {
    ziel: "assistent",
    nurMitAssistent: true,
    titel: "Wenn Sie nicht weiterwissen",
    text:
      "Der Assistent kennt Ihre Gemeinschaft und die Regeln des Wohnungseigentumsgesetzes. Fragen Sie ihn in normalen Worten — „Wann muss ich zur Versammlung einladen?“ genügt. Die Führung starten Sie jederzeit neu unter „Konto“.",
  },
];

/** Die Schritte, die in dieser Umgebung gelten. */
export function tourSchritteFuer(opt: {
  selbstverwaltung: boolean;
  mitAssistent: boolean;
}): TourSchritt[] {
  return TOUR_SCHRITTE.filter(
    (s) =>
      (!s.nurSelbstverwaltung || opt.selbstverwaltung) &&
      (!s.nurMitAssistent || opt.mitAssistent),
  );
}
