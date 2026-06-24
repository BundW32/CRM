"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { inputClass } from "@/components/ui";
import { addPropertyAssignment } from "./actions";

type Prop = { id: string; name: string; zip: string; city: string; street: string };

function AssignSubmit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || count === 0}
      className="rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold text-brand-green-dark transition-all hover:bg-brand-orange-dark active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
    >
      {pending
        ? "Wird zugewiesen…"
        : count > 0
          ? `${count} Objekt${count === 1 ? "" : "e"} zuweisen`
          : "Objekte zuweisen"}
    </button>
  );
}

// Mehrfachauswahl von Objekten mit Filter (Name/PLZ/Ort/Straße).
// Statt einzeln zuzuweisen, mehrere ankreuzen und in einem Rutsch speichern.
export function PropertyAssignPicker({
  userId,
  available,
}: {
  userId: string;
  available: Prop[];
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return available;
    return available.filter((p) =>
      [p.name, p.zip, p.city, p.street].some((f) => (f ?? "").toLowerCase().includes(t))
    );
  }, [q, available]);

  const filteredIds = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
  }

  if (available.length === 0) return null;

  // Ausgewählte, aber aktuell ausgefilterte Objekte als Hidden-Inputs mitschicken,
  // damit die Auswahl beim Filtern nicht verloren geht.
  const hiddenSelected = [...selected].filter((id) => !filteredIds.has(id));

  return (
    <form action={addPropertyAssignment} className="mt-2 space-y-2">
      <input type="hidden" name="userId" value={userId} />
      {hiddenSelected.map((id) => (
        <input key={id} type="hidden" name="propertyId" value={id} />
      ))}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtern: Name, PLZ, Ort, Straße…"
          className={`${inputClass} flex-1 text-xs`}
        />
        {filtered.length > 0 ? (
          <button
            type="button"
            onClick={toggleAllFiltered}
            className="whitespace-nowrap rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            {allFilteredSelected ? "Leeren" : "Alle"}
          </button>
        ) : null}
      </div>

      <div className="max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-xs text-gray-400">Keine Treffer.</p>
        ) : (
          filtered.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                name="propertyId"
                value={p.id}
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="accent-brand-orange"
              />
              <span className="text-xs text-gray-700">
                {p.name}
                <span className="text-gray-400">
                  {" "}
                  · {p.zip} {p.city}
                </span>
              </span>
            </label>
          ))
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {selected.size > 0 ? `${selected.size} ausgewählt` : `${available.length} verfügbar`}
        </span>
        <AssignSubmit count={selected.size} />
      </div>
    </form>
  );
}
