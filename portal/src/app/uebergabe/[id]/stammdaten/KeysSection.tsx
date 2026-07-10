"use client";

import { useState } from "react";

const STANDARD_KEYS = [
  { name: "keysApartment", label: "Wohnungsschlüssel" },
  { name: "keysMailbox", label: "Briefkasten" },
  { name: "keysBasement", label: "Keller" },
  { name: "keysGarage", label: "Garage" },
];

type CustomKey = { id: number; label: string; count: number };

function Counter({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-7 h-7 rounded-md border border-gray-300 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-[0.98] transition-all select-none"
        aria-label="Verringern"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14" strokeLinecap="round" />
        </svg>
      </button>
      <span className="w-7 text-center text-sm font-semibold text-gray-900 tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded-md border border-gray-300 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-[0.98] transition-all select-none"
        aria-label="Erhöhen"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function parseKeysOther(raw: string | null): CustomKey[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part, i) => {
      const m = part.trim().match(/^(.*?)\s*\((\d+)\)$/);
      if (m) return { id: i, label: m[1].trim(), count: parseInt(m[2], 10) };
      const plain = part.trim();
      if (!plain) return null;
      return { id: i, label: plain, count: 1 };
    })
    .filter((k): k is CustomKey => k !== null && k.label !== "");
}

export function KeysSection({
  initial,
}: {
  initial: {
    keysApartment: number | null;
    keysMailbox: number | null;
    keysBasement: number | null;
    keysGarage: number | null;
    keysOther: string | null;
  };
}) {
  const [counts, setCounts] = useState<Record<string, number>>({
    keysApartment: initial.keysApartment ?? 0,
    keysMailbox: initial.keysMailbox ?? 0,
    keysBasement: initial.keysBasement ?? 0,
    keysGarage: initial.keysGarage ?? 0,
  });

  const [customKeys, setCustomKeys] = useState<CustomKey[]>(() =>
    parseKeysOther(initial.keysOther)
  );
  const [nextId, setNextId] = useState(1000);

  const keysOtherValue = customKeys
    .filter((k) => k.label.trim())
    .map((k) => `${k.label.trim()} (${k.count})`)
    .join(", ");

  const addCustomKey = () => {
    setCustomKeys((prev) => [...prev, { id: nextId, label: "", count: 1 }]);
    setNextId((n) => n + 1);
  };

  const updateCustomKey = (id: number, updates: Partial<CustomKey>) => {
    setCustomKeys((prev) => prev.map((k) => (k.id === id ? { ...k, ...updates } : k)));
  };

  const removeCustomKey = (id: number) => {
    setCustomKeys((prev) => prev.filter((k) => k.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Standard key types */}
      <div className="grid grid-cols-2 gap-3">
        {STANDARD_KEYS.map((k) => (
          <div
            key={k.name}
            className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5"
          >
            <span className="text-xs font-medium text-gray-700 leading-tight">{k.label}</span>
            <Counter
              value={counts[k.name]}
              onChange={(v) => setCounts((prev) => ({ ...prev, [k.name]: v }))}
            />
            <input type="hidden" name={k.name} value={counts[k.name]} />
          </div>
        ))}
      </div>

      {/* Custom key types */}
      <div className="space-y-2">
        {customKeys.map((k) => (
          <div key={k.id} className="flex items-center gap-2 animate-page-in">
            <input
              type="text"
              value={k.label}
              onChange={(e) => updateCustomKey(k.id, { label: e.target.value })}
              placeholder="z. B. Gartenschlüssel"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30 transition duration-150"
            />
            <Counter value={k.count} onChange={(v) => updateCustomKey(k.id, { count: v })} />
            <button
              type="button"
              onClick={() => removeCustomKey(k.id)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 active:scale-[0.98] transition-all"
              aria-label="Entfernen"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addCustomKey}
          className="flex items-center gap-1.5 text-sm font-medium text-brand-orange hover:text-brand-orange-dark active:scale-[0.98] transition-all"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Weiteren Schlüssel hinzufügen
        </button>

        <input type="hidden" name="keysOther" value={keysOtherValue} />
      </div>
    </div>
  );
}
