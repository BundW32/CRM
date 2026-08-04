"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Combobox } from "@/components/combobox";
import { loadUnitsForProperty, type UnitOption } from "@/app/(portal)/unit-options";
import { PendingButton } from "@/components/pending-button";

import { addTenancy } from "./actions";

type Prop = { id: string; name: string };

/**
 * Einheit zu einem Mieter zuordnen. Die Einheiten des gewählten Objekts werden
 * **on demand** geladen (statt alle Einheiten des Bestands ins HTML zu legen);
 * bereits zugeordnete Einheiten werden ausgeblendet.
 */
export function AddTenancyForm({
  userId,
  zurueck,
  properties,
  assignedUnitIds,
}: {
  userId: string;
  /** Rücksprungpfad nach dem Speichern. */
  zurueck: string;
  properties: Prop[];
  assignedUnitIds: string[];
}) {
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

  const assigned = useMemo(() => new Set(assignedUnitIds), [assignedUnitIds]);
  const available = units.filter((u) => !assigned.has(u.id));

  function handlePropertyChange(value: string) {
    setPropertyId(value);
    setUnitId("");
    setUnits([]);
    const req = ++reqRef.current;
    if (!value) return;
    startTransition(async () => {
      const loaded = await loadUnitsForProperty(value);
      if (reqRef.current === req) setUnits(loaded);
    });
  }

  return (
    <form action={addTenancy} className="mt-2 space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="zurueck" value={zurueck} />
      <input type="hidden" name="unitId" value={unitId} required />
      <Combobox
        label="Objekt"
        placeholder="Objekt suchen …"
        options={properties.map((p) => ({ value: p.id, label: p.name }))}
        value={propertyId || undefined}
        onSelect={handlePropertyChange}
        onClear={() => handlePropertyChange("")}
        clearOption="– Objekt wählen –"
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <Combobox
            label="Einheit"
            placeholder={
              pending
                ? "wird geladen …"
                : available.length === 0
                  ? "keine freie Einheit"
                  : "Einheit suchen …"
            }
            options={available.map((u) => ({ value: u.id, label: u.label }))}
            value={unitId || undefined}
            onSelect={setUnitId}
            onClear={() => setUnitId("")}
            disabled={!propertyId || pending || available.length === 0}
            disabledHint={!propertyId ? "zuerst Objekt wählen" : "keine freie Einheit"}
          />
        </div>
        <PendingButton
          pendingLabel="…"
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          + Einheit hinzufügen
        </PendingButton>
      </div>
    </form>
  );
}
