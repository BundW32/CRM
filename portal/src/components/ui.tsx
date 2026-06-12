import type { ReactNode } from "react";
import type { TicketStatus } from "@/generated/prisma/client";
import { ticketStatusLabels, ticketStatusStyles } from "@/lib/labels";

export const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export const buttonClass =
  "inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";

export const buttonSecondaryClass =
  "inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50";

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold text-gray-900">{children}</h1>
      {action}
    </div>
  );
}

export function Card({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {title ? (
        <h2 className="mb-4 text-base font-semibold text-gray-900">{title}</h2>
      ) : null}
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ticketStatusStyles[status]}`}
    >
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
