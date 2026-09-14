// TOP-Vorlagenkatalog für die Tagesordnung einer Eigentümerversammlung.
// Fertige Tagesordnungspunkte inkl. Beschlussvorschlag als Formulierungshilfe.
// „Muster — ersetzt keine Rechtsberatung": Beträge, Fristen und Zuständigkeiten
// im Einzelfall prüfen und den Text an die konkrete Beschlusslage anpassen.
import type { AgendaItemType } from "@/generated/prisma/client";

export type AgendaTemplate = {
  key: string;
  title: string;
  description: string; // Beschlussvorschlag/Erläuterung
  type: AgendaItemType;
};

export const MEETING_AGENDA_TEMPLATES: AgendaTemplate[] = [
  {
    key: "BEGRUESSUNG",
    title: "Begrüßung, Feststellung der ordnungsgemäßen Ladung und Beschlussfähigkeit",
    description:
      "Feststellung, dass form- und fristgerecht (mind. 3 Wochen) geladen wurde und die Versammlung nach § 25 Abs. 3 WEG beschlussfähig ist.",
    type: "INFO",
  },
  {
    key: "WIRTSCHAFTSPLAN",
    title: "Beschluss über den Wirtschaftsplan",
    description:
      "Beschlussvorschlag: Die Eigentümer beschließen den vorgelegten Wirtschaftsplan für das kommende Wirtschaftsjahr. Die sich daraus ergebenden Hausgeld-Vorauszahlungen sind ab dem 1. des Folgemonats jeweils zum Monatsersten fällig (§ 28 Abs. 1 WEG).",
    type: "BESCHLUSS",
  },
  {
    key: "JAHRESABRECHNUNG",
    title: "Beschluss über die Jahresabrechnung (Abrechnungsspitze)",
    description:
      "Beschlussvorschlag: Die Eigentümer beschließen die Einforderung bzw. Erstattung der Nachschüsse und Anpassungsbeträge (Abrechnungsspitze) aus der vorgelegten Jahresabrechnung (§ 28 Abs. 2 WEG). Fällig 14 Tage nach Beschlussfassung.",
    type: "BESCHLUSS",
  },
  // ── Warum die Entlastung ZWEI Punkte sind ──────────────────────────────────
  //
  // Bis hierher stand hier ein gemeinsamer TOP „Entlastung der Verwaltung / des
  // Verwaltungsbeirats". Das ist bequem und in einer Selbstverwaltung
  // gefährlich: Wer über seine eigene Entlastung abstimmt, unterliegt dem
  // Stimmverbot des § 25 Abs. 4 WEG (die Entlastung ist ein negatives
  // Schuldanerkenntnis nach § 397 Abs. 2 BGB und damit ein Rechtsgeschäft mit
  // dem Betroffenen). Bei einem gemeinsamen Beschluss trifft das den Verwalter
  // UND jedes Beiratsmitglied gleichzeitig — in einer kleinen Gemeinschaft
  // bleiben davon womöglich zwei Stimmberechtigte übrig, und der Punkt ist
  // faktisch nicht mehr beschließbar.
  //
  // Getrennt abgestimmt, ist beim Beirats-TOP der Verwalter stimmberechtigt und
  // beim Verwalter-TOP der Beirat. Das ist zugleich die übliche Praxis.
  {
    key: "ENTLASTUNG_VERWALTUNG",
    title: "Entlastung der Verwaltung",
    description:
      "Beschlussvorschlag: Der Verwaltung wird für das abgelaufene Wirtschaftsjahr Entlastung erteilt. — Hinweis: Ist die Verwaltung zugleich Wohnungseigentümer, darf sie über ihre eigene Entlastung nicht mitstimmen (§ 25 Abs. 4 WEG).",
    type: "BESCHLUSS",
  },
  {
    key: "ENTLASTUNG_BEIRAT",
    title: "Entlastung des Verwaltungsbeirats",
    description:
      "Beschlussvorschlag: Dem Verwaltungsbeirat wird für das abgelaufene Wirtschaftsjahr Entlastung erteilt. — Hinweis: Die Beiratsmitglieder dürfen über ihre eigene Entlastung nicht mitstimmen (§ 25 Abs. 4 WEG).",
    type: "BESCHLUSS",
  },
  {
    key: "VERWALTERBESTELLUNG",
    title: "Bestellung der Verwaltung",
    description:
      "Beschlussvorschlag: Die Eigentümer bestellen … zur/zum Verwalter/in für die Zeit vom … bis … (höchstens 5 Jahre, bei Erstbestellung 3 Jahre, § 26 Abs. 2 WEG) und ermächtigen den Verwaltungsbeirat zum Abschluss des Verwaltervertrags.",
    type: "BESCHLUSS",
  },
  {
    key: "BEIRAT",
    title: "Wahl des Verwaltungsbeirats",
    description:
      "Beschlussvorschlag: Die Eigentümer wählen … in den Verwaltungsbeirat (§ 29 WEG). Die Amtszeit endet mit der übernächsten ordentlichen Versammlung.",
    type: "BESCHLUSS",
  },
  {
    key: "ERHALTUNGSMASSNAHME",
    title: "Beschluss über eine Erhaltungsmaßnahme",
    description:
      "Beschlussvorschlag: Die Eigentümer beschließen die Durchführung der Maßnahme … auf Grundlage des Angebots der Firma … über … EUR. Die Finanzierung erfolgt aus der Erhaltungsrücklage / über eine gesonderte Sonderumlage. Die Verwaltung wird mit der Beauftragung betraut.",
    type: "BESCHLUSS",
  },
  {
    key: "SONDERUMLAGE",
    title: "Beschluss über eine Sonderumlage",
    description:
      "Beschlussvorschlag: Zur Finanzierung von … beschließen die Eigentümer eine Sonderumlage in Höhe von insgesamt … EUR, verteilt nach Miteigentumsanteilen (MEA). Der auf jede Einheit entfallende Betrag ist zum … fällig.",
    type: "BESCHLUSS",
  },
  {
    key: "RUECKLAGE",
    title: "Beschluss über die Höhe der Erhaltungsrücklage",
    description:
      "Beschlussvorschlag: Die Eigentümer beschließen, der Erhaltungsrücklage künftig monatlich … EUR (nach MEA) zuzuführen, um eine angemessene Rücklage (§ 19 Abs. 2 Nr. 4 WEG) sicherzustellen.",
    type: "BESCHLUSS",
  },
  {
    key: "HAUSORDNUNG",
    title: "Beschluss über die Hausordnung",
    description:
      "Beschlussvorschlag: Die Eigentümer beschließen die vorgelegte Hausordnung als verbindliche Regelung des Gebrauchs des gemeinschaftlichen Eigentums.",
    type: "BESCHLUSS",
  },
  {
    key: "VERSCHIEDENES",
    title: "Verschiedenes",
    description:
      "Aussprache ohne Beschlussfassung. Über nicht angekündigte Punkte kann kein Beschluss gefasst werden (Ankündigungsgebot, § 23 Abs. 2 WEG).",
    type: "INFO",
  },
];
