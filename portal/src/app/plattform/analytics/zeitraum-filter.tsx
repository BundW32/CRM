// Globale Zeitraumauswahl der Analytics-Seiten. Vollständig URL-getrieben:
// Die Presets sind Links (`?zeitraum=…`), der freie Bereich ein GET-Formular
// (`?von=…&bis=…`) — dadurch sind alle Ansichten teil- und bookmarkbar, und
// der Zurück-Knopf des Browsers funktioniert. Kein Client-Zustand.

import Link from "next/link";
import { DateField } from "@/components/fields";
import { PendingButton } from "@/components/pending-button";
import { buttonSecondaryClass, cardSurfaceClass } from "@/components/ui";
import {
  ZEITRAUM_PRESETS,
  type Zeitraum,
  type ZeitraumPreset,
  istLaufenderTag,
  toIsoTag,
  vorperiodeLabel,
  zeitraumLabel,
  zeitraumSpanne,
} from "@/lib/analytics/zeitraum";

const PRESET_LABELS: Record<ZeitraumPreset, string> = {
  heute: "Heute",
  "7": "7 Tage",
  "28": "28 Tage",
  "90": "90 Tage",
  monat: "Laufender Monat",
};

export function ZeitraumFilter({ zeitraum, pfad }: { zeitraum: Zeitraum; pfad: string }) {
  return (
    <div className={`${cardSurfaceClass} mb-5 px-4 py-3`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <ul className="flex items-center gap-1">
          {ZEITRAUM_PRESETS.map((p) => {
            const aktiv = zeitraum.preset === p;
            return (
              <li key={p}>
                <Link
                  href={`${pfad}?zeitraum=${p}`}
                  aria-current={aktiv ? "true" : undefined}
                  className={`block rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                    aktiv
                      ? "bg-brand-green text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-green"
                  }`}
                >
                  {PRESET_LABELS[p]}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Freier Bereich: GET-Formular, die Feldnamen SIND die Suchparameter. */}
        <form action={pfad} method="get" className="flex flex-wrap items-end gap-2">
          {/* Auch bei aktivem Preset vorbelegt: Die Felder sind dann die
              sichtbare Bestätigung des gewählten Fensters — leer gelassen
              wirkten sie wie ein zweiter, widersprüchlicher Zustand. */}
          <DateField
            label={<span className="text-xs">Von</span>}
            name="von"
            defaultValue={toIsoTag(zeitraum.von)}
            required
            className="!w-auto"
          />
          <DateField
            label={<span className="text-xs">Bis</span>}
            name="bis"
            defaultValue={toIsoTag(zeitraum.bis)}
            required
            className="!w-auto"
          />
          <PendingButton className={buttonSecondaryClass}>Anwenden</PendingButton>
        </form>

        <div className="ml-auto text-right">
          <p className="text-sm font-medium whitespace-nowrap text-gray-800">
            {zeitraumSpanne(zeitraum)}
          </p>
          <p className="text-xs text-gray-500">
            {zeitraumLabel(zeitraum)}{" "}
            <span className="whitespace-nowrap">{vorperiodeLabel(zeitraum)}</span>
          </p>
          {istLaufenderTag(zeitraum) ? (
            <p className="text-xs text-amber-700">Laufender Tag – noch nicht abgeschlossen.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
