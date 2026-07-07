"use client";

import { useRef, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import { inputClass } from "@/components/ui";
import { createNote, loadNoteTargets, type NoteTargets } from "./actions";

type Prop = { id: string; name: string };

export function NoteForm({ properties }: { properties: Prop[] }) {
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [targets, setTargets] = useState<NoteTargets>({ units: [], persons: [] });
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
    setTargetUserId("");
    setTargets({ units: [], persons: [] });
    const req = ++reqRef.current;
    if (!value) return;
    startTransition(async () => {
      const loaded = await loadNoteTargets(value);
      if (reqRef.current === req) setTargets(loaded);
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
            <option value="">— kein Objekt —</option>
            {visibleProps.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Einheit (optional)
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
            <option value="">{pending ? "wird geladen …" : "— keine Einheit —"}</option>
            {targets.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        {propertyId && !pending && targets.units.length === 0 ? (
          <p className="mt-1 text-xs text-gray-400">Dieses Objekt hat keine Einheiten.</p>
        ) : null}
      </div>

      <div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Mieter/Eigentümer (optional)
            {!propertyId ? (
              <span className="ml-1 font-normal text-gray-400">(zuerst Objekt wählen)</span>
            ) : null}
          </span>
          <select
            name="targetUserId"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            disabled={!propertyId || pending}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <option value="">{pending ? "wird geladen …" : "— keine Person —"}</option>
            {targets.persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.roleLabel}
              </option>
            ))}
          </select>
        </label>
        {propertyId && !pending && targets.persons.length === 0 ? (
          <p className="mt-1 text-xs text-gray-400">
            Keine Mieter/Eigentümer für dieses Objekt hinterlegt.
          </p>
        ) : null}
      </div>

      <SubmitButton pendingLabel="Wird gespeichert…">Notiz speichern</SubmitButton>
    </form>
  );
}
