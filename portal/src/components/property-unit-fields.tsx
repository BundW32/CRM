"use client";

import { useRef, useState, useTransition } from "react";
import { loadUnitsForProperty, type UnitOption } from "@/app/(portal)/unit-options";
import { inputClass } from "@/components/ui";

type Property = { id: string; name: string };

/**
 * Gekoppeltes Objekt/Einheit-Auswahlpaar. Die Einheiten werden **on demand** für
 * das gewählte Objekt nachgeladen (Server-Action), damit nicht alle Einheiten des
 * Bestands ins HTML serialisiert werden – das skaliert auch bei sehr großen
 * Beständen. Über das Suchfeld lässt sich die Objektliste eingrenzen.
 * Beide Felder sind optional (Felder heißen `propertyId` und `unitId`).
 */
export function PropertyUnitFields({
  properties,
  propertyLabel = "Objekt (optional)",
  unitLabel = "Einheit (optional)",
  propertyPlaceholder = "– Allgemein –",
  unitPlaceholder = "– Keine –",
}: {
  properties: Property[];
  propertyLabel?: string;
  unitLabel?: string;
  propertyPlaceholder?: string;
  unitPlaceholder?: string;
}) {
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  // Race-Schutz: nur die Antwort zur zuletzt gewählten Anfrage übernehmen.
  const reqRef = useRef(0);

  const q = query.toLowerCase().trim();
  const visibleProps = q
    ? properties.filter((p) => p.name.toLowerCase().includes(q))
    : properties;

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
    <>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">{propertyLabel}</span>
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
          name="propertyId"
          value={propertyId}
          onChange={(e) => handlePropertyChange(e.target.value)}
          className={inputClass}
        >
          <option value="">{propertyPlaceholder}</option>
          {visibleProps.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">
          {unitLabel}
          {!propertyId ? (
            <span className="ml-1 font-normal text-gray-400">(zuerst Objekt wählen)</span>
          ) : null}
        </span>
        <select
          name="unitId"
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          disabled={!propertyId || pending}
          className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <option value="">{pending ? "Einheiten werden geladen …" : unitPlaceholder}</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
        {propertyId && !pending && units.length === 0 ? (
          <span className="mt-1 block text-xs text-gray-400">
            Dieses Objekt hat keine Einheiten.
          </span>
        ) : null}
      </label>
    </>
  );
}
