"use client";

import Link from "next/link";

const STEPS = [
  { label: "Stammdaten", slug: "stammdaten" },
  { label: "Räume", slug: "raeume" },
  { label: "Checkliste", slug: "checkliste" },
  { label: "Zähler", slug: "zaehler" },
  { label: "Unterschriften", slug: "unterschriften" },
  { label: "Abschluss", slug: "abschluss" },
];

export function StepHeader({
  currentStep,
  title,
  backHref,
  handoverId,
}: {
  currentStep: number;
  title: string;
  backHref: string;
  /** Wenn gesetzt, sind die Schritte im Header direkt anklickbar. */
  handoverId?: string;
}) {
  return (
    <div className="sticky top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/95 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur sm:px-4">
          <Link
            href={backHref}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Zurück</span>
          </Link>

          <span className="hidden h-4 w-px bg-gray-200 sm:block" />

          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
            {title}
          </span>

          <div className="ml-auto hidden shrink-0 items-center gap-1 md:flex">
            {STEPS.map((step, i) => {
              const n = i + 1;
              const active = n === currentStep;
              const done = n < currentStep;
              const inner = (
                <>
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      active
                        ? "bg-brand-orange text-brand-green-dark scale-110"
                        : done
                        ? "bg-brand-green text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {done ? "✓" : n}
                  </div>
                  <span
                    className={`hidden text-[11px] font-medium lg:inline ${
                      active ? "text-brand-orange-dark" : done ? "text-brand-green" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </>
              );
              return (
                <div key={step.slug} className="flex items-center gap-1">
                  {handoverId ? (
                    <Link
                      href={`/uebergabe/${handoverId}/${step.slug}`}
                      className="flex items-center gap-1 rounded-lg px-1 py-0.5 transition hover:bg-gray-100"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-1">{inner}</div>
                  )}
                  {i < STEPS.length - 1 && (
                    <div className={`mx-1 h-px w-4 ${done ? "bg-brand-green" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Kompaktes, anklickbares Schritt-Menü (bis Labels ab lg Platz haben) */}
          <div className="ml-auto shrink-0 md:hidden">
            {handoverId ? (
              <details className="relative">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full bg-brand-orange-light px-2.5 py-1 text-xs font-semibold text-brand-orange-dark">
                  {currentStep}/{STEPS.length}
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                  {STEPS.map((step, i) => {
                    const n = i + 1;
                    const active = n === currentStep;
                    return (
                      <Link
                        key={step.slug}
                        href={`/uebergabe/${handoverId}/${step.slug}`}
                        className={`flex items-center gap-2 px-3 py-2 text-sm transition hover:bg-gray-50 ${
                          active ? "font-semibold text-brand-orange-dark" : "text-gray-700"
                        }`}
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-500">
                          {n}
                        </span>
                        {step.label}
                      </Link>
                    );
                  })}
                </div>
              </details>
            ) : (
              <span className="rounded-full bg-brand-orange-light px-2 py-0.5 text-xs font-semibold text-brand-orange-dark">
                {currentStep}/{STEPS.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
