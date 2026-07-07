"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/ui";
import { roleLabels } from "@/lib/labels";
import { searchRecipients, type RecipientResult } from "./actions";

/**
 * Empfänger-Auswahl per **serverseitiger Suche**. Statt alle Mieter/Eigentümer
 * (potenziell zehntausende) ins Formular zu laden, wird bei Eingabe gedeckelt im
 * Scope des Verwalters gesucht. Die Auswahl wird in einem verborgenen Feld
 * `recipientId` gespeichert.
 */
export function EmpfaengerSelect() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipientResult[]>([]);
  const [selected, setSelected] = useState<RecipientResult | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

  // Debounced Suche bei Eingabe (solange keine feste Auswahl getroffen wurde).
  useEffect(() => {
    if (selected) return;
    const handle = setTimeout(() => {
      const req = ++reqRef.current;
      startTransition(async () => {
        const found = await searchRecipients(query);
        if (reqRef.current === req) setResults(found);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query, selected]);

  function choose(r: RecipientResult) {
    setSelected(r);
    setOpen(false);
    setQuery("");
  }

  function clear() {
    setSelected(null);
    setResults([]);
    setOpen(true);
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
        <span className="min-w-0 truncate text-sm text-gray-900">
          <span className="font-medium">{selected.name}</span>
          <span className="text-gray-500">
            {" "}
            · {roleLabels[selected.role]}
            {selected.propertyName ? ` · ${selected.propertyName}` : ""}
          </span>
        </span>
        <button
          type="button"
          onClick={clear}
          className="shrink-0 text-sm text-gray-400 hover:text-brand-orange hover:underline"
        >
          ändern
        </button>
        <input type="hidden" name="recipientId" value={selected.id} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Name suchen …"
        className={inputClass}
        autoComplete="off"
      />
      {open ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          {pending && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Wird gesucht …</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">
              {query.trim() ? "Keine Treffer." : "Tippen, um zu suchen …"}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => choose(r)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">{r.name}</span>
                    <span className="block text-xs text-gray-500">
                      {roleLabels[r.role]}
                      {r.propertyName ? ` · ${r.propertyName}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {/* leeres Feld erzwingt serverseitige Empfänger-Validierung, falls nichts gewählt */}
      <input type="hidden" name="recipientId" value="" />
    </div>
  );
}
