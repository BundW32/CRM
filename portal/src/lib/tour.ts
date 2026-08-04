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

/**
 * Wen die Führung vor sich hat.
 *
 * Nicht dasselbe wie der Kontotyp der Organisation: Eine selbstverwaltete WEG
 * hat **einen** verwaltenden Eigentümer und daneben alle übrigen Eigentümer und
 * Mieter. Ohne diese Unterscheidung bekam Max Mieter beim ersten Anmelden den
 * Satz „Sie verwalten Ihre Gemeinschaft ab jetzt selbst" zu lesen und danach
 * drei leere Schritte über Bereiche, die in seinem Menü gar nicht stehen.
 */
export type TourRolle = "verwalter" | "eigentuemer" | "mieter";

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
  /** Gegenstück: nur für die professionelle Verwaltung. */
  nurVerwaltung?: boolean;
  /**
   * Für welche Rollen dieser Schritt gilt. Fehlt die Angabe, gilt er für alle.
   *
   * **Die Regel dahinter:** Ein Schritt darf nur zeigen, was der Angemeldete
   * auch sehen kann. Das Menü unterscheidet sich je Rolle erheblich —
   * `/verwaltung/weg` steht ausschließlich in den beiden Verwalter-Menüs, und
   * die Einrichtungs-Karte rendert nur für den verwaltenden Eigentümer.
   */
  rollen?: TourRolle[];
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
  // Zwei Begrüßungen statt einer. „Sie verwalten Ihre Gemeinschaft ab jetzt
  // selbst" ist für einen professionellen Verwalter schlicht falsch — und ein
  // Programm, das im ersten Satz danebenliegt, verspielt genau dort das
  // Zutrauen, wo es am meisten zählt. Aufgefallen ist es erst im Prüflauf mit
  // Kontotyp „verwaltung".
  {
    titel: "Willkommen — kurz erklärt",
    text:
      "Sie verwalten Ihre Gemeinschaft ab jetzt selbst. Dieses Programm nimmt Ihnen dabei das ab, wofür man sonst eine Hausverwaltung bezahlt: Hausgeld einziehen, abrechnen, Beschlüsse festhalten. In einer Minute zeigen wir Ihnen, wo was liegt.",
    nurSelbstverwaltung: true,
    rollen: ["verwalter"],
  },
  {
    titel: "Willkommen — kurz erklärt",
    text:
      "Dieses Programm bündelt Ihre Verwaltung an einem Ort: Objekte und Personen, Vorgänge und Wartung, für WEG-Objekte zusätzlich Hausgeld, Wirtschaftsplan und Jahresabrechnung. In einer Minute zeigen wir Ihnen, wo was liegt.",
    nurVerwaltung: true,
    rollen: ["verwalter"],
  },
  {
    titel: "Willkommen — kurz erklärt",
    text:
      "Über dieses Portal läuft alles, was Ihre Wohnung und Ihre Gemeinschaft betrifft: Abstimmungen und Beschlüsse, Ihre Abrechnung, Zählerstände und der Draht zur Verwaltung. Sie müssen nichts einrichten — in einer Minute zeigen wir Ihnen, wo was liegt.",
    rollen: ["eigentuemer"],
  },
  {
    titel: "Willkommen — kurz erklärt",
    text:
      "Über dieses Portal erreichen Sie Ihre Verwaltung: Schäden melden und den Stand verfolgen, Ihre Unterlagen abrufen, Zählerstände melden und Aushänge lesen. Sie müssen nichts einrichten — in einer Minute zeigen wir Ihnen, wo was liegt.",
    rollen: ["mieter"],
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
    // Zwei Fallen, beide durch Prüfläufe aufgedeckt:
    //
    // 1. „Alles liegt links" stimmt nur am Rechner — auf dem Handy sitzt die
    //    Leiste hinter dem Menü-Knopf.
    // 2. Die alte Fassung zählte die Gruppen auf („Alltag, Stammdaten, WEG,
    //    Betrieb"). So heißen sie nur beim professionellen Verwalter. Die
    //    Selbstverwaltung hat andere, und Eigentümer und Mieter haben gar keine
    //    Gruppen, sondern eine kurze flache Liste. Der Text stimmte also für
    //    drei von vier Zielgruppen nicht.
    text:
      "Von hier aus erreichen Sie jeden Bereich des Programms, nach Themen sortiert. Die Leiste ist auf jeder Seite dieselbe — am Rechner steht sie links, auf dem Handy hinter dem Menü-Knopf.",
  },
  {
    ziel: "nav-verwaltung-weg",
    titel: "Hier lebt das Geld der Gemeinschaft",
    // Ohne Namensnennung. Derselbe Menüpunkt heißt je nach Rolle und Kontotyp
    // „WEG-Finanzen" oder „Finanzen & Buchhaltung" — der Screenshot-Durchgang
    // zeigte den einen Namen im Text und den anderen im ausgeleuchteten
    // Menüpunkt darüber. Der Lichtkegel sagt ohnehin, wo es steht.
    text:
      "Hier liegen Kontostände, Hausgeld, Wirtschaftsplan und Jahresabrechnung. Das Programm rechnet die Verteilung auf die Einheiten selbst aus und erzeugt die Abrechnung, die Sie in der Versammlung vorlegen.",
    nurSelbstverwaltung: true,
    rollen: ["verwalter"],
  },
  {
    ziel: "einrichtung",
    pfad: "/dashboard",
    nurSelbstverwaltung: true,
    rollen: ["verwalter"],
    titel: "Ihr nächster Schritt steht oben",
    text:
      "Die Einrichtung hat eine feste Reihenfolge, weil eines auf dem anderen aufbaut. Sie müssen sie nicht kennen: Es ist immer genau ein Schritt hervorgehoben, und daneben steht, wozu er gut ist.",
  },
  {
    ziel: "was-ansteht",
    pfad: "/dashboard",
    nurSelbstverwaltung: true,
    rollen: ["verwalter"],
    titel: "Was ansteht — ohne Kalender im Kopf",
    text:
      // Bewusst im Futur. Der „Fahrplan" erscheint erst, wenn die Einrichtung
      // fertig ist — genau der Zustand, in dem diese Führung *nicht* läuft.
      // Ein Text, der behauptet, die Liste stehe schon da, schickt einen
      // Anfänger auf die Suche nach etwas, das es noch gar nicht geben kann.
      "Eine Gemeinschaft hat feste Fristen: einmal im Jahr eine Versammlung, danach die Abrechnung, vorher der Plan fürs nächste Jahr. Sobald die Einrichtung steht, führt das Programm hier den Fahrplan — es sagt Ihnen, was jetzt dran ist, und warnt, bevor etwas überfällig wird.",
  },
  // Für alle, die nicht verwalten. Vorher endete die Führung für sie nach der
  // Bereichsleiste — es folgten drei Schritte über Einrichtung und Geld, die in
  // ihrem Menü gar nicht vorkommen und deshalb als leere Karten erschienen.
  {
    ziel: "nav-beschluesse",
    rollen: ["eigentuemer"],
    titel: "Ihre Stimme",
    text:
      "Als Eigentümer entscheiden Sie mit. Umlaufbeschlüsse stimmen Sie hier direkt ab; über Punkte einer Versammlung wird in der Versammlung abgestimmt, hier steht danach das Ergebnis. Jeder gefasste Beschluss bleibt dauerhaft nachlesbar.",
  },
  {
    ziel: "nav-finanzen",
    rollen: ["eigentuemer"],
    titel: "Ihr Geld",
    text:
      "Was Sie monatlich zahlen, was davon offen ist und Ihre Jahresabrechnung — alles an einer Stelle. Die Abrechnung weist auch den Anteil aus, den Sie in Ihrer Steuererklärung geltend machen können.",
  },
  {
    ziel: "nav-vorgaenge",
    rollen: ["mieter"],
    titel: "Etwas ist kaputt",
    text:
      "Melden Sie einen Schaden hier statt per Telefon: Sie sehen jederzeit, wie weit die Sache ist, wer sie bearbeitet und wann ein Handwerker kommt. Nichts geht mehr auf dem Weg verloren.",
  },
  {
    ziel: "nav-dokumente",
    rollen: ["eigentuemer", "mieter"],
    titel: "Ihre Unterlagen",
    text:
      "Abrechnungen, Protokolle, Hausordnung und Verträge liegen hier — auch Jahre später noch. Was nur Sie betrifft, sieht auch nur Sie.",
  },
  {
    ziel: "assistent",
    nurMitAssistent: true,
    // Kein Assistenten-Schritt für Mieter: Er ist auf die Gemeinschaft und das
    // Wohnungseigentumsrecht zugeschnitten — für jemanden, der zur Miete wohnt,
    // wäre das eine Antwort auf eine Frage, die er nicht hat.
    rollen: ["verwalter", "eigentuemer"],
    titel: "Wenn Sie nicht weiterwissen",
    text:
      "Der Assistent kennt Ihre Gemeinschaft und die Regeln des Wohnungseigentumsgesetzes. Fragen Sie ihn in normalen Worten — „Wann muss ich zur Versammlung einladen?“ genügt. Er gibt Auskunft, keine Rechtsberatung.",
  },
];

/** Die Schritte, die in dieser Umgebung gelten. */
export function tourSchritteFuer(opt: {
  selbstverwaltung: boolean;
  mitAssistent: boolean;
  rolle: TourRolle;
}): TourSchritt[] {
  return TOUR_SCHRITTE.filter(
    (s) =>
      (!s.nurSelbstverwaltung || opt.selbstverwaltung) &&
      (!s.nurVerwaltung || !opt.selbstverwaltung) &&
      (!s.nurMitAssistent || opt.mitAssistent) &&
      (!s.rollen || s.rollen.includes(opt.rolle)),
  );
}
