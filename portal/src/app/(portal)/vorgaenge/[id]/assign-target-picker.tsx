"use client";

import { useRef, useState, useTransition } from "react";
import { loadUnitsForProperty, type UnitOption } from "@/app/(portal)/unit-options";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { assignTicketTarget } from "../actions";

type Prop = { id: string; name: string };

/**
 * Zuordnungs-Auswahl für nicht zugeordnete (E-Mail-)Vorgänge. Es wird nur die
 * Objektliste mitgeliefert; die Einheiten des gewählten Objekts werden on demand
 * nachgeladen. Für einen evtl. vorhandenen Vorschlag werden die Einheiten des
 * vorgeschlagenen Objekts bereits serverseitig vorgeladen (initialUnits).
 */
export function AssignTargetPicker({
  ticketId,
  properties,
  initialPropertyId = "",
  initialTarget = "",
  initialUnits = [],
}: {
  ticketId: string;
  properties: Prop[];
  initialPropertyId?: string;
  initialTarget?: string;
  initialUnits?: UnitOption[];
}) {
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [target, setTarget] = useState(initialTarget);
  const [units, setUnits] = useState<UnitOption[]>(initialUnits);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

  const q = query.toLowerCase().trim();
  const visibleProps = q
    ? properties.filter((p) => p.name.toLowerCase().includes(q))
    : properties;

  function handlePropertyChange(value: string) {
    setPropertyId(value);
    setTarget(value ? `${value}|` : "");
    setUnits([]);
    const req = ++reqRef.current;
    if (!value) return;
    startTransition(async () => {
      const loaded = await loadUnitsForProperty(value);
      if (reqRef.current === req) setUnits(loaded);
    });
  }

  return (
    <form action={assignTicketTarget} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Field label="Objekt">
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
      </Field>

      <Field label="Einheit (optional)">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={!propertyId || pending}
          className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {propertyId ? (
            <option value={`${propertyId}|`}>— gesamtes Objekt —</option>
          ) : (
            <option value="">{pending ? "wird geladen …" : "zuerst Objekt wählen"}</option>
          )}
          {units.map((u) => (
            <option key={u.id} value={`${propertyId}|${u.id}`}>
              {u.tenantNames.length > 0 ? `${u.label}  ·  ${u.tenantNames.join(", ")}` : u.label}
            </option>
          ))}
        </select>
      </Field>

      <input type="hidden" name="target" value={target} />
      <button type="submit" disabled={!target} className={buttonClass}>
        Zuordnen
      </button>
    </form>
  );
}
