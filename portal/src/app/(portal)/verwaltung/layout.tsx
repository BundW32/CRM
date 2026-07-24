import type { ReactNode } from "react";
import { VerwaltungChrome } from "@/components/verwaltung-chrome";

export const dynamic = "force-dynamic";

export default function VerwaltungLayout({ children }: { children: ReactNode }) {
  return <VerwaltungChrome>{children}</VerwaltungChrome>;
}
