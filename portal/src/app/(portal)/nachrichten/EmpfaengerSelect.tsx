"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/ui";
import {
  listRecipientProperties,
  recipientsForProperty,
  type RecipientProperty,
  type RecipientResult,
} from "./actions";

/**
 * Strukturierte, skalierbare Empfänger-Auswahl für Verwalter:
 * 1. Objekt wählen → 2. Empfänger des Objekts werden geladen → 3. live filtern
 * und per Klick mehrere auswählen. Ausgewählte bleiben auch beim Objektwechsel
 * erhalten (Sammel-Nachricht an mehrere). Pro Auswahl wird ein verstecktes Feld
 * `recipientId` ausgegeben; der Server erstellt je Empfänger einen eigenen Thread.
 */
export function EmpfaengerSelect() {
  const [properties, setProperties] = useState<RecipientProperty[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [recipients, setRecipients] = useState<RecipientResult[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Map<string, RecipientResult>>(new Map());
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

  // Objektliste einmalig laden.
  useEffect(() => {
    startTransition(async () => {
      setProperties(await listRecipientProperties());
    });
  }, []);

  // Empfänger des gewählten Objekts laden (Leeren passiert im Change-Handler).
  useEffect(() => {
    if (!propertyId) return;
    const req = ++reqRef.current;
    startTransition(async () => {
      const found = await recipientsForProperty(propertyId);
      if (reqRef.current === req) setRecipients(found);
    });
  }, [propertyId]);

  // Live-Filter (rein clientseitig auf den geladenen Empfängern des Objekts).
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipients, filter]);

  function toggle(r: RecipientResult) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(r.id)) next.delete(r.id);
      else next.set(r.id, r);
      return next;
    });
  }

  function remove(id: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const r of filtered) next.set(r.id, r);
      return next;
    });
  }

  const selectedList = [...selected.values()];

  return (
    <div className="space-y-2">
      {/* Ausgewählte Empfänger als Chips */}
      {selectedList.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedList.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-orange-light px-2.5 py-1 text-xs font-medium text-brand-orange-dark"
            >
              {r.name}
              <button
                type="button"
                onClick={() => remove(r.id)}
                className="text-brand-orange-dark/70 hover:text-brand-orange-dark"
                aria-label={`${r.name} entfernen`}
              >
                ✕
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setSelected(new Map())}
            className="text-xs text-gray-400 hover:text-brand-orange hover:underline"
          >
            alle entfernen
          </button>
        </div>
      ) : null}

      {/* 1. Objekt wählen */}
      <select
        value={propertyId}
        onChange={(e) => {
          const value = e.target.value;
          setPropertyId(value);
          setFilter("");
          if (!value) setRecipients([]);
        }}
        className={inputClass}
      >
        <option value="">— Objekt wählen —</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* 2. + 3. Empfänger filtern und auswählen */}
      {propertyId ? (
        <>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Nach Name filtern …"
            className={inputClass}
            autoComplete="off"
          />
          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white">
            {pending && recipients.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">Wird geladen …</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">
                {recipients.length === 0
                  ? "Keine Empfänger an diesem Objekt."
                  : "Keine Treffer."}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const checked = selected.has(r.id);
                  return (
                    <li key={r.id}>
                      <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(r)}
                          className="h-4 w-4 accent-brand-orange"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-gray-900">{r.name}</span>
                          <span className="block truncate text-xs text-gray-500">
                            {r.role === "EIGENTUEMER" ? "Eigentümer" : "Mieter"}
                            {r.detail && r.role === "MIETER" ? ` · ${r.detail}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {filtered.length > 0 ? (
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-xs text-brand-orange hover:underline"
            >
              Alle {filter.trim() ? "gefilterten " : ""}auswählen
            </button>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-gray-400">
          Zuerst ein Objekt wählen, dann Empfänger auswählen (mehrere möglich).
        </p>
      )}

      {/* Versteckte Felder: je ausgewähltem Empfänger eine ID. */}
      {selectedList.map((r) => (
        <input key={r.id} type="hidden" name="recipientId" value={r.id} />
      ))}
    </div>
  );
}
