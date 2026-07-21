"use client";

// Foto-Hero für die Marketing-Seiten: echtes Foto statt UI-Mockup, mit
// langsamem Ken-Burns-Zoom (CSS, startet beim Sichtbarwerden über
// `.mk-reveal`/`.mk-anim`) und einem Scroll-Parallax-Versatz (JS, direkt im
// Scroll-Handler berechnet). Eine schwebende Kennzahl-Karte legt die Brücke
// zum Produkt. `preload` ersetzt in dieser Next.js-Version das alte
// `priority` (siehe node_modules/next/dist/docs) – nur für den obersten,
// sofort sichtbaren Hero setzen.
import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";

export function PhotoHero({
  src,
  alt,
  preload = false,
  badge,
}: {
  src: string;
  alt: string;
  preload?: boolean;
  // Bereits gerendertes Icon-Element (nicht die Komponentenfunktion!) –
  // Server Components dürfen Funktionsreferenzen nicht an "use client"
  // weiterreichen, ein fertiges ReactNode dagegen schon.
  badge?: { icon: ReactNode; text: string };
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Parallaxe ist reine Bewegung ohne Informationswert – bei reduzierter
    // Bewegung ganz weglassen (die Ken-Burns-Animation bremst bereits die
    // globale `prefers-reduced-motion`-Regel in globals.css aus).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // Fortschritt: -1 (Foto unterhalb des Viewports) … 0 (mittig) … 1 (darüber)
      const p = (rect.top + rect.height / 2 - vh / 2) / vh;
      setOffset(Math.max(-1, Math.min(1, p)) * 22);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-e3">
        {/* Äußere Ebene: NUR der JS-Scroll-Parallax (inline transform). Eine
            CSS-Animation auf demselben Element würde dieselbe Eigenschaft
            überschreiben und die Parallaxe stumm stillegen – deshalb zwei
            verschachtelte Ebenen statt einer. */}
        <div className="absolute inset-0" style={{ transform: `translateY(${offset}px)` }}>
          {/* Innere Ebene: NUR der Ken-Burns-Zoom (CSS-Keyframe). */}
          <div
            className="mk-anim absolute"
            style={{
              // Prozentualer Puffer (statt fixer px) – reicht bei jeder
              // gerenderten Breite für den 1.09er Zoom, ohne Kanten zu zeigen.
              inset: "-6%",
              animation: "mkKenBurns 16s ease-in-out infinite alternate",
            }}
          >
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              preload={preload}
              className="object-cover"
            />
          </div>
        </div>
        {/* dezenter Verlauf unten für Kontrast/Tiefe */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-green-dark/25 via-transparent to-transparent" />
      </div>
      {badge ? (
        <div
          className="mk-anim absolute -bottom-5 left-5 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-800 shadow-e2"
          style={{ animation: "mkPopIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both", animationDelay: "400ms" }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-orange-light">
            {badge.icon}
          </span>
          {badge.text}
        </div>
      ) : null}
    </div>
  );
}
