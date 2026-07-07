import type { ReactNode } from "react";
import type { TicketStatus } from "@/generated/prisma/client";
import { ticketStatusLabels, ticketStatusStyles } from "@/lib/labels";

export const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition duration-150 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30";

// Primäraktion: Orange mit dunkler Schrift – wie die CTAs auf der Website (gut lesbar)
export const buttonClass =
  "inline-flex items-center justify-center rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-green-dark shadow-sm transition-all hover:bg-brand-orange-dark active:scale-95 active:shadow-none disabled:opacity-50 disabled:pointer-events-none";

// Alias – bleibt aus Kompatibilitätsgründen erhalten
export const buttonOrangeClass = buttonClass;

// Sekundär (auf hellen Flächen)
export const buttonSecondaryClass =
  "inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-95 active:shadow-none disabled:opacity-50 disabled:pointer-events-none";

// Outline-Variante für dunkle Flächen (oranger Rand, wie „Potenzial Analyse")
export const buttonOutlineClass =
  "inline-flex items-center justify-center rounded-lg border border-brand-orange/60 bg-transparent px-4 py-2 text-sm font-semibold text-brand-orange transition-all hover:bg-brand-orange/10 active:scale-95 active:shadow-none disabled:opacity-50 disabled:pointer-events-none";

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {children}
      </h1>
      {action}
    </div>
  );
}

export function Card({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {title ? (
        <h2 className="mb-4 text-base font-semibold text-gray-900">{title}</h2>
      ) : null}
      {children}
    </div>
  );
}

// Dunkle Karte – für Akzent-/Hero-Bereiche auf hellem Grund (Website-Wechselspiel)
export function DarkCard({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-shell-2 p-5 shadow-lg">
      {title ? (
        <h2 className="mb-4 text-base font-semibold text-white">{title}</h2>
      ) : null}
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${ticketStatusStyles[status]}`}
    >
      {status === "NEU" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {ticketStatusLabels[status]}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
      {children}
    </p>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
