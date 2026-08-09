"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export function PropertyRow({
  name,
  address,
  managementTypeBadge,
  unitCount,
  stellplatzCount = 0,
  imageUrl,
  children,
}: {
  name: string;
  address: string;
  managementTypeBadge: ReactNode;
  /** Wohn-/Gewerbeeinheiten — Stellplätze zählen hier nicht mit. */
  unitCount: number;
  stellplatzCount?: number;
  imageUrl?: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

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
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
          />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{name}</span>
            {managementTypeBadge}
            <span className="text-xs text-gray-400">
              {unitCount} Einheit{unitCount !== 1 ? "en" : ""}
              {stellplatzCount > 0
                ? ` · ${stellplatzCount} ${stellplatzCount === 1 ? "Stellplatz" : "Stellplätze"}`
                : ""}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">{address}</span>
        </span>
      </button>

      {open ? (
        <div className="animate-page-in border-t border-gray-100 bg-gray-50/60 px-4 py-3">
          {children}
        </div>
      ) : null}
    </li>
  );
}
