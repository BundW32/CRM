"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isVerwaltungRoute } from "@/lib/verwaltung-nav";

/**
 * Inhaltsbereich des Portals.
 *
 * Im Verwaltungsbereich (professioneller Verwalter) nutzt die Oberfläche die volle
 * Bildschirmbreite – dort stehen Listen und Tabellen, die von Platz profitieren.
 * Überall sonst bleibt die zentrierte, angenehm lesbare Spalte: Mieter- und
 * Eigentümer-Ansichten bestehen überwiegend aus Fließtext.
 *
 * `wideEnabled` kommt vom Server (nur professionelle Verwalter), damit Eigentümer
 * auf denselben Routen (Beschlüsse, Versammlungen, Zähler) die gewohnte Breite behalten.
 */
export function PortalMain({
  wideEnabled,
  children,
}: {
  wideEnabled: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const wide = wideEnabled && isVerwaltungRoute(pathname);

  return (
    <main
      className={`w-full flex-1 px-4 py-8 ${wide ? "mx-auto max-w-[120rem]" : "mx-auto max-w-6xl"}`}
    >
      {children}
    </main>
  );
}
