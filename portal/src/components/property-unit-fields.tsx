"use client";

import { useMemo, useState } from "react";
import { inputClass } from "@/components/ui";

type Unit = { id: string; label: string };
type Property = { id: string; name: string; units: Unit[] };

/**
 * Gekoppeltes Objekt/Einheit-Auswahlpaar: die Einheiten-Liste hängt vom gewählten
 * Objekt ab (kein Anzeigen aller Einheiten aller Objekte). Wird in mehreren
 * Formularen verwendet (Dokument hochladen, …). Beide Felder optional.
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

  const selected = useMemo(
    () => properties.find((p) => p.id === propertyId) ?? null,
    [properties, propertyId]
  );

  function handlePropertyChange(value: string) {
    setPropertyId(value);
    // Einheit zurücksetzen, sobald sie nicht mehr zum Objekt gehört
    setUnitId((prev) =>
      prev && properties.find((p) => p.id === value)?.units.some((u) => u.id === prev) ? prev : ""
    );
  }

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">{propertyLabel}</span>
        <select
          name="propertyId"
          value={propertyId}
          onChange={(e) => handlePropertyChange(e.target.value)}
          className={inputClass}
        >
          <option value="">{propertyPlaceholder}</option>
          {properties.map((p) => (
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
          disabled={!propertyId}
          className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <option value="">{unitPlaceholder}</option>
          {selected?.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
        {propertyId && selected && selected.units.length === 0 ? (
          <span className="mt-1 block text-xs text-gray-400">
            Dieses Objekt hat keine Einheiten.
          </span>
        ) : null}
      </label>
    </>
  );
}
