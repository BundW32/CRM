// Gemeinsamer Rahmen aller Analytics-Seiten: Unter-Navigation, Titel und
// Zeitraumfilter. Bewusst eine SERVER-Komponente, die jede Seite selbst mit
// ihrem geparsten Zeitraum aufruft — ein Layout käme nicht an die
// Suchparameter heran, und ein Client-Nav mit useSearchParams bräuchte eine
// Suspense-Grenze für etwas, das hier statisch aus Props ableitbar ist. Die
// Links der Navigation tragen die Zeitraumwahl weiter, damit ein Wechsel
// zwischen den Ansichten die Auswahl nicht verwirft.

import Link from "next/link";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/ui";
import { type Zeitraum, zeitraumQuery } from "@/lib/analytics/zeitraum";
import { ZeitraumFilter } from "./zeitraum-filter";

export const ANALYTICS_SEITEN = [
  { href: "/plattform/analytics", label: "Übersicht" },
  { href: "/plattform/analytics/traffic", label: "Traffic" },
  { href: "/plattform/analytics/seo", label: "SEO" },
  { href: "/plattform/analytics/ads", label: "Ads" },
  { href: "/plattform/analytics/abos", label: "Abos" },
  { href: "/plattform/analytics/newsletter", label: "Newsletter" },
  { href: "/plattform/analytics/system", label: "System" },
] as const;

export function AnalyticsShell({
  titel,
  pfad,
  zeitraum,
  action,
  /** System braucht keinen Zeitraum — dort zählt das Protokoll, nicht das Fenster. */
  ohneZeitraumFilter = false,
  children,
}: {
  titel: ReactNode;
  pfad: string;
  zeitraum: Zeitraum;
  action?: ReactNode;
  ohneZeitraumFilter?: boolean;
  children: ReactNode;
}) {
  const query = zeitraumQuery(zeitraum).toString();

  return (
    <>
      <PageTitle action={action}>{titel}</PageTitle>

      <nav className="mb-4 overflow-x-auto rounded-xl border border-white/10 bg-white/95 px-1.5 py-1.5 shadow-sm">
        <ul className="flex items-center gap-1">
          {ANALYTICS_SEITEN.map((s) => {
            const aktiv = s.href === pfad;
            return (
              <li key={s.href}>
                <Link
                  href={query ? `${s.href}?${query}` : s.href}
                  aria-current={aktiv ? "page" : undefined}
                  className={`block rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                    aktiv
                      ? "bg-brand-green text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-green"
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {ohneZeitraumFilter ? null : <ZeitraumFilter zeitraum={zeitraum} pfad={pfad} />}

      {children}
    </>
  );
}
