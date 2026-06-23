"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      // Navigation completed — finish bar
      setWidth(100);
      const t = setTimeout(() => setVisible(false), 300);
      prevPathRef.current = pathname;
      return () => clearTimeout(t);
    }
  }, [pathname]);

  // Intercept all link clicks to start the bar
  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      const a = (e.target as Element).closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto") || href.startsWith("#")) return;
      setVisible(true);
      setWidth(0);
      if (timerRef.current) clearTimeout(timerRef.current);
      // Animate to ~80% quickly, then slow down (never reaches 100 on its own)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setWidth(65));
        timerRef.current = setTimeout(() => setWidth(82), 600);
      });
    }
    document.addEventListener("click", onLinkClick);
    return () => document.removeEventListener("click", onLinkClick);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]"
      style={{ transition: "opacity 0.3s" }}
    >
      <div
        className="h-full bg-brand-orange shadow-[0_0_8px_theme(colors.brand-orange/80%)]"
        style={{
          width: `${width}%`,
          transition: width === 100 ? "width 0.15s ease-out" : "width 0.5s cubic-bezier(0.1,0.6,0.4,1)",
        }}
      />
    </div>
  );
}
