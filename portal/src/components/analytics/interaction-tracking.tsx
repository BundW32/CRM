"use client";

// Mikro-Conversions des Messkonzepts (Auftrag A3) — EINE Komponente, die per
// Ereignis-Delegation lauscht, statt Tracking-Aufrufe über die Marken-Seiten
// zu verstreuen: CTA-Klicks über a[href^="/registrieren"], FAQ über das
// toggle-Ereignis der nativen <details>, Scroll-Tiefe und aktive Zeit über
// Fenster-Ereignisse. Alles läuft über track() aus lib/analytics/gtag.ts —
// ohne Einwilligung ist gtag nie geladen und jedes Ereignis verpufft still;
// ohne konfigurierte IDs registriert die Komponente gar nichts.
//
// Gezählt wird nur der öffentliche Teil (istOeffentlicherPfad) — mit einer
// Ausnahme: signup_complete feuert auf /onboarding?neu=1, der Zielseite nach
// erfolgreicher Kontoerstellung (Server-Redirect aus registrieren/actions.ts).
// Genau dort, nicht beim Klick auf „Konto erstellen" — sonst zählte jeder
// Fehlversuch als Conversion.

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  ADS_LABEL_REGISTRIERUNG,
  adsConversion,
  gtagKonfiguriert,
  istOeffentlicherPfad,
  track,
} from "@/lib/analytics/gtag";

// Herkunft eines CTA-Klicks, vom Nächstliegenden zum Allgemeinen:
// ausdrückliche Markierung (data-cta-location), Kopf-/Fußzeile, umgebende
// Sektion mit id (Startseite: „inhalt" = Hero, „schluss-cta"), sonst Pfad.
function ctaOrt(el: Element): string {
  const markiert = el.closest("[data-cta-location]");
  if (markiert) return markiert.getAttribute("data-cta-location") || "unbekannt";
  if (el.closest("header")) return "header";
  if (el.closest("footer")) return "footer";
  const sektion = el.closest("section[id], div[id]") as HTMLElement | null;
  if (sektion?.id) return sektion.id;
  return window.location.pathname;
}

export function InteractionTracking() {
  const pathname = usePathname();

  // Je Seitenaufruf: Scroll-Tiefe (je Marke einmal), aktive Zeit,
  // Preis-Sichtung, Registrierungs-Ereignisse. Der Effekt startet bei jedem
  // Routenwechsel neu — damit zählen SPA-Navigationen wie echte Seitenwechsel.
  useEffect(() => {
    if (!gtagKonfiguriert() || !pathname || !istOeffentlicherPfad(pathname)) return;

    // Scroll-Tiefe: einmal je Marke, Zurückscrollen zählt nicht erneut.
    let s50 = false;
    let s75 = false;
    const onScroll = () => {
      const anteil =
        (window.scrollY + window.innerHeight) /
        Math.max(1, document.documentElement.scrollHeight);
      if (!s50 && anteil >= 0.5) {
        s50 = true;
        track("scroll_50", { page_path: pathname });
      }
      if (!s75 && anteil >= 0.75) {
        s75 = true;
        track("scroll_75", { page_path: pathname });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // kurze Seiten stehen ohne Scrollen schon bei 50/75 %

    // 60 Sekunden AKTIV: nur Sekunden zählen, in denen das Tab sichtbar ist.
    let aktivMs = 0;
    const intervall = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      aktivMs += 1000;
      if (aktivMs >= 60_000) {
        track("engaged_60s", { page_path: pathname });
        clearInterval(intervall);
      }
    }, 1000);

    // Preis-Sichtung: /preise zählt sofort; auf anderen Seiten eine markierte
    // Preis-Sektion (#preise oder [data-preis-sektion]) nach 2 s im Viewport.
    let observer: IntersectionObserver | undefined;
    let verweilTimer: ReturnType<typeof setTimeout> | undefined;
    if (pathname === "/preise" || pathname.startsWith("/preise/")) {
      track("view_pricing", { page_path: pathname });
    } else {
      const sektion = document.querySelector("#preise, [data-preis-sektion]");
      if (sektion && "IntersectionObserver" in window) {
        observer = new IntersectionObserver(
          (eintraege) => {
            for (const e of eintraege) {
              if (e.isIntersecting && !verweilTimer) {
                verweilTimer = setTimeout(() => {
                  track("view_pricing", { page_path: pathname });
                  observer?.disconnect();
                }, 2000);
              } else if (!e.isIntersecting && verweilTimer) {
                clearTimeout(verweilTimer);
                verweilTimer = undefined;
              }
            }
          },
          { threshold: 0.3 },
        );
        observer.observe(sektion);
      }
    }

    // Registrierungsformular: Start beim ersten Feld-Fokus, Feldfehler über
    // das native invalid-Ereignis (Client-Validierung) und den
    // fehler-Parameter des Server-Redirects.
    let signupGestartet = false;
    const onFocusIn = (e: FocusEvent) => {
      if (signupGestartet) return;
      const ziel = e.target as HTMLElement | null;
      if (!ziel || !ziel.closest("form") || !/^(INPUT|SELECT|TEXTAREA)$/.test(ziel.tagName)) return;
      signupGestartet = true;
      track("signup_start");
    };
    const onInvalid = (e: Event) => {
      const feld = e.target as HTMLInputElement | null;
      track("signup_field_error", { field_name: feld?.name || "unbekannt" });
    };
    if (pathname === "/registrieren") {
      document.addEventListener("focusin", onFocusIn);
      document.addEventListener("invalid", onInvalid, true);
      const fehler = new URLSearchParams(window.location.search).get("fehler");
      if (fehler) track("signup_field_error", { field_name: `server:${fehler}` });
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      clearInterval(intervall);
      if (verweilTimer) clearTimeout(verweilTimer);
      observer?.disconnect();
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("invalid", onInvalid, true);
    };
  }, [pathname]);

  // Konto erfolgreich erstellt: /onboarding?neu=1 (Server-Redirect nach der
  // Transaktion). Zusätzlich die Google-Ads-Conversion. Der Parameter wird
  // sofort aus der URL entfernt — Reload oder geteilter Link doppeln nichts.
  useEffect(() => {
    if (!gtagKonfiguriert() || pathname !== "/onboarding") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("neu") !== "1") return;
    // Kein Gutschein-Feld in der Registrierung — der Parameter bleibt für die
    // GA4-Auswertung trotzdem gesetzt, damit das Ereignis-Schema stabil ist.
    track("signup_complete", { has_promo_code: false });
    adsConversion(ADS_LABEL_REGISTRIERUNG);
    params.delete("neu");
    const rest = params.toString();
    window.history.replaceState(null, "", rest ? `${pathname}?${rest}` : pathname);
  }, [pathname]);

  // Einmalige Delegations-Zuhörer: CTA-Klicks und FAQ-Aufklappen. toggle
  // blubbert nicht — der capture-Zuhörer am Dokument bekommt es trotzdem.
  useEffect(() => {
    if (!gtagKonfiguriert()) return;
    const onClick = (e: MouseEvent) => {
      const ziel = e.target as Element | null;
      const cta = ziel?.closest?.('a[href^="/registrieren"]');
      if (cta && istOeffentlicherPfad(window.location.pathname)) {
        track("cta_click", { cta_location: ctaOrt(cta) });
      }
      // Broschüren-Download: markierte PDF-Links (data-broschuere-download).
      // Öffnet in neuem Tab, die Seite bleibt stehen — das Ereignis geht
      // nicht durch die Navigation verloren.
      const broschuere = ziel?.closest?.("a[data-broschuere-download]");
      if (broschuere && istOeffentlicherPfad(window.location.pathname)) {
        track("brochure_download", {
          cta_location: ctaOrt(broschuere),
          page_path: window.location.pathname,
        });
      }
    };
    const onToggle = (e: Event) => {
      const d = e.target as HTMLElement | null;
      if (!d || d.tagName !== "DETAILS" || !(d as HTMLDetailsElement).open) return;
      if (!istOeffentlicherPfad(window.location.pathname)) return;
      const frage = d.querySelector("summary")?.textContent?.trim().slice(0, 120) ?? "";
      track("faq_open", { faq_question: frage });
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);

  return null;
}
