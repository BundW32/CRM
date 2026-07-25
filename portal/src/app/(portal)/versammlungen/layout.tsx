import type { ReactNode } from "react";
import { VerwaltungChrome } from "@/components/verwaltung-chrome";

// Siehe beschluesse/layout.tsx – geteilte Route, Sidebar nur für professionelle Verwalter.
export default function VersammlungenLayout({ children }: { children: ReactNode }) {
  return <VerwaltungChrome>{children}</VerwaltungChrome>;
}
