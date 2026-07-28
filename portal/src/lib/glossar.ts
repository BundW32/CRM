// Fachbegriffe der WEG-Verwaltung, in einem Satz erklärt.
//
// Das Programm richtet sich an Gemeinschaften, die sich selbst verwalten. Die
// Begriffe stammen aber aus dem Wohnungseigentumsgesetz und der Buchhaltung —
// „Abrechnungsspitze", „Sollstellung", „Miteigentumsanteil". Wer sie nicht
// kennt, kann die Zahl daneben nicht einordnen.
//
// **Die Begriffe werden nicht ersetzt.** Das war die naheliegende Idee und wäre
// falsch: Der Beirat, der Steuerberater und das Gericht benutzen genau diese
// Wörter. Wer sie umbenennt, macht das Programm für Laien verständlich und für
// alle anderen unbenutzbar — und der Eigentümer lernt nie, wovon in seiner
// Versammlung die Rede ist. Die Erklärung tritt daneben, nicht an die Stelle.
//
// Ein Satz je Begriff. Zwei liest niemand, der gerade etwas anderes vorhat.

export type Glossareintrag = {
  /** Ein Satz, in der Sprache eines Eigentümers. */
  erklaerung: string;
  /** Fundstelle im Gesetz — der Beleg, dass hier nichts erfunden wird. */
  paragraph?: string;
};

export const GLOSSAR = {
  sollstellung: {
    erklaerung:
      "Die Forderung der Gemeinschaft gegen eine Einheit für einen Monat — das, was der Eigentümer zahlen muss, bevor er es zahlt.",
    paragraph: "§ 28 Abs. 1 WEG",
  },
  abrechnungsspitze: {
    erklaerung:
      "Die Differenz zwischen den tatsächlichen Kosten des Jahres und dem, was Sie über das Hausgeld schon vorausgezahlt haben. Nur über sie beschließt die Versammlung.",
    paragraph: "§ 28 Abs. 2 WEG",
  },
  wirtschaftsplan: {
    erklaerung:
      "Die Vorausschau auf das kommende Jahr: geplante Ausgaben und Einnahmen, daraus das monatliche Hausgeld je Einheit.",
    paragraph: "§ 28 Abs. 1 WEG",
  },
  jahresabrechnung: {
    erklaerung:
      "Die Abrechnung des vergangenen Jahres — was tatsächlich eingenommen und ausgegeben wurde, auf die Einheiten verteilt.",
    paragraph: "§ 28 Abs. 2 WEG",
  },
  wirtschaftsjahr: {
    erklaerung:
      "Der Zeitraum, über den abgerechnet wird. Meist das Kalenderjahr, aber die Gemeinschaft kann es anders festlegen.",
  },
  erhaltungsruecklage: {
    erklaerung:
      "Das Gespartes für größere Reparaturen, streng getrennt vom laufenden Konto. Früher „Instandhaltungsrücklage“ genannt.",
    paragraph: "§ 19 Abs. 2 Nr. 4 WEG",
  },
  umlageschluessel: {
    erklaerung:
      "Nach welchem Maßstab eine Kostenart auf die Einheiten verteilt wird — Miteigentumsanteile, Wohnfläche, Personenzahl oder Verbrauch.",
    paragraph: "§ 16 Abs. 2 WEG",
  },
  miteigentumsanteil: {
    erklaerung:
      "Ihr Anteil am gemeinschaftlichen Eigentum, meist in Tausendsteln. Er steht in der Teilungserklärung und ist der übliche Verteilungsmaßstab.",
  },
  vorschuss: {
    erklaerung:
      "Das monatliche Hausgeld. Es ist eine Vorauszahlung auf die Kosten des Jahres — abgerechnet wird erst danach.",
    paragraph: "§ 28 Abs. 1 WEG",
  },
  sonderumlage: {
    erklaerung:
      "Eine einmalige zusätzliche Zahlung, beschlossen für einen bestimmten Zweck — etwa eine Dachsanierung, für die die Rücklage nicht reicht.",
  },
  storno: {
    erklaerung:
      "Die Rücknahme einer falschen Buchung durch eine Gegenbuchung. Buchungen werden nie gelöscht, damit die Historie nachvollziehbar bleibt.",
  },
  beirat: {
    erklaerung:
      "Von der Versammlung gewählte Eigentümer, die die Verwaltung unterstützen und die Jahresabrechnung vor der Beschlussfassung prüfen.",
    paragraph: "§ 29 WEG",
  },
  vermoegensbericht: {
    erklaerung:
      "Eine Übersicht am Jahresende: Was besitzt die Gemeinschaft, was schuldet sie, wie hoch ist die Rücklage?",
    paragraph: "§ 28 Abs. 4 WEG",
  },
  umlaufbeschluss: {
    erklaerung:
      "Ein Beschluss ohne Versammlung, schriftlich eingeholt. Er verlangt die Zustimmung **aller** Eigentümer, nicht nur der Mehrheit.",
    paragraph: "§ 23 Abs. 3 WEG",
  },
  verzug: {
    erklaerung:
      "Der Zustand nach Ablauf der Fälligkeit: Ab dann schuldet der Eigentümer zusätzlich Zinsen und trägt die Kosten der Beitreibung.",
    paragraph: "§ 286 BGB",
  },
} as const satisfies Record<string, Glossareintrag>;

export type Begriffsname = keyof typeof GLOSSAR;

/** Alle Begriffe — für Übersicht und Test. */
export const BEGRIFFE = Object.keys(GLOSSAR) as Begriffsname[];
