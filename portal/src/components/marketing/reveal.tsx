"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Blendet Inhalte beim Hereinscrollen ein: setzt `is-visible` auf den Wrapper,
// sobald er in den Viewport kommt (einmalig). Das eigentliche Ein- und
// Ausblenden übernimmt CSS (`.mk-reveal` in globals.css) – inklusive Start der
// pausierten Kind-Animationen (`.mk-anim`).
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Ohne IntersectionObserver (sehr alte Browser): sofort zeigen.
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("is-visible");
            io.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`mk-reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
