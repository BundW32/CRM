"use client";

import { useEffect } from "react";

// Registriert den Service Worker (PWA / Push). Fehler werden bewusst ignoriert.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
