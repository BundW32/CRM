"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardList,
  Contact,
  CornerDownLeft,
  CornerDownRight,
  Search,
} from "lucide-react";
import { searchPortalData } from "@/app/(portal)/search-actions";
import { MIN_QUERY_LENGTH, type SearchHit } from "@/lib/portal-search";

// ── Öffnen von außen ────────────────────────────────────────────────────────
// Die Leiste trägt den sichtbaren Knopf, die Palette lebt neben ihr im Layout.
// Ein Ereignis statt eines gemeinsamen Zustands: Wer öffnet, muss nichts über
// den Zustand der Palette wissen.
const openListeners = new Set<() => void>();

export function openCommandPalette() {
  openListeners.forEach((l) => l());
}

// Anzeige der Tastenkombination je Plattform. Als externer Store, weil der Wert
// erst im Browser feststeht – serverseitig gerendert stünde sonst „⌘" dort, wo
// gleich „Strg" erscheint, und die Hydration liefe auseinander.
const macStore = {
  subscribe() {
    return () => {};
  },
  get() {
    return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
  },
};

export function useIsMac() {
  return useSyncExternalStore(macStore.subscribe, macStore.get, () => false);
}

export type PaletteNavItem = { title: string; href: string; group: string };

// Icon je Gruppe – dieselbe Bildsprache wie die Leiste, damit man die Art des
// Treffers erkennt, bevor man den Text gelesen hat.
const GRUPPEN_ICONS: Record<string, LucideIcon> = {
  Objekte: Building2,
  Kontakte: Contact,
  Vorgänge: ClipboardList,
};

type Eintrag = {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  group: string;
};

/**
 * ⌘K-Palette: springen und suchen ohne Mausweg.
 *
 * Zwei Quellen, bewusst unterschiedlich weit gefasst:
 *
 * - **Sprungziele** kommen aus dem Menü-Modell (`app-nav.ts`) und stehen jeder
 *   Rolle offen. Sie enthalten nichts als die Punkte, die dieselbe Person auch
 *   in der Leiste sieht – inklusive der Einstellungs-Seiten, die hinter dem
 *   Zahnrad liegen und genau deshalb schwer zu finden sind.
 * - **Daten** (Objekte, Kontakte, Vorgänge) sucht `searchPortal` und nur für
 *   Verwalter. Das Adressbuch enthält die Telefonnummern aller Mieter; eine
 *   Suchfläche, die zu viel findet, wäre dasselbe Leck, das die Rollen-
 *   Gegenprobe des Menü-Umbaus ausschließen soll.
 */
export function CommandPalette({
  navItems,
  canSearchData,
}: {
  navItems: PaletteNavItem[];
  canSearchData: boolean;
}) {
  const router = useRouter();
  const isMac = useIsMac();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [aktiv, setAktiv] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reqRef = useRef(0);

  const schliessen = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setAktiv(0);
  }, []);

  // Öffnen: per Tastenkombination oder über den Knopf in der Leiste.
  useEffect(() => {
    const oeffnen = () => {
      setOpen(true);
      setAktiv(0);
    };
    openListeners.add(oeffnen);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        oeffnen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      openListeners.delete(oeffnen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Datensuche – verzögert, damit nicht jeder Tastendruck eine Abfrage auslöst.
  useEffect(() => {
    if (!open || !canSearchData) return;
    const term = query.trim();
    // Auch das Leeren läuft über den verzögerten Aufruf: ein setState direkt im
    // Effekt-Rumpf erzwingt eine zweite Renderrunde und wird abgewiesen.
    const handle = setTimeout(() => {
      const req = ++reqRef.current;
      startTransition(async () => {
        const gefunden = term.length < MIN_QUERY_LENGTH ? [] : await searchPortalData(term);
        if (reqRef.current === req) setHits(gefunden);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open, canSearchData]);

  // Sprungziele werden im Browser gefiltert – die Liste ist klein und liegt vor.
  const eintraege = useMemo<Eintrag[]>(() => {
    const term = query.trim().toLowerCase();
    const nav = navItems
      .filter((i) => !term || i.title.toLowerCase().includes(term))
      .map((i) => ({
        key: `nav-${i.href}`,
        title: i.title,
        subtitle: i.group,
        href: i.href,
        group: "Springen zu",
      }));
    const daten = hits.map((h) => ({
      key: h.id,
      title: h.title,
      subtitle: h.subtitle,
      href: h.href,
      group: h.group,
    }));
    return [...nav, ...daten];
  }, [navItems, hits, query]);

  // Bleibt die Auswahl über dem Ende der Liste stehen, zeigt sie ins Leere.
  const aktivIndex = Math.min(aktiv, Math.max(0, eintraege.length - 1));

  function waehlen(index: number) {
    const ziel = eintraege[index];
    if (!ziel) return;
    schliessen();
    router.push(ziel.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      schliessen();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktiv((v) => (eintraege.length === 0 ? 0 : (Math.min(v, eintraege.length - 1) + 1) % eintraege.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktiv((v) =>
        eintraege.length === 0 ? 0 : (Math.min(v, eintraege.length - 1) + eintraege.length - 1) % eintraege.length,
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      waehlen(aktivIndex);
    }
  }

  // Die aktive Zeile in den sichtbaren Bereich holen (Pfeiltasten).
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-aktiv="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [aktivIndex, eintraege.length]);

  if (!open) return null;

  const zuKurz = query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]">
      <button
        type="button"
        aria-label="Suche schließen"
        onClick={schliessen}
        className="fixed inset-0 cursor-default bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Suchen und springen"
        className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAktiv(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={canSearchData ? "Suchen oder springen…" : "Bereich springen…"}
            aria-label="Suchbegriff"
            role="combobox"
            aria-expanded
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            aria-activedescendant={
              eintraege[aktivIndex] ? `palette-${eintraege[aktivIndex].key}` : undefined
            }
            className="w-full bg-transparent py-3.5 text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          <kbd className="shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
            Esc
          </kbd>
        </div>

        <ul
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          aria-label="Treffer"
          className="min-h-0 flex-1 overflow-y-auto p-1.5"
        >
          {eintraege.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-gray-500">
              {zuKurz
                ? `Mindestens ${MIN_QUERY_LENGTH} Zeichen eingeben.`
                : pending
                  ? "Wird gesucht…"
                  : "Nichts gefunden."}
            </li>
          ) : (
            eintraege.map((e, index) => {
              const aktivHier = index === aktivIndex;
              // Gruppenüberschrift beim ersten Eintrag einer Gruppe.
              const neueGruppe = index === 0 || eintraege[index - 1].group !== e.group;
              const Icon = GRUPPEN_ICONS[e.group] ?? CornerDownRight;
              return (
                <li key={e.key}>
                  {neueGruppe ? (
                    <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-gray-400 first:pt-1">
                      {e.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    id={`palette-${e.key}`}
                    role="option"
                    aria-selected={aktivHier}
                    data-aktiv={aktivHier}
                    onMouseMove={() => setAktiv(index)}
                    onClick={() => waehlen(index)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                      aktivHier ? "bg-brand-orange-light" : "hover:bg-gray-50"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        aktivHier ? "text-brand-orange-dark" : "text-gray-300"
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${
                          aktivHier ? "font-semibold text-brand-orange-dark" : "text-gray-900"
                        }`}
                      >
                        {e.title}
                      </span>
                      {e.subtitle ? (
                        <span className="block truncate text-xs text-gray-500">{e.subtitle}</span>
                      ) : null}
                    </span>
                    {aktivHier ? (
                      <CornerDownLeft className="h-4 w-4 shrink-0 text-brand-orange-dark" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
          <span>↑ ↓ auswählen · ⏎ öffnen</span>
          <span>{isMac ? "⌘" : "Strg"} K</span>
        </div>
      </div>
    </div>
  );
}
