"use client";

import Link from "next/link";

const STEPS = [
  "Stammdaten",
  "Räume",
  "Checkliste",
  "Zähler",
  "Unterschriften",
  "Abschluss",
];

export function StepHeader({
  currentStep,
  title,
  backHref,
}: {
  currentStep: number;
  title: string;
  backHref: string;
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

          <span className="text-sm font-semibold text-gray-900">{title}</span>

          <div className="ml-auto hidden items-center gap-1 sm:flex">
            {STEPS.map((step, i) => {
              const n = i + 1;
              const active = n === currentStep;
              const done = n < currentStep;
              return (
                <div key={step} className="flex items-center gap-1">
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
                    className={`text-[11px] font-medium ${
                      active ? "text-brand-orange-dark" : done ? "text-brand-green" : "text-gray-400"
                    }`}
                  >
                    {step}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className={`mx-1 h-px w-4 ${done ? "bg-brand-green" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: just step counter */}
          <div className="ml-auto sm:hidden">
            <span className="rounded-full bg-brand-orange-light px-2 py-0.5 text-xs font-semibold text-brand-orange-dark">
              {currentStep}/{STEPS.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
