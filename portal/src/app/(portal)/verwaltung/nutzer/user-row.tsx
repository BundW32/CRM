"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Kompakte, aufklappbare Nutzerzeile. Die Kopfzeile zeigt nur das Nötigste
 * (Name, Rolle, Status). Erst beim Aufklappen erscheinen die Detail-/Einstellungs-
 * formulare (children) – so bleibt die Liste auch bei vielen Nutzern übersichtlich.
 */
export function UserRow({
  name,
  salutation,
  roleBadge,
  statusBadges,
  subtitle,
  children,
  initiallyOpen = false,
}: {
  name: string;
  salutation?: string | null;
  roleBadge: ReactNode;
  statusBadges?: ReactNode;
  subtitle: ReactNode;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <li className="transition-colors">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <svg
          className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              {salutation ? `${salutation} ` : ""}
              {name}
            </span>
            {roleBadge}
            {statusBadges}
          </span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">{subtitle}</span>
        </span>
      </button>

      {open ? (
        <div className="animate-page-in space-y-2 border-t border-gray-100 bg-gray-50/60 px-4 py-3">
          {children}
        </div>
      ) : null}
    </li>
  );
}
