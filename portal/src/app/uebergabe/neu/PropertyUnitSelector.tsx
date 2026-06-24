"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

type Unit = { id: string; label: string; floor: string | null };
type Property = {
  id: string;
  name: string;
  street: string | null;
  zip: string | null;
  city: string | null;
  units: Unit[];
};

export function PropertyUnitSelector({ properties }: { properties: Property[] }) {
  const [propertyId, setPropertyId] = useState("");
  const selected = properties.find((p) => p.id === propertyId);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Objekt</label>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className={inputClass}
          required
        >
          <option value="">Objekt wählen …</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.street ? ` – ${p.street}, ${p.zip} ${p.city}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className={propertyId ? "animate-page-in" : undefined}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Einheit
          {!propertyId && <span className="ml-1 text-gray-400 font-normal">(zuerst Objekt wählen)</span>}
        </label>
        <select
          name="unitId"
          required
          disabled={!propertyId}
          className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <option value="">Einheit wählen …</option>
          {selected?.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
              {u.floor ? ` (${u.floor}. OG)` : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
