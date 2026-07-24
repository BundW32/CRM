"use client";

import { useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/ui";

type Hit = { id: string; name: string; role: string; context: string };

const roleLabel = (role: string) => (role === "MIETER" ? "Mieter" : "Eigentümer");

// Skalierbarer Empfänger-Picker: Tippen löst eine serverseitige Suche aus
// (wenige Treffer), Auswahl landet als Chip mit verstecktem Feld
// name="recipientIds". Funktioniert auch bei tausenden Nutzern.
export function RecipientPicker({ search }: { search: (query: string) => Promise<Hit[]> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit[]>([]);
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

  function onQueryChange(v: string) {
    setQuery(v);
    const req = ++reqRef.current;
    if (v.trim().length < 2) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const r = await search(v);
      // Nur das jüngste Ergebnis übernehmen (verhindert Flackern bei schnellem Tippen).
      if (reqRef.current === req) setResults(r);
    });
  }

  function add(hit: Hit) {
    setSelected((prev) => (prev.some((s) => s.id === hit.id) ? prev : [...prev, hit]));
    setQuery("");
    setResults([]);
  }

  function remove(id: string) {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }

  const visibleResults = results.filter((r) => !selected.some((s) => s.id === r.id));

  return (
    <div>
      {selected.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange-light px-2.5 py-1 text-xs text-brand-orange-dark"
            >
              {s.name}
              <span className="text-brand-orange-dark/50">· {roleLabel(s.role)}</span>
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label={`${s.name} entfernen`}
                className="text-brand-orange-dark/60 hover:text-red-600"
              >
                ✕
              </button>
              <input type="hidden" name="recipientIds" value={s.id} />
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Person suchen (Name oder E-Mail) …"
          className={inputClass}
          autoComplete="off"
        />
        {query.trim().length >= 2 ? (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {pending ? (
              <p className="px-3 py-2 text-xs text-gray-400">Suche …</p>
            ) : visibleResults.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">Keine Treffer.</p>
            ) : (
              visibleResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  // onMouseDown + preventDefault: Auswahl feuert zuverlässig, bevor das
                  // Suchfeld den Fokus verliert (sonst „Klick passiert nichts", v. a. Safari).
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(r);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <span className="text-gray-400">
                    {" "}
                    · {roleLabel(r.role)}
                    {r.context ? ` · ${r.context}` : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
