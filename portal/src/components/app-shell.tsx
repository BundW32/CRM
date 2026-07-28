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
  Activity,
  Building2,
  CalendarDays,
  ClipboardList,
  Contact,
  FileSignature,
  FileText,
  Files,
  Gauge,
  Gavel,
  HardDriveDownload,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Plug,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  StickyNote,
  UserRound,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import { openCommandPalette, useIsMac } from "@/components/command-palette";
import { OrgLogo } from "@/components/logo";
import { SETTINGS_HREF, type NavGroup, type NavIcon } from "@/lib/app-nav";
import { cardSurfaceClass } from "@/components/ui";

// Icon-Auflösung: das Menü-Modell (server-seitig) trägt nur den Schlüssel.
const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  vorgaenge: ClipboardList,
  nachrichten: MessageSquare,
  aushaenge: Megaphone,
  dokumente: Files,
  objekte: Building2,
  nutzer: Users,
  eigentuemer: PieChart,
  kontakte: Contact,
  notizen: StickyNote,
  beschluesse: Gavel,
  versammlungen: CalendarDays,
  antraege: FileText,
  gemeinschaft: Users,
  finanzen: Wallet,
  weg: Wallet,
  zaehler: Gauge,
  verbrauch: Activity,
  wartung: Wrench,
  uebergabe: FileSignature,
  beirat: ClipboardList,
  plattform: LayoutGrid,
  einstellungen: Settings,
  branding: Palette,
  integrationen: Plug,
  quellen: HardDriveDownload,
  abrechnung: Receipt,
  audit: ShieldCheck,
};

export type CountBadge = { label: string; tone?: "ok" | "warn" };
export type CountBadges = Record<string, CountBadge>;

// ── Eingeklappter Zustand (über Seitenwechsel hinweg gemerkt) ────────────────
// Als externer Store statt State+Effect: der Wert überlebt das Navigieren und
// das Lesen bleibt frei von Render-Nebenwirkungen.
const COLLAPSE_KEY = "portal-nav-collapsed";
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
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppShell({
  groups,
  badgesPromise,
  user,
  logoUrl,
  orgName,
  showSettings,
  showPlattform,
  children,
}: {
  groups: NavGroup[];
  /** Zähler-Badges als Promise: die Leiste rendert sofort, Badges kommen nach. */
  badgesPromise?: Promise<CountBadges>;
  user: { name: string; roleLabel: string };
  logoUrl: string;
  orgName: string;
  showSettings: boolean;
  showPlattform: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [badges, setBadges] = useState<CountBadges | undefined>(undefined);
  const collapsed = useCollapsed();
  const isMac = useIsMac();
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

  function closeAll() {
    setDrawerOpen(false);
    setAccountOpen(false);
  }

  /** Sichtbarer Einstieg in die ⌘K-Palette. Eine Tastenkombination allein
   *  findet nur, wer sie schon kennt – der Knopf macht sie auffindbar und ist
   *  auf dem Telefon ohnehin der einzige Weg. */
  function renderSearch(rail: boolean) {
    return (
      <button
        type="button"
        onClick={() => {
          closeAll();
          openCommandPalette();
        }}
        title={rail ? "Suchen" : undefined}
        className={`mb-1 flex w-full items-center gap-2.5 rounded-lg py-2 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-brand-green ${
          rail ? "justify-center px-2" : "px-3"
        }`}
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-gray-400" />
        {rail ? (
          <span className="sr-only">Suchen</span>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-left">Suchen</span>
            <kbd className="shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              {isMac ? "⌘" : "Strg"} K
            </kbd>
          </>
        )}
      </button>
    );
  }

  /**
   * @param rail Icon-Leiste (eingeklappt) – nur im Desktop-Fall relevant.
   *
   * Die `data-tour`-Marker sind die Sprungziele der geführten Einrichtung. Sie
   * werden **aus der Navigation abgeleitet**, nicht von Hand gesetzt: Ein neuer
   * Menüpunkt bringt seinen Marker damit selbst mit, ein entfernter nimmt ihn
   * mit. Von Hand gepflegte Marker wären genau die Kopplung, die eine Führung
   * bei jedem Umbau zerbrechen lässt. `src/lib/tour.test.ts` prüft, dass jeder
   * Schritt sein Ziel findet.
   */
  function renderNav(rail: boolean) {
    return (
      <nav aria-label="Hauptnavigation" data-tour="navigation" className="flex flex-col gap-1">
        {groups.map((group, groupIndex) => (
          <div
            key={group.label ?? `g${groupIndex}`}
            data-tour={group.label ? `gruppe-${group.label.toLowerCase()}` : undefined}
            className="mb-1"
          >
            {group.label ? (
              rail ? (
                groupIndex > 0 ? <div className="mx-2 my-2 border-t border-gray-100" /> : null
              ) : (
                <p className="truncate px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-gray-400 first:pt-1">
                  {group.label}
                </p>
              )
            ) : null}
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href);
              const badge = item.countKey ? badges?.[item.countKey] : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={`nav-${item.href.replace(/^\//, "").replace(/\//g, "-")}`}
                  onClick={closeAll}
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
                    {/* Eingeklappt: Warnhinweise als Punkt, damit sie nicht untergehen. */}
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

  /** Kopf der Leiste: Logo (eingeklappt nur die Bildmarke) + Einklapp-Schalter.
   *  Das Logo steht mittig und bewusst groß – es ist White-Label und trägt die
   *  Marke der jeweiligen Hausverwaltung. Der Schalter sitzt daneben am Rand,
   *  damit er die Mitte nicht verschiebt. */
  function renderSidebarHead(rail: boolean) {
    if (rail) {
      return (
        <div className="mb-3 flex flex-col items-center gap-2 pt-1">
          <Link href="/dashboard" onClick={closeAll} className="shrink-0">
            <OrgLogo src={logoUrl} alt={orgName} className="h-9 w-9 object-contain" />
          </Link>
          <button
            type="button"
            onClick={() => collapseStore.set(false)}
            aria-label="Menü ausklappen"
            aria-expanded={false}
            title="Menü ausklappen"
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-green"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          </button>
        </div>
      );
    }
    return (
      <div className="relative mb-3 flex items-center justify-center px-1 pt-1">
        <Link href="/dashboard" onClick={closeAll} className="min-w-0">
          <OrgLogo
            src={logoUrl}
            alt={orgName}
            className="h-14 w-auto max-w-[9.5rem] object-contain"
          />
        </Link>
        <button
          type="button"
          onClick={() => collapseStore.set(true)}
          aria-label="Menü einklappen"
          aria-expanded
          title="Menü einklappen"
          className="absolute right-0 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-green"
        >
          <PanelLeftClose className="h-[18px] w-[18px]" />
        </button>
      </div>
    );
  }

  /** Fuß der Leiste: Zahnrad + Konto. Popover öffnet nach oben. */
  function renderSidebarFoot(rail: boolean) {
    const settingsActive = pathname.startsWith(SETTINGS_HREF);
    return (
      <div className="mt-2 border-t border-gray-100 pt-2">
        {showSettings ? (
          <Link
            href={SETTINGS_HREF}
            onClick={closeAll}
            title={rail ? "Einstellungen" : undefined}
            aria-current={settingsActive ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg py-2 text-sm transition ${
              rail ? "justify-center px-2" : "px-3"
            } ${
              settingsActive
                ? "bg-brand-orange-light font-semibold text-brand-orange-dark"
                : "text-gray-600 hover:bg-gray-100 hover:text-brand-green"
            }`}
          >
            <Settings
              className={`h-[18px] w-[18px] shrink-0 ${
                settingsActive ? "text-brand-orange-dark" : "text-gray-400"
              }`}
            />
            {rail ? <span className="sr-only">Einstellungen</span> : <span>Einstellungen</span>}
          </Link>
        ) : null}

        <div className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((v) => !v)}
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            title={rail ? user.name : undefined}
            className={`mt-1 flex w-full items-center gap-2.5 rounded-lg py-2 text-sm text-gray-700 transition hover:bg-gray-100 ${
              rail ? "justify-center px-2" : "px-2"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange-light text-[11px] font-bold text-brand-orange-dark">
              {initialsOf(user.name)}
            </span>
            {rail ? (
              <span className="sr-only">{user.name}</span>
            ) : (
              <span className="min-w-0 flex-1 truncate text-left font-medium">{user.name}</span>
            )}
          </button>

          {accountOpen ? (
            <>
              <button
                type="button"
                aria-label="Menü schließen"
                onClick={() => setAccountOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute bottom-full left-0 z-50 mb-1 w-56 animate-slide-down rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl">
                <div className="border-b border-gray-100 px-3 pb-2 pt-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {orgName} · {user.roleLabel}
                  </p>
                </div>
                <Link
                  href="/konto"
                  onClick={closeAll}
                  className="mt-0.5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  <UserRound className="h-4 w-4 shrink-0 text-gray-400" />
                  Konto
                </Link>
                {showPlattform ? (
                  <Link
                    href="/plattform"
                    onClick={closeAll}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0 text-gray-400" />
                    Plattform
                  </Link>
                ) : null}
                <form action={logout} className="mt-0.5 border-t border-gray-100 pt-0.5">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                  >
                    <LogOut className="h-4 w-4 shrink-0 text-gray-400" />
                    Abmelden
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-app-shell=""
      className={`md:grid md:gap-6 ${
        collapsed ? "md:grid-cols-[3.75rem_1fr]" : "md:grid-cols-[15rem_1fr]"
      }`}
    >
      {/* Mobil: schlanke Leiste mit Burger, Logo und Konto-Kürzel. */}
      <div className="mb-4 flex items-center gap-3 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/95 px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm"
          aria-label="Menü öffnen"
        >
          <Menu className="h-[18px] w-[18px]" />
          Menü
        </button>
        <Link href="/dashboard" className="shrink-0">
          <OrgLogo src={logoUrl} alt={orgName} className="h-8 w-auto" />
        </Link>
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Suchen"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-gray-500 shadow-sm"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
        <Link
          href="/konto"
          aria-label="Konto"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[11px] font-bold text-brand-orange-dark shadow-sm"
        >
          {initialsOf(user.name)}
        </Link>
      </div>

      {/* Desktop-Leiste. Der Offset entspricht dem Innenabstand von <main>, damit
          sie sofort einrastet und beim Scrollen nicht nachrutscht. */}
      <aside className="hidden min-w-0 md:block">
        {/* Nur die Navigation scrollt – Logo und Konto bleiben fest verankert.
            Läge das Scrollen auf dem ganzen Block, dürften Kopf und Fuß
            mitschrumpfen und würden sich bei knapper Höhe überlappen. */}
        <div
          className={`sticky top-8 flex max-h-[calc(100vh-4rem)] flex-col p-2 ${cardSurfaceClass}`}
        >
          <div className="shrink-0">{renderSidebarHead(collapsed)}</div>
          <div className="shrink-0">{renderSearch(collapsed)}</div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {renderNav(collapsed)}
          </div>
          <div className="shrink-0">{renderSidebarFoot(collapsed)}</div>
        </div>
      </aside>

      {/* Mobil: Off-Canvas + Scrim (dort immer mit Beschriftung). */}
      {drawerOpen ? (
        <>
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/40 md:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-xs animate-drawer-in flex-col rounded-r-2xl border-r border-gray-200 bg-white p-2 shadow-2xl motion-reduce:animate-none md:hidden">
            <div className="relative flex shrink-0 items-center justify-center px-1 pb-2 pt-1">
              <OrgLogo
                src={logoUrl}
                alt={orgName}
                className="h-12 w-auto max-w-[9.5rem] object-contain"
              />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Schließen"
                className="absolute right-0 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="shrink-0">{renderSearch(false)}</div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {renderNav(false)}
            </div>
            <div className="shrink-0">{renderSidebarFoot(false)}</div>
          </aside>
        </>
      ) : null}

      {/* Inhalt – jede Seite bringt ihren eigenen PageTitle mit. */}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
