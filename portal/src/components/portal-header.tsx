"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/login/actions";
import { BwLogoCompact } from "@/components/logo";
import { NavLink } from "@/components/nav";

type NavItem = { href: string; label: string };

export function PortalHeader({
  nav,
  userName,
  roleLabel,
}: {
  nav: ReadonlyArray<NavItem>;
  userName: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  }

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="relative mx-auto max-w-6xl">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/95 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur sm:px-4">
          <Link href="/dashboard" className="shrink-0" onClick={() => setOpen(false)}>
            <BwLogoCompact />
          </Link>

          {/* Desktop-Navigation */}
          <nav className="hidden min-w-0 flex-1 overflow-x-auto md:block">
            <ul className="flex items-center gap-1">
              {nav.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </ul>
          </nav>

          {/* Platzhalter, schiebt die Buttons auf Mobil nach rechts */}
          <div className="flex-1 md:hidden" />

          {/* Desktop: Nutzer + Abmelden */}
          <div className="hidden shrink-0 items-center gap-3 text-sm md:flex">
            <span className="text-gray-600">
              {userName}
              <span className="ml-2 rounded-full bg-brand-orange-light px-2 py-0.5 text-xs font-medium text-brand-orange-dark">
                {roleLabel}
              </span>
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Abmelden
              </button>
            </form>
          </div>

          {/* Mobil: Menü-Button */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menü"
            aria-expanded={open}
            className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-50 md:hidden"
          >
            {open ? (
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
        {open ? (
          <>
            <button
              type="button"
              aria-label="Menü schließen"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30 cursor-default md:hidden"
            />
            <div className="absolute inset-x-0 top-full z-40 mt-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl md:hidden">
              <p className="px-3 py-2 text-xs text-gray-500">
                Angemeldet als <span className="font-medium text-gray-700">{userName}</span> ·{" "}
                {roleLabel}
              </p>
              <ul className="flex flex-col gap-0.5">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        isActive(item.href)
                          ? "bg-brand-orange-light text-brand-orange-dark"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
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
