"use client";

import { useEffect, useRef } from "react";

// Sanfter Parallax-Effekt für den Hero-Hintergrund: reagiert auf Scroll- und
// Mausposition, komplett CSS-Transform-basiert (kein Layout-Trashing) und per
// rAF gedrosselt. Respektiert prefers-reduced-motion.
export function MarketingHeroBackdrop() {
  const layerA = useRef<HTMLDivElement>(null);
  const layerB = useRef<HTMLDivElement>(null);
  const layerC = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let raf: number | null = null;
    let targetX = 0;
    let targetY = 0;
    let scrollY = 0;

    function apply() {
      raf = null;
      if (layerA.current) {
        layerA.current.style.transform = `translate3d(${targetX * 18}px, ${targetY * 18 + scrollY * 0.12}px, 0)`;
      }
      if (layerB.current) {
        layerB.current.style.transform = `translate3d(${targetX * -24}px, ${targetY * -24 + scrollY * 0.2}px, 0)`;
      }
      if (layerC.current) {
        layerC.current.style.transform = `translate3d(${targetX * 12}px, ${targetY * 12 + scrollY * 0.06}px, 0)`;
      }
    }

    function schedule() {
      if (raf === null) raf = requestAnimationFrame(apply);
    }

    function onMouseMove(e: MouseEvent) {
      targetX = e.clientX / window.innerWidth - 0.5;
      targetY = e.clientY / window.innerHeight - 0.5;
      schedule();
    }

    function onScroll() {
      scrollY = window.scrollY;
      schedule();
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        ref={layerA}
        className="absolute -top-24 right-[-10%] h-[36rem] w-[36rem] rounded-full bg-brand-orange/25 blur-[110px] transition-transform duration-300"
      />
      <div
        ref={layerB}
        className="absolute top-1/3 -left-32 h-[30rem] w-[30rem] rounded-full bg-brand-green-light/40 blur-[100px] transition-transform duration-300"
      />
      <div
        ref={layerC}
        className="absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-brand-orange/15 blur-[120px] transition-transform duration-300"
      />
      {/* Feines Rasternetz, gibt der Fläche Tiefe wie ein Blueprint/Datacenter-Grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 20%, black 40%, transparent 100%)",
        }}
      />
    </div>
  );
}
