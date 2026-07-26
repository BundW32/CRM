import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import type { RoadmapItem } from "@/lib/weg/roadmap";

/**
 * Das WEG-Jahr als Fahrplan statt als Kachelwand.
 *
 * Eine eingerichtete Gemeinschaft sah bisher elf gleichwertige Schaltflächen
 * ohne jeden Hinweis, welche gerade zählt. Hier steht, was ansteht – überfällig
 * zuerst –, und jede Zeile sagt, worum es geht.
 */
export function Roadmap({ items }: { items: RoadmapItem[] }) {
  if (items.length === 0) {
    return (
      <Card title="Was ansteht">
        <EmptyState>
          Nichts Fälliges. Wirtschaftsplan, Jahresabrechnung und Versammlung sind für dieses
          Jahr erledigt.
        </EmptyState>
      </Card>
    );
  }

  return (
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
    </Card>
  );
}
