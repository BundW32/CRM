import type { ReactNode } from "react";
import { VerwaltungChrome } from "@/components/verwaltung-chrome";

// Beschlüsse gehören zum Verwaltung-Menü, liegen als geteilte Route aber außerhalb
// von /verwaltung (Eigentümer nutzen dieselbe Seite). Die Hülle entscheidet anhand
// der Rolle, ob die Sidebar erscheint – für Eigentümer bleibt die Ansicht unverändert.
export default function BeschluesseLayout({ children }: { children: ReactNode }) {
  return <VerwaltungChrome>{children}</VerwaltungChrome>;
}
