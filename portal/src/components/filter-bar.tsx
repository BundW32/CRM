"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Search, SlidersHorizontal, X } from "lucide-react";
import { inputClass } from "@/components/ui";
import { Combobox, type ComboOption } from "@/components/combobox";

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
  /** true = immer sichtbar in der Leiste; sonst im „Weitere Filter"-Menü. */
  primary?: boolean;
};
export type SortOption = { value: string; label: string };

export type ComboboxFilterConfig = {
  /** URL-Param-Schlüssel, z. B. "objekt". */
  key: string;
  label: string;
  placeholder: string;
  /** Vollständige Optionsliste (clientseitig gefiltert). */
  options: ComboOption[];
  currentValue?: string;
  /** Fallback-Anzeige, falls der Wert nicht in `options` steckt. */
  currentLabel?: string;
  disabled?: boolean;
  disabledHint?: string;
  /** Nicht rendern (z. B. „Nutzer" erst nach Objekt-Wahl). */
  hidden?: boolean;
  /** Weitere Param-Schlüssel, die bei Änderung/Reset mit geleert werden (Kaskade). */
  clears?: string[];
};

// ── URL-Helfer ───────────────────────────────────────────────────────────────
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

  return { apply, searchParams, pathname, router };
}

// ── Freitext-Suche (entprellt) ───────────────────────────────────────────────
function SearchBox({
  paramKey,
  placeholder,
  label,
}: {
  paramKey: string;
  placeholder: string;
  label: string;
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
    <label className="block min-w-[14rem] flex-1">
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      <div className="relative">
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
    </label>
  );
}

// ── Select-Filter mit Inline-„×" ─────────────────────────────────────────────
function SelectFilter({ config }: { config: FilterConfig }) {
  const { apply, searchParams } = useUrlUpdater();
  const value = searchParams.get(config.key) ?? "";
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">{config.label}</span>
      <div className="flex items-center gap-1">
        <select
          value={value}
          onChange={(e) => apply({ [config.key]: e.target.value })}
          aria-label={config.label}
          className={`${inputClass} w-auto`}
        >
          <option value="">{config.allLabel ?? "Alle"}</option>
          {config.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {value ? (
          <button
            type="button"
            onClick={() => apply({ [config.key]: null })}
            aria-label={`${config.label} zurücksetzen`}
            className="shrink-0 rounded p-1 text-gray-400 transition hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </label>
  );
}

// ── „Weitere Filter"-Popover ─────────────────────────────────────────────────
function MoreFilters({ filters }: { filters: FilterConfig[] }) {
  const { apply, searchParams } = useUrlUpdater();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const activeCount = filters.filter((f) => searchParams.get(f.key)).length;

  return (
    <div ref={rootRef} className="relative self-end">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex h-[38px] items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
          activeCount > 0
            ? "border-brand-orange/60 bg-brand-orange-light text-brand-orange-dark"
            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Weitere Filter
        {activeCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-xs font-semibold text-brand-green-dark">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <div className="space-y-3">
            {filters.map((f) => {
              const value = searchParams.get(f.key) ?? "";
              return (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-500">{f.label}</span>
                  <select
                    value={value}
                    onChange={(e) => apply({ [f.key]: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">{f.allLabel ?? "Alle"}</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => apply(Object.fromEntries(filters.map((f) => [f.key, null])))}
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50 hover:text-red-600"
            >
              Diese Filter zurücksetzen
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Aktive-Filter-Chips (nur für versteckte „Weitere Filter") ────────────────
function SecondaryChips({ filters }: { filters: FilterConfig[] }) {
  const { apply, searchParams } = useUrlUpdater();
  const chips = filters
    .map((f) => {
      const v = searchParams.get(f.key);
      if (!v) return null;
      const opt = f.options.find((o) => o.value === v);
      return { key: f.key, text: `${f.label}: ${opt?.label ?? v}` };
    })
    .filter((c): c is { key: string; text: string } => c !== null);

  if (chips.length === 0) return null;

  return (
    <>
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
    </>
  );
}

// ── FilterBar (Zusammenbau) ──────────────────────────────────────────────────
export function FilterBar({
  searchParamKey = "q",
  searchPlaceholder,
  searchLabel = "Suche",
  filters = [],
  comboboxes = [],
  sortOptions = [],
  defaultSort,
  className = "",
}: {
  searchParamKey?: string;
  /** Wenn gesetzt, wird die Freitextsuche angezeigt. */
  searchPlaceholder?: string;
  searchLabel?: string;
  filters?: FilterConfig[];
  comboboxes?: ComboboxFilterConfig[];
  sortOptions?: SortOption[];
  defaultSort?: string;
  className?: string;
}) {
  const { apply, searchParams, pathname, router } = useUrlUpdater();
  const sortValue = searchParams.get("sort") ?? defaultSort ?? sortOptions[0]?.value ?? "";
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";

  const primaryFilters = filters.filter((f) => f.primary);
  const secondaryFilters = filters.filter((f) => !f.primary);
  const visibleCombos = comboboxes.filter((c) => !c.hidden);

  // Kaskade: bei Änderung/Reset eines Combobox-Werts abhängige Felder mitleeren.
  function applyCombo(cfg: ComboboxFilterConfig, value: string | null) {
    const updates: Record<string, string | null> = { [cfg.key]: value };
    for (const k of cfg.clears ?? []) updates[k] = null;
    apply(updates);
  }

  const hasSearch = Boolean(searchPlaceholder) && (searchParams.get(searchParamKey) ?? "") !== "";
  const anyActive =
    hasSearch ||
    filters.some((f) => searchParams.get(f.key)) ||
    comboboxes.some((c) => searchParams.get(c.key));

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-end gap-3">
        {searchPlaceholder ? (
          <SearchBox paramKey={searchParamKey} placeholder={searchPlaceholder} label={searchLabel} />
        ) : null}

        {primaryFilters.map((f) => (
          <SelectFilter key={f.key} config={f} />
        ))}

        {visibleCombos.map((c) => (
          <Combobox
            key={c.key}
            label={c.label}
            placeholder={c.placeholder}
            options={c.options}
            value={c.currentValue}
            valueLabel={c.currentLabel}
            disabled={c.disabled}
            disabledHint={c.disabledHint}
            onSelect={(v) => applyCombo(c, v)}
            onClear={() => applyCombo(c, null)}
            className="min-w-[13rem]"
          />
        ))}

        {secondaryFilters.length > 0 ? <MoreFilters filters={secondaryFilters} /> : null}

        {sortOptions.length > 0 ? (
          <div className="ml-auto flex items-end gap-1.5">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Sortieren</span>
              <select
                value={sortValue}
                onChange={(e) => apply({ sort: e.target.value })}
                aria-label="Sortierfeld"
                className={`${inputClass} w-auto`}
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => apply({ dir: dir === "asc" ? "desc" : "asc" })}
              aria-label={dir === "asc" ? "Aufsteigend – zu absteigend wechseln" : "Absteigend – zu aufsteigend wechseln"}
              title={dir === "asc" ? "Aufsteigend" : "Absteigend"}
              className="inline-flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition hover:border-gray-400 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
            >
              <ArrowDownUp className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {anyActive ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <SecondaryChips filters={secondaryFilters} />
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gray-500 underline-offset-2 hover:text-red-600 hover:underline"
          >
            <X className="h-3.5 w-3.5" />
            Alle zurücksetzen
          </button>
        </div>
      ) : null}
    </div>
  );
}
