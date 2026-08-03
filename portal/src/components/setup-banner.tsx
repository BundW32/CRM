"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Schmales Band über dem Inhalt, solange die Einrichtung einer selbstverwalteten
 * WEG läuft.
 *
 * Der Anlass: Die Schritte des Assistenten führen hin, aber nicht zurück. Wer
 * einen Schritt erledigt hatte, stand in den Stammdaten und musste selbst wieder
 * auf „Übersicht" klicken – bei acht Schritten sieben überflüssige Klicks.
 *
 * Bewusst ein Band und kein Rücksprung nach dem Speichern: In den Stammdaten
 * erledigt man mehrere Dinge hintereinander (Einheiten, Eigentümer, Konten,
 * Kostenarten). Ein automatischer Rücksprung nach jedem Speichern risse einen
 * aus der Arbeit heraus.
 */
export function SetupBanner({
  erledigt,
  gesamt,
  titel,
}: {
  erledigt: number;
  gesamt: number;
  /** Titel des nächsten offenen Schritts – zeigt, woran man gerade ist. */
  titel: string | null;
}) {
  const pathname = usePathname();
  // Auf der Übersicht steht der Assistent selbst – dort wäre das Band doppelt.
  if (pathname === "/dashboard") return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-brand-orange/30 bg-brand-orange-light px-4 py-2.5 text-sm">
      <span className="font-semibold text-brand-orange-dark">
        Einrichtung · Schritt {Math.min(erledigt + 1, gesamt)} von {gesamt}
      </span>
      {titel ? <span className="min-w-0 flex-1 truncate text-gray-700">{titel}</span> : null}
      <Link
        href="/dashboard"
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-orange/40 bg-white px-3 py-1.5 text-xs font-medium text-brand-green transition hover:border-brand-orange hover:bg-white/70"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Zurück zur Übersicht
      </Link>
    </div>
  );
}
