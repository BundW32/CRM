"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

// Dynamische Positionszeilen für das Rechnungsformular. Rein clientseitig – die
// Zeilen werden als wiederholte Felder item_description/quantity/price gesendet.
export function InvoiceItemsField() {
  const [rows, setRows] = useState([0]);
  return (
    <div className="space-y-2">
      {rows.map((key, idx) => (
        <div key={key} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            name="item_description"
            required={idx === 0}
            placeholder="Beschreibung"
            className={`${inputClass} flex-1 min-w-[160px]`}
          />
          <input
            type="number"
            name="item_quantity"
            min={1}
            defaultValue={1}
            className={`${inputClass} w-20`}
            aria-label="Menge"
          />
          <input
            type="text"
            name="item_price"
            required={idx === 0}
            placeholder="Einzelpreis netto (z. B. 49,00)"
            className={`${inputClass} w-48`}
          />
          {rows.length > 1 ? (
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((k) => k !== key))}
              className="text-xs text-red-600 hover:underline"
            >
              entfernen
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((r) => [...r, (r[r.length - 1] ?? 0) + 1])}
        className="text-sm text-brand-green hover:underline"
      >
        + Position hinzufügen
      </button>
    </div>
  );
}
