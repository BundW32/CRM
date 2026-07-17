"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardList,
  FileText,
  Gauge,
  Gavel,
  Info,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  Users,
  UserRound,
  Wallet,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import { OrgLogo } from "@/components/logo";
import { NavLink } from "@/components/nav";

type NavItem = { href: string; label: string };

// Icon je Navigationsziel – im Mobil-Menü genutzt (verbessert die Scanbarkeit);
// die Desktop-Leiste bleibt bewusst textbasiert und schlank.
const navIcons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/vorgaenge": ClipboardList,
  "/beschluesse": Gavel,
  "/versammlungen": Users,
  "/antraege": FileText,
  "/gemeinschaft": Users,
  "/finanzen": Wallet,
  "/nachrichten": MessageSquare,
  "/infos": Info,
  "/zaehler": Gauge,
  "/verwaltung": Building2,
  "/plattform": LayoutGrid,
  "/konto": UserRound,
};

function NavIcon({ href }: { href: string }) {
  const Icon = navIcons[href];
  return Icon ? <Icon className="h-[18px] w-[18px] shrink-0" /> : null;
}

export function PortalHeader({
  nav,
  userName,
  roleLabel,
  logoUrl,
  orgName,
}: {
  nav: ReadonlyArray<NavItem>;
  userName: string;
  roleLabel: string;
  logoUrl: string;
  orgName: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  }

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="relative mx-auto max-w-6xl">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/95 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur sm:px-4">
          <Link href="/dashboard" className="shrink-0" onClick={() => setMenuOpen(false)}>
            <OrgLogo src={logoUrl} alt={orgName} />
          </Link>

          {/* Desktop-Navigation */}
          <nav className="hidden min-w-0 flex-1 md:block">
            <ul className="flex items-center gap-1">
              {nav.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </ul>
          </nav>

          {/* Platzhalter für Mobil */}
          <div className="flex-1 md:hidden" />

          {/* Desktop: Nutzer-Menü-Button */}
          <div className="relative hidden shrink-0 md:block">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              {userName}
              <span className="rounded-full bg-brand-orange-light px-2 py-0.5 text-xs font-medium text-brand-orange-dark">
                {roleLabel}
              </span>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {userMenuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Menü schließen"
                  onClick={() => setUserMenuOpen(false)}
                  className="fixed inset-0 z-30 cursor-default"
                />
                <div className="absolute right-0 top-full z-40 mt-2 w-44 animate-slide-down rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl">
                  <Link
                    href="/konto"
                    onClick={() => setUserMenuOpen(false)}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive("/konto")
                        ? "bg-brand-orange-light text-brand-orange-dark"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Konto
                  </Link>
                  <form action={logout} className="mt-0.5 border-t border-gray-100 pt-0.5">
                    <button
                      type="submit"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Abmelden
                    </button>
                  </form>
                </div>
              </>
            ) : null}
          </div>

          {/* Mobil: Menü-Button */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menü"
            aria-expanded={menuOpen}
            className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-50 md:hidden"
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobil: Dropdown-Menü */}
        {menuOpen ? (
          <>
            <button
              type="button"
              aria-label="Menü schließen"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-30 cursor-default md:hidden"
            />
            <div className="absolute inset-x-0 top-full z-40 mt-2 animate-slide-down rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl md:hidden">
              <p className="px-3 py-2 text-xs text-gray-500">
                Angemeldet als <span className="font-medium text-gray-700">{userName}</span> ·{" "}
                {roleLabel}
              </p>
              <ul className="flex flex-col gap-0.5">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        isActive(item.href)
                          ? "bg-brand-orange-light text-brand-orange-dark"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <NavIcon href={item.href} />
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/konto"
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      isActive("/konto")
                        ? "bg-brand-orange-light text-brand-orange-dark"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <NavIcon href="/konto" />
                    Konto
                  </Link>
                </li>
              </ul>
              <form action={logout} className="mt-1 border-t border-gray-100 pt-1">
                <button
                  type="submit"
                  className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Abmelden
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}
