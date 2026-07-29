// Vermögensbericht nach § 28 Abs. 4 WEG.
//
// **Was das Gesetz verlangt.** Der Verwalter hat nach Ablauf des Kalenderjahres
// einen Vermögensbericht zu erstellen, der den Stand der Erhaltungsrücklage
// **und** eine Aufstellung des wesentlichen Gemeinschaftsvermögens enthält.
//
// **Was bisher fehlte.** Das Programm zeigte Rücklage, Kontostände und
// Hausgeldrückstände — also ausschließlich das, was der Gemeinschaft zusteht.
// Darunter stand der Satz, Verbindlichkeiten würden „derzeit nicht erfasst".
// Ein Bericht, der nur die Haben-Seite kennt, ist kein Vermögensbericht: Eine
// Gemeinschaft mit 40.000 € Rücklage und einem Darlehen über 60.000 € steht
// nicht mit 40.000 € da. Und er ist auf die gefährliche Weise falsch — er sieht
// zu gut aus, und danach wird über Sonderumlagen entschieden.
//
// **Warum die Verbindlichkeiten von Hand gepflegt werden** und nicht aus der
// Buchhaltung fallen: Eine noch nicht bezahlte Rechnung ist gerade **keine**
// Buchung. Sie liegt im Ordner. Ableiten ließe sich nur, was schon gezahlt
// wurde — und das ist keine Verbindlichkeit mehr.

export type VermoegensPosten = {
  bezeichnung: string;
  cents: number;
  /** Erläuterung für den Bericht; erscheint klein unter der Bezeichnung. */
  hinweis?: string;
};

export type VerbindlichkeitEingabe = {
  title: string;
  creditor: string | null;
  kind: "RECHNUNG" | "DARLEHEN" | "SONSTIGE";
  amountCents: number;
  incurredOn: Date;
  settledAt: Date | null;
};

export type Vermoegensbericht = {
  aktiva: VermoegensPosten[];
  passiva: VermoegensPosten[];
  aktivaCents: number;
  passivaCents: number;
  /** Aktiva minus Passiva. Kann negativ sein — dann ist die WEG überschuldet. */
  reinvermoegenCents: number;
};

/**
 * Zählt eine Verbindlichkeit zum Stichtag?
 *
 * Zwei Bedingungen, beide unverzichtbar:
 *
 * - Sie muss **entstanden** sein (`incurredOn <= stichtag`). Eine Rechnung vom
 *   Februar gehört nicht in den Bericht zum 31.12. des Vorjahres.
 * - Sie darf am Stichtag noch **nicht beglichen** gewesen sein. Beglichen wird
 *   hier nichts gelöscht: Sonst änderte sich ein bereits beschlossener Bericht
 *   rückwirkend, sobald jemand eine alte Rechnung bezahlt.
 */
export function offenAmStichtag(v: VerbindlichkeitEingabe, stichtag: Date): boolean {
  if (v.incurredOn > stichtag) return false;
  return v.settledAt === null || v.settledAt > stichtag;
}

const KIND_LABEL: Record<VerbindlichkeitEingabe["kind"], string> = {
  RECHNUNG: "offene Rechnung",
  DARLEHEN: "Darlehen",
  SONSTIGE: "sonstige Verbindlichkeit",
};

export function baueVermoegensbericht(opt: {
  ruecklageCents: number;
  girokontenCents: number;
  forderungenCents: number;
  verbindlichkeiten: VerbindlichkeitEingabe[];
  stichtag: Date;
}): Vermoegensbericht {
  const aktiva: VermoegensPosten[] = [
    {
      bezeichnung: "Erhaltungsrücklage",
      cents: opt.ruecklageCents,
      hinweis: "Stand zum Stichtag (§ 28 Abs. 4 Satz 2 WEG)",
    },
    { bezeichnung: "Bankguthaben (laufende Konten)", cents: opt.girokontenCents },
    {
      bezeichnung: "Forderungen gegen Eigentümer",
      cents: opt.forderungenCents,
      hinweis: "rückständiges Hausgeld",
    },
  ];

  const passiva: VermoegensPosten[] = opt.verbindlichkeiten
    .filter((v) => offenAmStichtag(v, opt.stichtag))
    // Größte zuerst: Ein Darlehen über 60.000 € gehört nicht unter eine
    // Handwerkerrechnung über 180 €.
    .sort((a, b) => b.amountCents - a.amountCents)
    .map((v) => ({
      bezeichnung: v.title,
      cents: v.amountCents,
      hinweis: [KIND_LABEL[v.kind], v.creditor].filter(Boolean).join(" · "),
    }));

  const aktivaCents = aktiva.reduce((s, p) => s + p.cents, 0);
  const passivaCents = passiva.reduce((s, p) => s + p.cents, 0);

  return {
    aktiva,
    passiva,
    aktivaCents,
    passivaCents,
    reinvermoegenCents: aktivaCents - passivaCents,
  };
}
