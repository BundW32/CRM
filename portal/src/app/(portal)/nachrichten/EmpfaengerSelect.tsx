"use client";

import { useMemo, useState } from "react";
import { inputClass } from "@/components/ui";

export type RecipientRow = {
  id: string;
  name: string;
  role: "MIETER" | "EIGENTUEMER";
  propertyName: string | null;
};

export function EmpfaengerSelect({ recipients }: { recipients: RecipientRow[] }) {
  const [query, setQuery] = useState("");

  const q = query.toLowerCase().trim();

  const filtered = q
    ? recipients.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.propertyName ?? "").toLowerCase().includes(q)
      )
    : recipients;

  // Group: Eigentümer first, then Mieter grouped by property
  const { eigentuemer, mieterByProperty } = useMemo(() => {
    const eigentuemer = filtered.filter((r) => r.role === "EIGENTUEMER");
    const mieterByProperty = new Map<string, RecipientRow[]>();
    for (const r of filtered.filter((r) => r.role === "MIETER")) {
      const key = r.propertyName ?? "Sonstige";
      if (!mieterByProperty.has(key)) mieterByProperty.set(key, []);
      mieterByProperty.get(key)!.push(r);
    }
    return { eigentuemer, mieterByProperty };
  }, [filtered]);

  return (
    <div className="space-y-1.5">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Name oder Objekt suchen …"
        className={inputClass}
        autoComplete="off"
      />
      <select name="recipientId" required className={inputClass} defaultValue="">
        <option value="" disabled>
          – bitte wählen –
        </option>

        {eigentuemer.length > 0 ? (
          <optgroup label="Eigentümer">
            {eigentuemer.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.propertyName ? ` (${r.propertyName})` : ""}
              </option>
            ))}
          </optgroup>
        ) : null}

        {[...mieterByProperty.entries()].map(([propertyName, list]) => (
          <optgroup key={propertyName} label={`Mieter – ${propertyName}`}>
            {list.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </optgroup>
        ))}

        {filtered.length === 0 ? (
          <option disabled>Keine Treffer</option>
        ) : null}
      </select>
    </div>
  );
}
