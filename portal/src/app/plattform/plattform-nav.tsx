"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/plattform", label: "Übersicht" },
  { href: "/plattform/organisationen", label: "Verwaltungen" },
  { href: "/plattform/anfragen", label: "Anfragen" },
  { href: "/plattform/rechnungen", label: "Rechnungen" },
  { href: "/plattform/statistik", label: "Auswertungen" },
  { href: "/plattform/analytics", label: "Analytics" },
  { href: "/plattform/audit", label: "Audit-Log" },
];

// Navigation des Betreiber-Bereichs. Bewusst grüner Aktiv-Akzent (statt des
// orangen im Mandanten-Portal) – signalisiert den internen Bereich, bleibt aber
// markenkonform. Auf schmalen Screens horizontal scrollbar statt Umbruch.
export function PlattformNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/plattform" ? pathname === href : pathname.startsWith(href);

  return (
    <nav className="min-w-0 flex-1">
      <ul className="flex items-center gap-1 overflow-x-auto">
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand-green text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-brand-green"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
