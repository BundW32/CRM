"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  Contact,
  FileSignature,
  Gauge,
  Gavel,
  HardDriveDownload,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Plug,
  Receipt,
  ShieldCheck,
  StickyNote,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import type { VerwaltungGroup, VerwaltungIcon } from "@/lib/verwaltung-nav";

// Icon-Auflösung: das Menü-Modell (server-seitig) trägt nur den Schlüssel, die
// konkreten Lucide-Icons liegen hier im Client-Bundle.
const ICONS: Record<VerwaltungIcon, LucideIcon> = {
  objekte: Building2,
  nutzer: Users,
  eigentuemer: PieChart,
  kontakte: Contact,
  notizen: StickyNote,
  beschluesse: Gavel,
  versammlungen: CalendarDays,
  weg: Wallet,
  zaehler: Gauge,
  wartung: Wrench,
  uebergabe: FileSignature,
  branding: Palette,
  integrationen: Plug,
  quellen: HardDriveDownload,
  abrechnung: Receipt,
  audit: ShieldCheck,
};

/** Ein Zähler-Badge je Menüpunkt (href → Inhalt). Wird per Suspense nachgeliefert. */
export type CountBadge = { label: string; tone?: "ok" | "warn" };
export type CountBadges = Record<string, CountBadge>;

// ── Eingeklappter Zustand (über Seitenwechsel hinweg gemerkt) ────────────────
// Bewusst als externer Store statt State+Effect: so bleibt der Wert beim
// Navigieren erhalten und der Lesevorgang bleibt frei von Render-Nebenwirkungen.
const COLLAPSE_KEY = "verwaltung-nav-collapsed";
const listeners = new Set<() => void>();

const collapseStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  },
  get() {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  },
  set(value: boolean) {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
    } catch {
      // Privater Modus o. Ä. – dann gilt der Zustand nur für diese Seite.
    }
    listeners.forEach((l) => l());
  },
};

function useCollapsed() {
  return useSyncExternalStore(
    collapseStore.subscribe,
    collapseStore.get,
    () => false, // Serverseitig immer ausgeklappt rendern.
  );
}

function isActive(pathname: string, href: string) {
  // Gleiche Logik wie die Topbar (`components/nav.tsx`).
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function VerwaltungShell({
  groups,
  badgesPromise,
  children,
}: {
  groups: VerwaltungGroup[];
  /** Zähler-Badges als Promise: die Sidebar rendert sofort, Badges erscheinen,
   *  sobald das Promise aufgelöst ist (blockiert den ersten Render nicht). */
  badgesPromise?: Promise<CountBadges>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [badges, setBadges] = useState<CountBadges | undefined>(undefined);
  const collapsed = useCollapsed();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!badgesPromise) return;
    let active = true;
    badgesPromise.then((b) => {
      if (active) setBadges(b);
    });
    return () => {
      active = false;
    };
  }, [badgesPromise]);

  // Übergänge erst nach dem ersten Anzeigen aktivieren – sonst würde ein
  // gemerkter „eingeklappt“-Zustand beim Laden sichtbar zusammenfahren.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.dataset.ready = "true";
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /** @param rail  Icon-Leiste (eingeklappt) – nur im Desktop-Fall relevant. */
  function renderNav(rail: boolean) {
    return (
      <nav aria-label="Verwaltungsbereiche" className="flex flex-col gap-1">
        {groups.map((group, groupIndex) => (
          <div key={group.label} className="mb-1">
            {rail ? (
              // Eingeklappt: dünne Trennlinie statt Gruppentitel (nicht vor der ersten).
              groupIndex > 0 ? (
                <div className="mx-2 my-2 border-t border-gray-100" />
              ) : null
            ) : (
              <p className="truncate px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-gray-400 first:pt-1">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href);
              const badge = item.countKey ? badges?.[item.countKey] : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  title={rail ? item.title : undefined}
                  className={`flex items-center gap-2.5 rounded-lg py-2 text-sm transition ${
                    rail ? "justify-center px-2" : "px-3"
                  } ${
                    active
                      ? "bg-brand-orange-light font-semibold text-brand-orange-dark"
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-green"
                  }`}
                >
                  <span className="relative shrink-0">
                    <Icon
                      className={`h-[18px] w-[18px] ${
                        active ? "text-brand-orange-dark" : "text-gray-400"
                      }`}
                    />
                    {/* Eingeklappt: Zähler als kleiner Punkt, damit Hinweise
                        (z. B. überfällige Wartung) nicht verloren gehen. */}
                    {rail && badge?.tone === "warn" ? (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-warn ring-2 ring-white" />
                    ) : null}
                  </span>
                  {rail ? (
                    <span className="sr-only">{item.title}</span>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {badge ? (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            badge.tone === "warn"
                              ? "bg-warn-light text-warn"
                              : badge.tone === "ok"
                                ? "bg-good-light text-good"
                                : "border border-gray-200 bg-white text-gray-500"
                          }`}
                        >
                          {badge.label}
                        </span>
                      ) : null}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <div
      ref={rootRef}
      data-verwaltung-shell=""
      className={`md:grid md:gap-6 ${
        collapsed ? "md:grid-cols-[3.75rem_1fr]" : "md:grid-cols-[15rem_1fr]"
      }`}
    >
      {/* Mobil: Umschalter für die Bereichsliste. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/95 px-3.5 py-2 text-sm font-semibold text-gray-800 shadow-sm md:hidden"
        aria-label="Bereiche öffnen"
      >
        <Menu className="h-[18px] w-[18px]" />
        Bereiche
      </button>

      {/* Desktop-Sidebar. Der Offset entspricht der Höhe der Kopfleiste plus dem
          Innenabstand von <main> – so rastet die Leiste sofort ein und rutscht
          beim Scrollen nicht erst ein Stück mit. */}
      <aside className="hidden min-w-0 md:block">
        <div className="sticky top-[6.5rem] max-h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
          <div className={`mb-1 flex ${collapsed ? "justify-center" : "justify-end"}`}>
            <button
              type="button"
              onClick={() => collapseStore.set(!collapsed)}
              aria-label={collapsed ? "Menü ausklappen" : "Menü einklappen"}
              aria-expanded={!collapsed}
              title={collapsed ? "Menü ausklappen" : "Menü einklappen"}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-green"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-[18px] w-[18px]" />
              ) : (
                <PanelLeftClose className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
          {renderNav(collapsed)}
        </div>
      </aside>

      {/* Mobil: Off-Canvas + Scrim (dort immer mit Beschriftung). */}
      {open ? (
        <>
          <button
            type="button"
            aria-label="Bereiche schließen"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/40 md:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[82%] max-w-xs animate-drawer-in overflow-y-auto rounded-r-2xl border-r border-gray-200 bg-white p-2 shadow-2xl motion-reduce:animate-none md:hidden">
            <div className="flex items-center justify-between px-2 pb-1 pt-1">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
                Bereiche
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Schließen"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNav(false)}
          </aside>
        </>
      ) : null}

      {/* Detailbereich – die jeweilige Unterseite bringt ihren eigenen PageTitle mit. */}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
