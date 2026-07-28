import Link from "next/link";
import { DateField } from "@/components/fields";
import { ArrowRight, CalendarPlus, Download } from "lucide-react";
import { PendingButton } from "@/components/pending-button";
import { Card, EmptyState, Field, buttonSecondaryClass, inputClass } from "@/components/ui";
import { maintenanceIntervalLabels } from "@/lib/labels";
import type { RoadmapItem } from "@/lib/weg/roadmap";
import { addOwnTermin } from "./termin-actions";

/**
 * Das WEG-Jahr als Fahrplan statt als Kachelwand.
 *
 * Eine eingerichtete Gemeinschaft sah bisher elf gleichwertige Schaltflächen
 * ohne jeden Hinweis, welche gerade zählt. Hier steht, was ansteht – überfällig
 * zuerst –, und jede Zeile sagt, worum es geht.
 */
export function Roadmap({ items, propertyId }: { items: RoadmapItem[]; propertyId: string }) {
  if (items.length === 0) {
    return (
      <div data-tour="was-ansteht">
        <Card title="Was ansteht">
          <EmptyState>
            Nichts Fälliges. Wirtschaftsplan, Jahresabrechnung und Versammlung sind für dieses
            Jahr erledigt.
          </EmptyState>
          <EigenerTermin propertyId={propertyId} />
        </Card>
      </div>
    );
  }

  return (
    // Sprungziel der geführten Einrichtung — an beiden Rückgaben, sonst zeigt
    // die Führung bei einer leeren Liste ins Nichts.
    <div data-tour="was-ansteht">
    <Card title="Was ansteht">
      <ul className="space-y-1">
        {items.map((item) => {
          const ton =
            item.status === "overdue"
              ? "border-red-200 bg-red-50"
              : item.status === "soon"
                ? "border-amber-200 bg-amber-50"
                : "border-gray-200 bg-white";
          const fristTon =
            item.status === "overdue"
              ? "text-red-700"
              : item.status === "soon"
                ? "text-amber-800"
                : "text-gray-500";
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className={`flex items-start gap-3 rounded-xl border p-3 transition hover:shadow-sm ${ton}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                    <span className={`text-xs font-medium ${fristTon}`}>{item.dueLabel}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-600">{item.hint}</span>
                </span>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-gray-400">
        Die Fristen sind Richtwerte für die Planung, keine gesetzlichen Stichtage. Das
        WEG-Gesetz nennt für die Jahresabrechnung kein Datum auf den Tag; die Ladefrist zur
        Versammlung von drei Wochen rechnet der Einladungs-Assistent aus.
      </p>
      <EigenerTermin propertyId={propertyId} />
    </Card>
    </div>
  );
}

/**
 * Eigenen Termin anlegen und den Fahrplan in den eigenen Kalender holen.
 *
 * Bewusst kein Kalender im Programm: Eine kleine WEG hat rund fünfzehn datierte
 * Dinge im Jahr — ein Monatsraster wäre an den meisten Tagen leer, und die
 * Frage lautet ohnehin „was muss ich jetzt tun", nicht „was ist am 14.".
 * Der Export bringt die Termine dorthin, wo ohnehin geschaut wird.
 */
function EigenerTermin({ propertyId }: { propertyId: string }) {
  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <details className="min-w-0 flex-1">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand-green hover:underline">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Eigenen Termin aufnehmen
          </summary>
          <form action={addOwnTermin} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="propertyId" value={propertyId} />
            <Field label="Was steht an?">
              <input
                name="title"
                required
                minLength={2}
                maxLength={200}
                placeholder="z. B. Heizungswartung"
                className={`${inputClass} w-56`}
              />
            </Field>
            <DateField label="Fällig am" name="dueDate" required className="w-auto" />
            <Field label="Wiederholung">
              <select name="interval" defaultValue="EINMALIG" className={`${inputClass} w-auto`}>
                {(
                  Object.keys(maintenanceIntervalLabels) as Array<
                    keyof typeof maintenanceIntervalLabels
                  >
                ).map((k) => (
                  <option key={k} value={k}>
                    {maintenanceIntervalLabels[k]}
                  </option>
                ))}
              </select>
            </Field>
            <PendingButton className={buttonSecondaryClass}>Aufnehmen</PendingButton>
          </form>
        </details>

        <a
          href={`/api/kalender/${propertyId}`}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs text-gray-500 hover:text-brand-green hover:underline"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          In den Kalender übernehmen
        </a>
      </div>
    </div>
  );
}
