import type { ReactNode } from "react";
import { VerwaltungChrome } from "@/components/verwaltung-chrome";

// Siehe beschluesse/layout.tsx – geteilte Route (auch Mieter/Eigentümer),
// Sidebar nur für professionelle Verwalter.
export default function ZaehlerLayout({ children }: { children: ReactNode }) {
  return <VerwaltungChrome>{children}</VerwaltungChrome>;
}
