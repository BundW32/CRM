"use client";

// Mobil-Menü der öffentlichen Seiten: Hamburger statt eines zweizeiligen
// Headers. Das horizontale Scroll-Band davor hatte drei Probleme auf einmal:
// „So funktioniert's" lag bei 390 px außerhalb des Bildschirms, die Tap-Höhe
// lag mit ~36 px unter den 44 px der Plattform-Richtlinien, und zusammen mit
// der Logo-Zeile fraß der Header dauerhaft ~90 px des Viewports.
//
// Das Overlay deckt die ganze Fläche, jede Zeile ist ≥ 48 px hoch, „Anmelden"
// und „Registrieren" stehen als große Ziele am Ende. Esc und jeder Klick auf
// ein Ziel schließen; solange es offen ist, scrollt die Seite dahinter nicht.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { wpButtonClass } from "./brand";
import { Wordmark } from "./wordmark";

export function MobileMenu({
  items,
  registrierenHref = "/registrieren",
}: {
  items: readonly { href: string; label: string }[];
  /** Ziel des Starten-Knopfs – mit Aktionscode, solange die Aktion läuft. */
  registrierenHref?: string;
}) {
  const [offen, setOffen] = useState(false);
  const pfad = usePathname();

  useEffect(() => {
    if (!offen) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    window.addEventListener("keydown", beiTaste);
    return () => {
      document.body.style.overflow = vorher;
      window.removeEventListener("keydown", beiTaste);
    };
  }, [offen]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOffen(true)}
        aria-expanded={offen}
        aria-label="Menü öffnen"
        className="flex h-11 w-11 items-center justify-center rounded-xl text-wp-ink transition-colors hover:bg-wp-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wp-accent-ink"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Als Portal an <body>: Der Header trägt `backdrop-blur`, und ein
          Backdrop-Filter macht sein Element zum Bezugsrahmen für `fixed` —
          im Header montiert wäre das Overlay nur headerhoch und läge
          durchsichtig über der Seite. Genau so sah der erste Wurf aus. */}
      {offen ? (
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-0 z-50 flex flex-col bg-[#faf8f4]"
        >
          <div className="flex items-center justify-between border-b border-wp-ink/10 px-5 py-3">
            <Wordmark className="text-lg" />
            <button
              type="button"
              onClick={() => setOffen(false)}
              aria-label="Menü schließen"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-wp-ink transition-colors hover:bg-wp-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wp-accent-ink"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav aria-label="Hauptnavigation" className="flex-1 overflow-y-auto px-5 py-4">
            <ul>
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOffen(false)}
                    aria-current={pfad === item.href ? "page" : undefined}
                    className={`block border-b border-wp-ink/10 py-3.5 text-lg ${
                      pfad === item.href
                        ? "font-semibold text-wp-accent-ink"
                        : "font-medium text-wp-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div
            className="space-y-3 border-t border-wp-ink/10 px-5 py-5"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <Link
              href={registrierenHref}
              onClick={() => setOffen(false)}
              className={`${wpButtonClass} w-full py-3 text-base`}
            >
              Kostenlos starten
            </Link>
            <Link
              href="/login"
              onClick={() => setOffen(false)}
              className="block min-h-11 py-2.5 text-center text-base font-semibold text-wp-ink underline decoration-wp-ink/30 underline-offset-4"
            >
              Anmelden
            </Link>
          </div>
        </div>,
        document.body,
        )
      ) : null}
    </div>
  );
}
