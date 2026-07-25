"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { fieldOnDarkClass } from "@/components/ui";
import { Combobox, type ComboOption } from "@/components/combobox";

// ── Typen ────────────────────────────────────────────────────────────────────
export type FilterOption = { value: string; label: string };
export type FilterConfig = {
  /** URL-Param-Schlüssel, z. B. "status". */
  key: string;
  /** Anzeige-Label, z. B. "Status". Dient zugleich als Platzhalter (kein Feld-Label darüber). */
  label: string;
  options: FilterOption[];
  /** Text der „alle"-Option (Default = das Label, z. B. „Status"). */
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

// Einheitliche, FESTE Breite aller Auswahlfelder. Wichtig: Felder dürfen nicht
// mit ihrem Inhalt wachsen, sonst springt die Leiste beim Filtern. Zu lange
// Werte werden stattdessen abgeschnitten (truncate).
const FIELD_WIDTH = "w-[10rem]";

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
  hint,
}: {
  paramKey: string;
  placeholder: string;
  /** Ausführliche Beschreibung (Tooltip + Screenreader), wenn der Platzhalter kurz ist. */
  hint?: string;
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
    <div className="relative min-w-[8rem] flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={hint ?? placeholder}
        title={hint}
        className={`${fieldOnDarkClass} pl-9`}
        autoComplete="off"
      />
    </div>
  );
}

// ── Auswahl-Filter (Status, Art, …) ──────────────────────────────────────────
// Nutzt bewusst dieselbe Combobox wie Objekt/Einheit/Nutzer – kein natives
// <select>. Nur so sehen alle Filter und alle aufklappenden Menüs gleich aus.
// Ohne Label darüber: der Platzhalter trägt den Feldnamen (z. B. „Status").
function SelectFilter({
  config,
  tone = "onDark",
}: {
  config: FilterConfig;
  tone?: "onLight" | "onDark";
}) {
  const { apply, searchParams } = useUrlUpdater();
  const value = searchParams.get(config.key) ?? "";
  return (
    <Combobox
      label={config.label}
      placeholder={config.label}
      options={config.options.map((o) => ({ value: o.value, label: o.label }))}
      value={value || undefined}
      onSelect={(v) => apply({ [config.key]: v })}
      onClear={() => apply({ [config.key]: null })}
      // Suchfeld erst ab längeren Listen (z. B. Gewerk) – sonst reines Menü.
      searchable={config.options.length > 8}
      clearOption={config.allLabel ?? "Alle"}
      tone={tone}
      className={tone === "onDark" ? FIELD_WIDTH : "w-full"}
    />
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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex h-9 items-center gap-2 rounded-[10px] px-3 text-sm font-medium ring-1 ring-inset transition ${
          activeCount > 0
            ? "bg-brand-orange/15 text-brand-orange ring-brand-orange/35"
            : "bg-white/[0.07] text-gray-300 ring-white/10 hover:bg-white/[0.12]"
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filter
        {activeCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-xs font-semibold text-brand-green-dark">
            {activeCount}
          </span>
        ) : null}
      </button>

      {/* Rechtsbündig aufklappen – der Button sitzt am Ende der Leiste, sonst
          liefe das Menü rechts aus dem Bild. Auf schmalen Schirmen, wo die
          Leiste umbricht und der Button links steht, andersherum. */}
      {open ? (
        <div className="absolute right-0 z-30 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200/70 bg-white p-3 shadow-e2 max-sm:left-0 max-sm:right-auto">
          <div className="space-y-3">
            {filters.map((f) => (
              <div key={f.key}>
                <span className="mb-1 block text-xs font-medium text-gray-500">{f.label}</span>
                <SelectFilter config={f} tone="onLight" />
              </div>
            ))}
          </div>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => apply(Object.fromEntries(filters.map((f) => [f.key, null])))}
              className="mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50 hover:text-red-600"
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

  return (
    <>
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.09] px-2.5 py-1 text-xs font-medium text-gray-300"
        >
          {c.text}
          <button
            type="button"
            onClick={() => apply({ [c.key]: null })}
            aria-label={`Filter „${c.text}" entfernen`}
            className="text-gray-400 hover:text-red-400"
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
  searchHint,
  filters = [],
  comboboxes = [],
  className = "",
}: {
  searchParamKey?: string;
  /** Wenn gesetzt, wird die Freitextsuche angezeigt. */
  searchPlaceholder?: string;
  /** Was durchsucht wird – als Tooltip/Screenreader-Text zum kurzen Platzhalter. */
  searchHint?: string;
  filters?: FilterConfig[];
  comboboxes?: ComboboxFilterConfig[];
  className?: string;
}) {
  const { apply, searchParams, pathname, router } = useUrlUpdater();

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

  // Kein Container: die Felder schweben direkt auf dem dunklen Shell-Hintergrund.
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {searchPlaceholder ? (
          <SearchBox paramKey={searchParamKey} placeholder={searchPlaceholder} hint={searchHint} />
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
            tone="onDark"
            className={FIELD_WIDTH}
          />
        ))}

        {secondaryFilters.length > 0 ? <MoreFilters filters={secondaryFilters} /> : null}
      </div>

      {anyActive ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 px-0.5">
          <SecondaryChips filters={secondaryFilters} />
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gray-400 transition hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
            Alle zurücksetzen
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ── Sortier-Steuerung (kompaktes Menü für die Ergebniszeile) ─────────────────
// Bewusst NICHT Teil der Filterleiste: sitzt dezent rechts neben der Trefferzahl
// („X Vorgänge"), damit die Leiste einzeilig und schmal bleibt.
export function SortControl({
  sortOptions,
  defaultSort,
}: {
  sortOptions: SortOption[];
  defaultSort?: string;
}) {
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

  if (sortOptions.length === 0) return null;
  const sortValue = searchParams.get("sort") ?? defaultSort ?? sortOptions[0].value;
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const current = sortOptions.find((o) => o.value === sortValue) ?? sortOptions[0];

  const row =
    "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-gray-50";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-400 transition hover:bg-white/[0.07] hover:text-gray-200"
      >
        <ArrowDownUp className="h-3.5 w-3.5" />
        {current.label}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-1.5 w-56 rounded-xl border border-gray-200/70 bg-white p-1 shadow-e2">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Sortieren nach
          </p>
          {sortOptions.map((o) => (
            <button key={o.value} type="button" onClick={() => apply({ sort: o.value })} className={row}>
              <span className={o.value === sortValue ? "font-medium text-gray-900" : "text-gray-700"}>{o.label}</span>
              {o.value === sortValue ? <Check className="h-4 w-4 shrink-0 text-brand-green" /> : null}
            </button>
          ))}
          <div className="my-1 border-t border-gray-100" />
          {(["desc", "asc"] as const).map((d) => (
            <button key={d} type="button" onClick={() => apply({ dir: d })} className={row}>
              <span className={dir === d ? "font-medium text-gray-900" : "text-gray-700"}>
                {d === "desc" ? "Absteigend" : "Aufsteigend"}
              </span>
              {dir === d ? <Check className="h-4 w-4 shrink-0 text-brand-green" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
