"use client";

import { useRef, useState, useTransition } from "react";
import { loadUnitsForProperty, type UnitOption } from "@/app/(portal)/unit-options";
import { Combobox } from "@/components/combobox";
import { Field } from "@/components/ui";

type Property = {
  id: string;
  name: string;
  street: string | null;
  zip: string | null;
  city: string | null;
};

/**
 * Objekt und Einheit für eine neue Übergabe.
 *
 * Zwei Dinge waren hier anders als im übrigen Programm, beide zum Nachteil
 * großer Bestände:
 *
 * 1. Die Seite lieferte **alle** Objekte samt **allen** Einheiten im HTML mit.
 *    Bei 40 Objekten à 30 Einheiten sind das 1200 Einträge, von denen genau
 *    einer gebraucht wird. Die Einheiten werden jetzt erst nach der Objektwahl
 *    nachgeladen – wie überall sonst.
 * 2. Die Einheitenliste war ein Aufklappmenü ohne Suche. Jetzt tippbar.
 *
 * Die Einheit ist Pflicht – eine Übergabe ohne Einheit gibt es nicht. Deshalb
 * kein „keine Einheit"-Eintrag und ein verstecktes Feld mit `required`.
 */
export function PropertyUnitSelector({ properties }: { properties: Property[] }) {
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

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
    <div className="space-y-4">
      {/* Pflichtprüfung: `<input type="hidden" required>` wäre wirkungslos – versteckte
          Felder sind von der HTML-Prüfung ausgenommen. Deshalb ein Textfeld ohne
          Ausdehnung: unsichtbar, aber prüf- und anspringbar (wie in `FileInput`). */}
      <input
        type="text"
        name="unitId"
        value={unitId}
        required
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden
        className="absolute h-0 w-0 opacity-0"
      />

      <Field label="Objekt">
        <Combobox
          label="Objekt"
          placeholder="Objekt suchen …"
          options={properties.map((p) => ({
            value: p.id,
            label: p.name,
            sublabel: p.street
              ? `${p.street}, ${p.zip ?? ""} ${p.city ?? ""}`.trim()
              : undefined,
          }))}
          value={propertyId || undefined}
          onSelect={handlePropertyChange}
          onClear={() => handlePropertyChange("")}
          tone="inForm"
        />
      </Field>

      <Field label="Einheit">
        <Combobox
          label="Einheit"
          placeholder={pending ? "Einheiten werden geladen …" : "Einheit suchen …"}
          options={units.map((u) => ({
            value: u.id,
            label: u.label,
            sublabel: u.tenantNames.length > 0 ? u.tenantNames.join(", ") : undefined,
          }))}
          value={unitId || undefined}
          onSelect={setUnitId}
          onClear={() => setUnitId("")}
          disabled={!propertyId || pending}
          disabledHint={propertyId ? "wird geladen …" : "zuerst Objekt wählen"}
          tone="inForm"
        />
      </Field>
    </div>
  );
}
