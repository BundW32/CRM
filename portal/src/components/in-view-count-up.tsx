"use client";

import { useEffect, useRef, useState } from "react";
import { CountUp } from "@/components/count-up";

// Startet die Zähler-Animation erst, wenn die Kennzahl im Viewport sichtbar wird
// (statt sofort beim Rendern) – passend zum Scroll-Reveal der übrigen Sektionen.
export function InViewCountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <span ref={ref}>{active ? <CountUp value={value} /> : 0}</span>;
}
