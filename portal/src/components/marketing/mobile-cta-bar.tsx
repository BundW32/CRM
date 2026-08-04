"use client";

// Feste CTA-Leiste am unteren Rand — nur auf Mobil. Die Startseite ist auch
// nach der Kürzung mehrere Bildschirmhöhen lang; ohne diese Leiste hätte ein
// Besucher zwischen Hero und Abschluss keinen dauerhaft erreichbaren Weg zur
// Registrierung.
//
// Verhalten: erscheint ab ~25 % Scrolltiefe, verschwindet, sobald der
// Abschluss-Block (id="schluss-cta") im Bild ist — zwei Registrieren-Knöpfe
// übereinander sähen kaputt aus. `env(safe-area-inset-bottom)` hält den Knopf
// über dem Home-Indikator des iPhones.
import { useEffect, useState } from "react";
import Link from "next/link";
import { wpButtonClass } from "./brand";

export function MobileCtaBar() {
  const [sichtbar, setSichtbar] = useState(false);

  useEffect(() => {
    let schlussImBild = false;

    const rechne = () => {
      const gesamt = document.documentElement.scrollHeight - window.innerHeight;
      const tiefe = gesamt > 0 ? window.scrollY / gesamt : 0;
      setSichtbar(tiefe > 0.25 && !schlussImBild);
    };

    const schluss = document.getElementById("schluss-cta");
    const io = schluss
      ? new IntersectionObserver(
          (eintraege) => {
            schlussImBild = eintraege.some((e) => e.isIntersecting);
            rechne();
          },
          { threshold: 0.1 },
        )
      : null;
    if (schluss && io) io.observe(schluss);

    window.addEventListener("scroll", rechne, { passive: true });
    window.addEventListener("resize", rechne);
    rechne();
    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", rechne);
      window.removeEventListener("resize", rechne);
    };
  }, []);

  return (
    <div
      aria-hidden={!sichtbar}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-wp-ink/10 bg-white/95 px-4 pt-3 backdrop-blur-md transition-transform duration-300 lg:hidden ${
        sichtbar ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <Link
        href="/registrieren"
        tabIndex={sichtbar ? 0 : -1}
        className={`${wpButtonClass} w-full py-3 text-base`}
      >
        Kostenlos starten
      </Link>
    </div>
  );
}
