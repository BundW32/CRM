// Vorkonfigurierter Katalog wiederkehrender Prüf- und Verwaltungspflichten einer
// selbstverwalteten WEG. Wird per Knopfdruck je Objekt übernommen und legt dabei
// Einträge im bestehenden `MaintenanceTask`-Modell an (Feld `catalogKey` markiert
// die Herkunft und verhindert Duplikate bei mehrfacher Übernahme).
//
// Die angegebenen Turnusse orientieren sich an den einschlägigen Vorschriften
// (TrinkwV, BetrSichV, GEG, DIN 14676, WEG). Sie sind fachliche Richtwerte und
// ersetzen keine Rechtsberatung — jede WEG kann den Turnus im Einzelfall (z. B.
// laut Gemeinschaftsordnung, Herstellervorgabe oder Gefährdungsbeurteilung)
// abweichend festlegen und die Fälligkeit danach anpassen.
import type { MaintenanceInterval } from "@/generated/prisma/client";

export type ComplianceDuty = {
  // Stabiler Schlüssel (Idempotenz der Übernahme, nicht sichtbar)
  key: string;
  title: string;
  description: string;
  interval: MaintenanceInterval;
  // Monate ab Übernahme bis zur ersten Fälligkeit (danach läuft der Turnus).
  initialDueMonths: number;
};

export const WEG_COMPLIANCE_CATALOG: ComplianceDuty[] = [
  {
    key: "TRINKWASSER_LEGIONELLEN",
    title: "Trinkwasserprüfung (Legionellen)",
    description:
      "Untersuchung auf Legionellen bei zentraler Warmwasser-Großanlage (Speicher > 400 l oder > 3 l Rohrinhalt zwischen Erwärmer und Entnahme). Turnus nach TrinkwV in der Regel alle 3 Jahre; bei gewerblicher Nutzung/Vermietung ggf. jährlich.",
    interval: "DREIJAEHRLICH",
    initialDueMonths: 12,
  },
  {
    key: "RAUCHWARNMELDER",
    title: "Rauchwarnmelder prüfen",
    description:
      "Jährliche Funktionsprüfung und Wartung der Rauchwarnmelder nach DIN 14676 (in fast allen Bundesländern Pflicht). Prüfung durch Fachkraft oder — je nach Landesrecht — Eigentümer/Mieter dokumentieren.",
    interval: "JAEHRLICH",
    initialDueMonths: 6,
  },
  {
    key: "AUFZUG_PRUEFUNG",
    title: "Aufzugsprüfung (ZÜS)",
    description:
      "Wiederkehrende Prüfung der Aufzugsanlage nach BetrSichV: Hauptprüfung alle 2 Jahre, dazwischen Zwischenprüfung — faktisch jährlich ein Prüftermin durch eine zugelassene Überwachungsstelle (ZÜS/TÜV). Nur relevant bei vorhandenem Aufzug.",
    interval: "JAEHRLICH",
    initialDueMonths: 6,
  },
  {
    key: "HEIZUNG_CHECK",
    title: "Heizungswartung & Heizungscheck",
    description:
      "Jährliche Wartung der Heizungsanlage; zusätzlich Heizungsprüfung/-optimierung nach GEG (§ 60a f.) bei Erdgas-Heizungen. Feuerstättenschau/Schornsteinfeger separat beachten.",
    interval: "JAEHRLICH",
    initialDueMonths: 3,
  },
  {
    key: "VERKEHRSSICHERUNG_WINTERDIENST",
    title: "Verkehrssicherung / Winterdienst organisieren",
    description:
      "Vor Wintereinbruch Räum- und Streupflicht (Winterdienst) sowie allgemeine Verkehrssicherung (Wege, Beleuchtung, Bäume) prüfen und die Zuständigkeit regeln. Verstöße können die Haftung der Gemeinschaft auslösen.",
    interval: "JAEHRLICH",
    initialDueMonths: 4,
  },
  {
    key: "VERSICHERUNG_ABLAUF",
    title: "Versicherungen prüfen",
    description:
      "Jährlicher Check der Gebäude- und Haftpflichtversicherung: Deckungssummen, gleitender Neuwertfaktor, Ablauf-/Kündigungsfristen und Elementarschadendeckung. Rechtzeitig vor Verlängerung anpassen.",
    interval: "JAEHRLICH",
    initialDueMonths: 6,
  },
  {
    key: "JAHRESABRECHNUNG_FAELLIG",
    title: "Jahresabrechnung erstellen",
    description:
      "Nach Ende des Wirtschaftsjahres ist die Jahresabrechnung (§ 28 Abs. 2 WEG) zu erstellen und der Versammlung zur Beschlussfassung über die Abrechnungsspitze vorzulegen.",
    interval: "JAEHRLICH",
    initialDueMonths: 3,
  },
  {
    key: "VERSAMMLUNG_PLANEN",
    title: "Eigentümerversammlung planen",
    description:
      "Mindestens einmal jährlich ist eine Eigentümerversammlung einzuberufen (§ 24 Abs. 1 WEG). Einladung mit mindestens 3 Wochen Frist und vollständiger Tagesordnung versenden.",
    interval: "JAEHRLICH",
    initialDueMonths: 2,
  },
];
