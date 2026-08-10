// Die EINE Zählung der Abrechnungsgrößen einer Organisation.
//
// Die wegportal24-Tarife rechnen je Einheit — aber Stellplätze und Garagen
// (Einheiten vom Typ STELLPLATZ) kosten pauschal 1 € und zählen NICHT als
// Einheiten: Sie beeinflussen weder die Mengenstaffel (ab 5/9) noch die
// 12er-Grenze des Self-Service. Vorher zählte `db.unit.count` beide Sorten
// zusammen — eine WEG mit 6 Wohnungen und 6 Stellplätzen wäre damit an der
// Grenze abgewiesen worden und hätte je Stellplatz den vollen Einheitenpreis
// gezahlt.
//
// Alle Aufrufer (Checkout, Mengenabgleich, Tarifwechsel, Abo-Anzeige) zählen
// über diese Funktion — vier eigene Zählungen liefen auseinander.
//
// Archivierte Objekte zählen NICHT: Archivieren heißt „wird nicht mehr
// verwaltet", und ein Abo über Einheiten, an denen niemand mehr arbeitet,
// wäre eine stille Kostenfalle. Wer ein Objekt reaktiviert, zahlt ab dann
// wieder — beide Aktionen stoßen den Mengenabgleich an.
import { db } from "./db";

export type WegMengen = { einheiten: number; stellplaetze: number };

export async function zaehleWegMengen(organizationId: string): Promise<WegMengen> {
  const property = { organizationId, managementType: "WEG" as const, active: true };
  const [einheiten, stellplaetze] = await Promise.all([
    db.unit.count({ where: { property, unitType: { not: "STELLPLATZ" } } }),
    db.unit.count({ where: { property, unitType: "STELLPLATZ" } }),
  ]);
  return { einheiten, stellplaetze };
}
