import Link from "next/link";
import type { ReactNode } from "react";
import { CountUp } from "@/components/count-up";
import { Badge } from "@/components/data-display";

// Einheitliche Kennzahl-Kachel – ersetzt die zuvor doppelten KPI-Styles im
// Dashboard und in den Objekt-Statistiken. Numerische Werte zählen animiert hoch.
export function StatTile({
  label,
  value,
  icon,
  href,
  delta,
}: {
  label: string;
  value: number | string;
  icon?: ReactNode;
  href?: string;
  /** Optionaler Trend-Hinweis, z. B. „+3". Nur setzen, wenn echte Daten vorliegen. */
  delta?: string;
}) {
  const display = typeof value === "number" ? <CountUp value={value} /> : value;

  const inner = (
    <>
      {icon ? (
        <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-orange-light text-brand-orange-dark">
          {icon}
        </span>
      ) : null}
      {delta ? (
        <Badge tone="success" className="absolute top-3 right-3">
          {delta}
        </Badge>
      ) : null}
      <p className="text-3xl font-bold tracking-tight text-brand-green tabular-nums">{display}</p>
      <p className="mt-1 text-xs font-medium text-gray-500">{label}</p>
    </>
  );

  const base =
    "relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-e1 transition-all";

  return href ? (
    <Link
      href={href}
      className={`${base} hover:-translate-y-0.5 hover:border-brand-orange/40 hover:shadow-e2`}
    >
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}
