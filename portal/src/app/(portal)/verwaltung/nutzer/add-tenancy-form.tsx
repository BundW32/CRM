"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { loadUnitsForProperty, type UnitOption } from "@/app/(portal)/unit-options";
import { PendingButton } from "@/components/pending-button";
import { inputClass } from "@/components/ui";
import { addTenancy } from "./actions";

type Prop = { id: string; name: string };

/**
 * Einheit zu einem Mieter zuordnen. Die Einheiten des gewählten Objekts werden
 * **on demand** geladen (statt alle Einheiten des Bestands ins HTML zu legen);
 * bereits zugeordnete Einheiten werden ausgeblendet.
 */
export function AddTenancyForm({
  userId,
  properties,
  assignedUnitIds,
}: {
  userId: string;
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
      <select
        value={propertyId}
        onChange={(e) => handlePropertyChange(e.target.value)}
        className={`${inputClass} text-xs`}
      >
        <option value="">– Objekt wählen –</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="unitId"
          required
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          disabled={!propertyId || pending}
          className={`${inputClass} flex-1 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <option value="">
            {!propertyId
              ? "– zuerst Objekt –"
              : pending
                ? "wird geladen …"
                : available.length === 0
                  ? "– keine freie Einheit –"
                  : "– Einheit wählen –"}
          </option>
          {available.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
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
