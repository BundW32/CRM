"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Search, X } from "lucide-react";
import { inputClass } from "@/components/ui";

// ── Typen ────────────────────────────────────────────────────────────────────
export type FilterOption = { value: string; label: string };
export type FilterConfig = {
  /** URL-Param-Schlüssel, z. B. "status". */
  key: string;
  /** Anzeige-Label, z. B. "Status". */
  label: string;
  options: FilterOption[];
  /** Text der „alle"-Option (Default „Alle"). */
  allLabel?: string;
};
export type SortOption = { value: string; label: string };

export type EntityHit = { id: string; label: string; sublabel?: string };
export type EntityFilterConfig = {
  /** URL-Param-Schlüssel, z. B. "objekt". */
  key: string;
  placeholder: string;
  /** Aktuell gewählter Wert (id) und dessen Label – vom Server aufgelöst. */
  currentValue?: string;
  currentLabel?: string;
  /** Serverseitige Suche (Server-Action). */
  search: (query: string) => Promise<EntityHit[]>;
};

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────
function useUrlUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** Params anwenden ("" / null löscht), Seite immer auf 1 zurücksetzen. */
  function apply(updates: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete("page");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return { apply, searchParams, pathname };
}

// ── Freitext-Suche (entprellt) ───────────────────────────────────────────────
function SearchBox({
  paramKey,
  placeholder,
}: {
  paramKey: string;
  placeholder: string;
}) {
  const { apply, searchParams } = useUrlUpdater();
  const urlValue = searchParams.get(paramKey) ?? "";
  const [text, setText] = useState(urlValue);
  const [prevUrl, setPrevUrl] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL → Feld angleichen (Zurück-Button, „Alle zurücksetzen"), ohne Effect.
  if (urlValue !== prevUrl) {
    setPrevUrl(urlValue);
    setText(urlValue);
  }

  // Feld → URL entprellt (Debounce im Event-Handler, kein Effect nötig).
  function onChange(v: string) {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ [paramKey]: v }), 350);
  }

  return (
    <div className="relative min-w-[12rem] flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pl-9`}
        autoComplete="off"
      />
    </div>
  );
}

// ── Typeahead-Entitäts-Filter (Objekt/Einheit …) ─────────────────────────────
function EntityFilter({ config }: { config: EntityFilterConfig }) {
  const { apply } = useUrlUpdater();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityHit[]>([]);
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

  function onChange(v: string) {
    setQuery(v);
    const req = ++reqRef.current;
    if (v.trim().length < 2) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const r = await config.search(v);
      if (reqRef.current === req) setResults(r);
    });
  }

  // Ist bereits etwas gewählt, übernimmt der aktive-Filter-Chip die Anzeige.
  if (config.currentValue) return null;

  return (
    <div className="relative min-w-[12rem]">
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={config.placeholder}
        className={inputClass}
        autoComplete="off"
      />
      {query.trim().length >= 2 ? (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {pending ? (
            <p className="px-3 py-2 text-xs text-gray-400">Suche …</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">Keine Treffer.</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery("");
                  setResults([]);
                  apply({ [config.key]: r.id });
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{r.label}</span>
                {r.sublabel ? <span className="text-gray-400"> · {r.sublabel}</span> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Aktive-Filter-Chips ──────────────────────────────────────────────────────
function ActiveChips({
  searchParamKey,
  filters,
  entity,
}: {
  searchParamKey?: string;
  filters: FilterConfig[];
  entity?: EntityFilterConfig;
}) {
  const { apply, searchParams, pathname } = useUrlUpdater();
  const router = useRouter();

  const chips: { key: string; text: string }[] = [];
  const q = searchParamKey ? searchParams.get(searchParamKey) : null;
  if (q) chips.push({ key: searchParamKey!, text: `Suche: „${q}"` });
  for (const f of filters) {
    const v = searchParams.get(f.key);
    if (v) {
      const opt = f.options.find((o) => o.value === v);
      chips.push({ key: f.key, text: `${f.label}: ${opt?.label ?? v}` });
    }
  }
  if (entity?.currentValue) {
    chips.push({ key: entity.key, text: entity.currentLabel ?? entity.currentValue });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange-light px-2.5 py-1 text-xs font-medium text-brand-orange-dark"
        >
          {c.text}
          <button
            type="button"
            onClick={() => apply({ [c.key]: null })}
            aria-label={`Filter „${c.text}" entfernen`}
            className="rounded-full text-brand-orange-dark/60 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => router.replace(pathname, { scroll: false })}
        className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-brand-green hover:underline"
      >
        Alle zurücksetzen
      </button>
    </div>
  );
}

// ── FilterBar (Zusammenbau) ──────────────────────────────────────────────────
export function FilterBar({
  searchParamKey = "q",
  searchPlaceholder,
  filters = [],
  sortOptions = [],
  defaultSort,
  entity,
  className = "",
}: {
  searchParamKey?: string;
  /** Wenn gesetzt, wird die Freitextsuche angezeigt. */
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  sortOptions?: SortOption[];
  defaultSort?: string;
  entity?: EntityFilterConfig;
  className?: string;
}) {
  const { apply, searchParams } = useUrlUpdater();
  const sortValue = searchParams.get("sort") ?? defaultSort ?? sortOptions[0]?.value ?? "";
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";

  const selectClass = `${inputClass} w-auto`;

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {searchPlaceholder ? (
          <SearchBox paramKey={searchParamKey} placeholder={searchPlaceholder} />
        ) : null}

        {entity ? <EntityFilter config={entity} /> : null}

        {filters.map((f) => (
          <select
            key={f.key}
            value={searchParams.get(f.key) ?? ""}
            onChange={(e) => apply({ [f.key]: e.target.value })}
            aria-label={f.label}
            className={selectClass}
          >
            <option value="">{f.allLabel ?? "Alle"}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}

        {sortOptions.length > 0 ? (
          <div className="ml-auto flex items-center gap-1.5">
            <label className="text-xs font-medium text-gray-500">Sortieren</label>
            <select
              value={sortValue}
              onChange={(e) => apply({ sort: e.target.value })}
              aria-label="Sortierfeld"
              className={selectClass}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => apply({ dir: dir === "asc" ? "desc" : "asc" })}
              aria-label={dir === "asc" ? "Aufsteigend – zu absteigend wechseln" : "Absteigend – zu aufsteigend wechseln"}
              title={dir === "asc" ? "Aufsteigend" : "Absteigend"}
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition hover:border-gray-400 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
            >
              <ArrowDownUp className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <ActiveChips searchParamKey={searchPlaceholder ? searchParamKey : undefined} filters={filters} entity={entity} />
    </div>
  );
}
