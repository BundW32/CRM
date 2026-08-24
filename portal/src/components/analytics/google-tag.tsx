"use client";

// Orchestriert den Google-Tag: lädt gtag.js, sobald eine Einwilligung
// vorliegt (gespeichert oder frisch über das Banner erteilt), und sendet je
// Routenwechsel genau EINEN page_view — nur für öffentliche Pfade
// (lib/analytics/gtag.ts erklärt die Positivliste).

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  type Consent,
  parseConsent,
} from "@/lib/analytics/consent";
import { gtagKonfiguriert, ladeGoogleTag, sendePageview } from "@/lib/analytics/gtag";

export function GoogleTag() {
  const pathname = usePathname();
  // Merkt den zuletzt gemeldeten Pfad: Beim Start laufen Mount-Effekt und
  // Pfad-Effekt direkt nacheinander — ohne die Sperre zählte die erste Seite
  // doppelt (Abnahmepunkt: „genau ein page_view, nicht null und nicht zwei").
  const gemeldet = useRef<string | null>(null);

  useEffect(() => {
    if (!gtagKonfiguriert()) return;
    let gespeichert: Consent | null = null;
    try {
      gespeichert = parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
    } catch {
      /* localStorage gesperrt → wie ohne Einwilligung */
    }
    if (gespeichert) {
      ladeGoogleTag(gespeichert);
      gemeldet.current = window.location.pathname;
      sendePageview(window.location.pathname);
    }

    const onChange = (e: Event) => {
      const consent = (e as CustomEvent<Consent>).detail;
      if (!consent) return;
      const warGeladen = Boolean(window.gtag);
      ladeGoogleTag(consent);
      // Erst-Einwilligung auf der laufenden Seite: den page_view nachholen,
      // der beim Seitenstart mangels Consent verworfen wurde.
      if (!warGeladen && (consent.statistik || consent.marketing)) {
        gemeldet.current = window.location.pathname;
        sendePageview(window.location.pathname);
      }
    };
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!gtagKonfiguriert() || !pathname) return;
    if (gemeldet.current === pathname) return;
    gemeldet.current = pathname;
    sendePageview(pathname);
  }, [pathname]);

  return null;
}
