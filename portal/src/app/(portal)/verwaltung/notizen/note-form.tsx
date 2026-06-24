"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { inputClass } from "@/components/ui";
import { createNote } from "./actions";

type Prop = { id: string; name: string };
type Unit = { id: string; label: string; propertyId: string; propertyName: string };
// propertyIds: Objekte, zu denen die Person gehört (Mieter via Einheit, Eigentümer via Objekt)
type Person = { id: string; name: string; roleLabel: string; propertyIds: string[] };

export function NoteForm({
  properties,
  units,
  persons,
}: {
  properties: Prop[];
  units: Unit[];
  persons: Person[];
}) {
  const [propertyId, setPropertyId] = useState("");

  // Einheiten werden vom gewählten Objekt abhängig gefiltert.
  // Ohne Objektauswahl: alle Einheiten (mit Objektname zur Orientierung).
  const visibleUnits = useMemo(
    () => (propertyId ? units.filter((u) => u.propertyId === propertyId) : units),
    [propertyId, units]
  );

  // Personen ebenfalls am Objekt ausrichten: ist ein Objekt gewählt, nur dessen
  // Mieter/Eigentümer; ohne Auswahl alle.
  const visiblePersons = useMemo(
    () => (propertyId ? persons.filter((p) => p.propertyIds.includes(propertyId)) : persons),
    [propertyId, persons]
  );

  // Wenn das Objekt wechselt, eine nicht mehr passende Einheit/Person zurücksetzen
  // (geschieht automatisch, da wir die Selects als controlled führen).
  const [unitId, setUnitId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");

  function handlePropertyChange(value: string) {
    setPropertyId(value);
    // Einheit nur behalten, wenn sie zum neuen Objekt passt
    setUnitId((prev) => {
      if (!prev) return prev;
      const stillValid = units.some((u) => u.id === prev && (!value || u.propertyId === value));
      return stillValid ? prev : "";
    });
    setTargetUserId((prev) => {
      if (!prev) return prev;
      const stillValid = persons.some(
        (p) => p.id === prev && (!value || p.propertyIds.includes(value))
      );
      return stillValid ? prev : "";
    });
  }

  return (
    <form action={createNote} className="space-y-4">
      <div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Notiz *</span>
          <textarea
            name="body"
            required
            minLength={1}
            maxLength={2000}
            rows={4}
            placeholder="Interne Notiz verfassen…"
            className={inputClass}
          />
        </label>
      </div>

      <div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Objekt (optional)</span>
          <select
            name="propertyId"
            value={propertyId}
            onChange={(e) => handlePropertyChange(e.target.value)}
            className={inputClass}
          >
            <option value="">— kein Objekt —</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Einheit (optional)</span>
          <select
            name="unitId"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className={inputClass}
          >
            <option value="">— keine Einheit —</option>
            {visibleUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
                {propertyId ? "" : ` · ${u.propertyName}`}
              </option>
            ))}
          </select>
        </label>
        {propertyId && visibleUnits.length === 0 ? (
          <p className="mt-1 text-xs text-gray-400">Dieses Objekt hat keine Einheiten.</p>
        ) : null}
      </div>

      <div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Mieter/Eigentümer (optional)
          </span>
          <select
            name="targetUserId"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className={inputClass}
          >
            <option value="">— keine Person —</option>
            {visiblePersons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.roleLabel}
              </option>
            ))}
          </select>
        </label>
        {propertyId && visiblePersons.length === 0 ? (
          <p className="mt-1 text-xs text-gray-400">
            Keine Mieter/Eigentümer für dieses Objekt hinterlegt.
          </p>
        ) : null}
      </div>

      <SubmitButton pendingLabel="Wird gespeichert…">Notiz speichern</SubmitButton>
    </form>
  );
}
