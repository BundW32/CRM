"use client";

import { inputClass } from "@/components/ui";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import { contactKindLabels, contactMethodLabels, tradeLabels } from "@/lib/labels";
import {
  deleteCraftsman,
  toggleCraftsmanActive,
  toggleCraftsmanInternal,
  updateCraftsman,
} from "../actions";

const TRADE_ORDER = Object.keys(tradeLabels) as Array<keyof typeof tradeLabels>;
const KIND_ORDER = Object.keys(contactKindLabels) as Array<keyof typeof contactKindLabels>;

/** Was von einer Karteikarte bearbeitbar ist – identisch in Liste und Detailseite. */
export type Karteikarte = {
  id: string;
  name: string;
  company: string | null;
  kind: string | null;
  trade: string | null;
  email: string | null;
  phone: string | null;
  preferredContact: string | null;
  notes: string | null;
  active: boolean;
  isInternal: boolean;
};

/**
 * Bearbeitungsformular einer Karteikarte (Firma ohne Portalzugang).
 *
 * Bewusst eine Komponente für beide Orte: Wird sie an zwei Stellen gepflegt,
 * laufen die Felder früher oder später auseinander.
 */
export function KarteikarteFormular({
  k,
  zurueck,
}: {
  k: Karteikarte;
  /** Wohin nach dem Speichern zurück. */
  zurueck: string;
}) {
  return (
    <>
      <form action={updateCraftsman} className="grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="id" value={k.id} />
        <input type="hidden" name="zurueck" value={zurueck} />
        <label>
          <span className="mb-1 block text-xs text-gray-500">Art</span>
          <select
            name="kind"
            required
            defaultValue={k.kind ?? "HANDWERKER"}
            className={inputClass}
          >
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {contactKindLabels[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-gray-500">Firma (optional)</span>
          <input
            type="text"
            name="company"
            defaultValue={k.company ?? ""}
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-gray-500">Ansprechpartner / Name</span>
          <input
            type="text"
            name="name"
            required
            minLength={2}
            defaultValue={k.name}
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-gray-500">Gewerk</span>
          <select
            name="trade"
            required
            defaultValue={k.trade ?? "ALLGEMEIN"}
            className={inputClass}
          >
            {TRADE_ORDER.map((t) => (
              <option key={t} value={t}>
                {tradeLabels[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-gray-500">Bevorzugter Kontaktweg</span>
          <select
            name="preferredContact"
            required
            defaultValue={k.preferredContact ?? "TELEFON"}
            className={inputClass}
          >
            {Object.entries(contactMethodLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-gray-500">Telefon</span>
          <input
            type="tel"
            name="phone"
            defaultValue={k.phone ?? ""}
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-gray-500">E-Mail</span>
          <input
            type="email"
            name="email"
            defaultValue={k.email ?? ""}
            className={inputClass}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-gray-500">Notizen (optional)</span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={k.notes ?? ""}
            className={inputClass}
          />
        </label>
        <div className="sm:col-span-2">
          <PendingButton className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Speichern</PendingButton>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-gray-200 pt-3">
        <form action={toggleCraftsmanInternal}>
          <input type="hidden" name="id" value={k.id} />
        <input type="hidden" name="zurueck" value={zurueck} />
          <button type="submit" className="text-xs text-gray-500 hover:underline">
            {k.isInternal ? "Als extern markieren" : "Als intern markieren"}
          </button>
        </form>
        <form action={toggleCraftsmanActive}>
          <input type="hidden" name="id" value={k.id} />
        <input type="hidden" name="zurueck" value={zurueck} />
          <button type="submit" className="text-xs text-gray-500 hover:underline">
            {k.active ? "Deaktivieren" : "Aktivieren"}
          </button>
        </form>
        <form action={deleteCraftsman}>
          <input type="hidden" name="id" value={k.id} />
        <input type="hidden" name="zurueck" value={zurueck} />
          <ConfirmActionButton
            className="text-xs text-red-600 hover:underline"
            confirmLabel="Wirklich löschen?"
            pendingLabel="Wird gelöscht…"
          >
            Löschen
          </ConfirmActionButton>
        </form>
      </div>
    </>
  );
}
