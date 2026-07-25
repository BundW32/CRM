"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { fieldFillClass } from "@/components/ui";

export type ComboOption = { value: string; label: string; sublabel?: string };

// Diakritika-/Groß-Klein-unabhängige Normalisierung (deutschfreundlich: ß→ss,
// Umlaute → Grundbuchstabe). So findet die Teilstring-Suche „ierf" auch
// „Kieferstraße" und „strasse" auch „Straße".
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Durchsuchbares Einzel-Auswahlfeld.
 * - Klick öffnet die vollständige Liste (kein Tippzwang).
 * - Tippen filtert live per Teilstring (an beliebiger Stelle im Namen) und
 *   sortiert die besten Treffer nach oben.
 * - Tastaturbedienung (↑/↓/Enter/Esc), Auswahl per Klick.
 * - Inline-„×" setzt genau dieses Feld zurück.
 * Vollständig clientseitig – die Optionen kommen fertig vom Server.
 */
export function Combobox({
  label,
  placeholder,
  options,
  value,
  valueLabel,
  onSelect,
  onClear,
  disabled = false,
  disabledHint,
  className = "",
}: {
  label: string;
  placeholder: string;
  options: ComboOption[];
  value?: string;
  /** Fallback-Anzeige, falls der gewählte Wert (noch) nicht in `options` steckt. */
  valueLabel?: string;
  onSelect: (value: string) => void;
  onClear: () => void;
  disabled?: boolean;
  disabledHint?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  function openMenu() {
    setActive(0);
    setQuery("");
    setOpen(true);
  }
  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  const selected = value ? options.find((o) => o.value === value) : undefined;
  const selectedLabel = selected?.label ?? (value ? valueLabel ?? "" : "");

  // Sichtbare Optionen: gefiltert (Teilstring) + sortiert (frühester Treffer zuerst).
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options
      .map((opt) => ({ opt, idx: normalize(`${opt.label} ${opt.sublabel ?? ""}`).indexOf(q) }))
      .filter((r) => r.idx >= 0)
      .sort((a, b) => a.idx - b.idx || a.opt.label.localeCompare(b.opt.label, "de"))
      .map((r) => r.opt);
  }, [options, query]);

  // Aktiven Eintrag in den sichtbaren Bereich scrollen.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // Klick außerhalb schließt.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function choose(opt: ComboOption) {
    onSelect(opt.value);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[active];
      if (opt) choose(opt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {open ? (
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={selectedLabel || placeholder}
          className={`${fieldFillClass} pr-8`}
          autoComplete="off"
          role="combobox"
          aria-label={label}
          aria-expanded
          aria-controls={listId}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={openMenu}
          aria-label={label}
          title={disabled ? disabledHint : undefined}
          className={`${fieldFillClass} flex items-center gap-2 pr-8 text-left disabled:cursor-not-allowed disabled:bg-gray-100/60 disabled:text-gray-400 disabled:hover:bg-gray-100/60`}
        >
          <span className={`truncate ${selectedLabel ? "text-gray-900" : "text-gray-400"}`}>
            {selectedLabel || (disabled && disabledHint ? disabledHint : placeholder)}
          </span>
        </button>
      )}

      {/* Rechts: Inline-„×" (Feld zurücksetzen) sobald ein Wert gewählt ist, sonst Chevron. */}
      {value && !disabled ? (
        <button
          type="button"
          onClick={() => {
            onClear();
            close();
          }}
          aria-label={`${label} zurücksetzen`}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-gray-400 transition hover:text-red-600"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <ChevronDown
          className={`pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${disabled ? "text-gray-300" : "text-gray-400"}`}
        />
      )}

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-60 w-full min-w-[14rem] overflow-auto rounded-xl border border-gray-200/70 bg-white py-1 shadow-e2"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-gray-400">Keine Treffer.</li>
          ) : (
            filtered.map((opt, i) => (
              <li key={opt.value} role="option" aria-selected={opt.value === value}>
                <button
                  type="button"
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  // onMouseDown + preventDefault: Auswahl feuert, bevor das Feld den Fokus verliert.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(opt);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                    i === active ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-gray-900">{opt.label}</span>
                    {opt.sublabel ? (
                      <span className="block truncate text-xs text-gray-400">{opt.sublabel}</span>
                    ) : null}
                  </span>
                  {opt.value === value ? <Check className="h-4 w-4 shrink-0 text-brand-green" /> : null}
                </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
    </div>
  );
}
