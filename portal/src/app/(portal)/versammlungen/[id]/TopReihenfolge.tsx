"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { PendingButton } from "@/components/pending-button";
import { buttonSecondaryClass } from "@/components/ui";
import { reorderAgendaItems } from "../actions";

/**
 * Sortier-Editor für die Tagesordnung.
 *
 * Zuvor hing an jedem TOP ein Pfeilpaar, das je Klick einen Nachbarn tauschte
 * und die Seite neu lud. Bei fünf Punkten wurde das zur Klickerei, und die
 * winzigen Pfeile zwischen Titel, Beschlussvermerk und „entfernen" trafen sich
 * schlecht.
 *
 * Der Editor ist bewusst eine eigene, schmale Liste statt Ziehen an den echten
 * Zeilen: Diese tragen verschachtelte Formulare (bearbeiten, entfernen,
 * abstimmen), an denen sich nicht sauber ziehen lässt. Hier stehen nur Titel —
 * gezogen wird an ihnen, gespeichert wird einmal.
 *
 * Die Auf/Ab-Knöpfe bleiben: Ziehen funktioniert weder mit der Tastatur noch
 * zuverlässig auf dem Telefon.
 */
export function TopReihenfolge({
  meetingId,
  items,
}: {
  meetingId: string;
  items: { id: string; title: string }[];
}) {
  const [reihenfolge, setReihenfolge] = useState(items);
  const [gezogen, setGezogen] = useState<number | null>(null);

  const veraendert = reihenfolge.map((i) => i.id).join(",") !== items.map((i) => i.id).join(",");

  function verschieben(von: number, nach: number) {
    if (nach < 0 || nach >= reihenfolge.length || von === nach) return;
    setReihenfolge((alt) => {
      const neu = [...alt];
      const [weg] = neu.splice(von, 1);
      neu.splice(nach, 0, weg);
      return neu;
    });
  }

  return (
    <form action={reorderAgendaItems} className="space-y-2">
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="order" value={reihenfolge.map((i) => i.id).join(",")} />

      <ol className="space-y-1">
        {reihenfolge.map((item, index) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setGezogen(index)}
            onDragOver={(e) => {
              e.preventDefault();
              if (gezogen !== null && gezogen !== index) {
                verschieben(gezogen, index);
                setGezogen(index);
              }
            }}
            onDragEnd={() => setGezogen(null)}
            className={`flex cursor-grab items-center gap-2 rounded-lg border bg-white px-2 py-1.5 text-sm transition ${
              gezogen === index
                ? "border-brand-orange opacity-60"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
            <span className="w-6 shrink-0 text-xs font-medium text-gray-400">{index + 1}.</span>
            <span className="min-w-0 flex-1 truncate text-gray-800">{item.title}</span>
            <span className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => verschieben(index, index - 1)}
                disabled={index === 0}
                aria-label={`„${item.title}" nach oben`}
                className="rounded px-1.5 py-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => verschieben(index, index + 1)}
                disabled={index === reihenfolge.length - 1}
                aria-label={`„${item.title}" nach unten`}
                className="rounded px-1.5 py-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>

      {veraendert ? (
        <div className="flex flex-wrap items-center gap-2">
          <PendingButton className={buttonSecondaryClass} pendingLabel="Wird gespeichert…">
            Reihenfolge speichern
          </PendingButton>
          <button
            type="button"
            onClick={() => setReihenfolge(items)}
            className="text-xs text-gray-500 hover:underline"
          >
            zurücksetzen
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          Zum Sortieren ziehen oder die Pfeile nutzen — gespeichert wird erst danach.
        </p>
      )}
    </form>
  );
}
