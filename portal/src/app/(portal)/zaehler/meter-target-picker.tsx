"use client";

import { useRef, useState, useTransition } from "react";
import { loadUnitsForProperty, type UnitOption } from "@/app/(portal)/unit-options";
import { inputClass } from "@/components/ui";

type Prop = { id: string; name: string };

/**
 * Auswahl der Zähler-Zuordnung. Zuerst wird ein Objekt gewählt; dessen Einheiten
 * werden **on demand** nachgeladen, statt alle Einheiten des Bestands ins HTML zu
 * serialisieren. Ausgegeben wird das Feld `target` als `prop:<id>` (Allgemeinzähler)
 * oder `unit:<id>` (Einheitszähler).
 */
export function MeterTargetPicker({ properties }: { properties: Prop[] }) {
  const [propertyId, setPropertyId] = useState("");
  const [target, setTarget] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

  const q = query.toLowerCase().trim();
  const visibleProps = q
    ? properties.filter((p) => p.name.toLowerCase().includes(q))
    : properties;

  function handlePropertyChange(value: string) {
    setPropertyId(value);
    setTarget(value ? `prop:${value}` : "");
    setUnits([]);
    const req = ++reqRef.current;
    if (!value) return;
    startTransition(async () => {
      const loaded = await loadUnitsForProperty(value);
      if (reqRef.current === req) setUnits(loaded);
    });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Objekt</span>
        {properties.length > 8 ? (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Objekt suchen …"
            className={`${inputClass} mb-1.5`}
            autoComplete="off"
          />
        ) : null}
        <select
          value={propertyId}
          onChange={(e) => handlePropertyChange(e.target.value)}
          required
          className={inputClass}
        >
          <option value="" disabled>
            – bitte wählen –
          </option>
          {visibleProps.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">
          Zuordnung
          {!propertyId ? (
            <span className="ml-1 font-normal text-gray-400">(zuerst Objekt wählen)</span>
          ) : null}
        </span>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={!propertyId || pending}
          className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {propertyId ? (
            <option value={`prop:${propertyId}`}>Allgemein (ganzes Objekt)</option>
          ) : (
            <option value="">–</option>
          )}
          {units.map((u) => (
            <option key={u.id} value={`unit:${u.id}`}>
              Einheit: {u.label}
            </option>
          ))}
        </select>
        {pending ? (
          <span className="mt-1 block text-xs text-gray-400">Einheiten werden geladen …</span>
        ) : null}
      </label>

      <input type="hidden" name="target" value={target} />
    </div>
  );
}
