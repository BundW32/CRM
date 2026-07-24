"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
  PieChart,
  Plug,
  Receipt,
  ShieldCheck,
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

  const nav = (
    <nav aria-label="Verwaltungsbereiche" className="flex flex-col gap-1">
      {groups.map((group) => (
        <div key={group.label} className="mb-1">
          <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-gray-400 first:pt-1">
            {group.label}
          </p>
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
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-brand-orange-light font-semibold text-brand-orange-dark"
                    : "text-gray-600 hover:bg-gray-100 hover:text-brand-green"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 ${
                    active ? "text-brand-orange-dark" : "text-gray-400"
                  }`}
                />
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
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="md:grid md:grid-cols-[240px_1fr] md:gap-6">
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

      {/* Desktop-Sidebar (sticky) */}
      <aside className="hidden md:block">
        <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
          {nav}
        </div>
      </aside>

      {/* Mobil: Off-Canvas + Scrim */}
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
            {nav}
          </aside>
        </>
      ) : null}

      {/* Detailbereich – die jeweilige Unterseite bringt ihren eigenen PageTitle mit. */}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
