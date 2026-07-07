"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { inputClass } from "@/components/ui";
import { addCraftsmanAssignment } from "./actions";

type Craft = { id: string; name: string; company: string | null; tradeLabel: string };

function AssignSubmit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || count === 0}
      className="rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold text-brand-green-dark transition-all hover:bg-brand-orange-dark active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
    >
      {pending
        ? "Wird gespeichert…"
        : count > 0
          ? `${count} Handwerker freigeben`
          : "Handwerker auswählen"}
    </button>
  );
}

// Mehrfachauswahl von Handwerkern mit Filter (Name/Firma/Gewerk).
// Schränkt ein, welche Handwerker dieser Verwalter sieht.
export function CraftsmanAssignPicker({
  userId,
  available,
}: {
  userId: string;
  available: Craft[];
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return available;
    return available.filter((c) =>
      [c.name, c.company ?? "", c.tradeLabel].some((f) => f.toLowerCase().includes(t))
    );
  }, [q, available]);

  const filteredIds = useMemo(() => new Set(filtered.map((c) => c.id)), [filtered]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

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
      if (allFilteredSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });
  }

  if (available.length === 0) return null;

  const hiddenSelected = [...selected].filter((id) => !filteredIds.has(id));

  return (
    <form action={addCraftsmanAssignment} className="mt-2 space-y-2">
      <input type="hidden" name="userId" value={userId} />
      {hiddenSelected.map((id) => (
        <input key={id} type="hidden" name="craftsmanId" value={id} />
      ))}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtern: Name, Firma, Gewerk…"
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
          filtered.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                name="craftsmanId"
                value={c.id}
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="accent-brand-orange"
              />
              <span className="text-xs text-gray-700">
                {c.company ? `${c.company} / ` : ""}
                {c.name}
                <span className="text-gray-400"> · {c.tradeLabel}</span>
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
