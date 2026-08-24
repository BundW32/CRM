// Google-Tag (gtag.js) für GA4 und Google-Ads-Conversion — EIN Snippet für
// beide Ziele, geladen erst NACH Einwilligung (Statistik oder Marketing);
// Google Consent Mode v2 steuert darunter, was gespeichert werden darf.
//
// Regeln dieses Moduls:
// - Komponenten rufen NIE window.gtag direkt — nur track(), adsConversion()
//   und sendePageview(). Eine Stelle, ein Vokabular, typisiert.
// - Ohne konfigurierte IDs (NEXT_PUBLIC_*, zur Bauzeit eingebettet) tut alles
//   hier sauber nichts: kein Script-Tag, kein Fehler.
// - In der Entwicklung wird nichts gesendet, sondern in die Konsole geloggt.
// - Gemessen wird nur der ÖFFENTLICHE Teil der Seite (istOeffentlicherPfad):
//   Die Portal-Pfade hinter dem Login tragen Datensatz-Ids in der URL — die
//   haben bei Google nichts verloren. Einzige Ausnahme: die Registrierungs-
//   Conversion feuert auf /onboarding (Zielseite nach Kontoerstellung),
//   als Conversion-Ereignis ohne page_view.

import type { ConsentAuswahl } from "@/lib/analytics/consent";

export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID ?? "";
export const ADS_CONVERSION_ID = process.env.NEXT_PUBLIC_ADS_CONVERSION_ID ?? "";
export const ADS_LABEL_REGISTRIERUNG = process.env.NEXT_PUBLIC_ADS_LABEL_REGISTRIERUNG ?? "";
export const ADS_LABEL_LEAD = process.env.NEXT_PUBLIC_ADS_LABEL_LEAD ?? "";

const DEV = process.env.NODE_ENV !== "production";

export function gtagKonfiguriert(): boolean {
  return Boolean(GA4_ID || ADS_CONVERSION_ID);
}

// Nur diese Pfade werden an Google gemeldet. Bewusst eine Positivliste:
// Eine neue öffentliche Seite (z. B. Landingpage) wird hier eingetragen —
// ein vergessener Eintrag heißt „nicht gemessen", nie „Portal-URL geleakt".
const OEFFENTLICHE_PFADE = [
  "/funktionen",
  "/so-funktionierts",
  "/preise",
  "/registrieren",
  "/login",
  "/impressum",
  "/datenschutz",
  "/datenschutz-saas",
  "/agb",
  "/avv",
  "/widerruf",
  "/ki-transparenz",
  "/infopaket",
  "/weg-selbst-verwalten",
  "/hausgeldabrechnung-software",
  "/wirtschaftsplan-erstellen",
  "/zertifizierter-verwalter",
];

export function istOeffentlicherPfad(pfad: string): boolean {
  if (pfad === "/") return true;
  return OEFFENTLICHE_PFADE.some((p) => pfad === p || pfad.startsWith(`${p}/`));
}

// ── gtag-Grundgerüst ────────────────────────────────────────────────────────
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// gtag.js liest das `arguments`-Objekt aus dem dataLayer — ein einfaches
// Array wird ignoriert. Deshalb eine klassische Funktion, kein Pfeil.
function gtag(..._args: unknown[]) {
  window.dataLayer = window.dataLayer ?? [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

function consentModeWerte(auswahl: ConsentAuswahl) {
  return {
    analytics_storage: auswahl.statistik ? "granted" : "denied",
    ad_storage: auswahl.marketing ? "granted" : "denied",
    ad_user_data: auswahl.marketing ? "granted" : "denied",
    ad_personalization: auswahl.marketing ? "granted" : "denied",
  };
}

let geladen = false;

/**
 * Lädt gtag.js bzw. aktualisiert nur den Consent Mode, wenn schon geladen.
 * Aufrufer ist components/analytics/google-tag.tsx — beim Seitenstart mit
 * gespeicherter Einwilligung und bei jeder Änderung über das Banner.
 *
 * Ein Widerruf nach dem Laden entfernt das Script nicht mehr (technisch
 * unmöglich ohne Reload) — der Consent Mode stellt aber alle Speicherungen
 * auf denied; beim nächsten Seitenaufruf lädt das Script gar nicht mehr.
 */
export function ladeGoogleTag(auswahl: ConsentAuswahl): void {
  if (typeof window === "undefined" || !gtagKonfiguriert()) return;
  if (DEV) {
    console.log("[analytics] Google-Tag (dev, nicht geladen):", auswahl);
    return;
  }
  if (geladen) {
    gtag("consent", "update", consentModeWerte(auswahl));
    return;
  }
  if (!auswahl.statistik && !auswahl.marketing) return;

  geladen = true;
  window.gtag = gtag;
  // Default IMMER vor dem ersten config: alles denied, dann das Update mit
  // der tatsächlichen Auswahl (Consent Mode v2).
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  });
  gtag("js", new Date());
  // page_views schickt google-tag.tsx manuell je Routenwechsel — sonst
  // zählte beim Client-Routing nur die erste Seite.
  if (GA4_ID) gtag("config", GA4_ID, { send_page_view: false });
  if (ADS_CONVERSION_ID) gtag("config", ADS_CONVERSION_ID);
  gtag("consent", "update", consentModeWerte(auswahl));

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID || ADS_CONVERSION_ID)}`;
  document.head.appendChild(script);
}

// ── Typisiertes Ereignis-Vokabular ──────────────────────────────────────────
// Genau die Ereignisse des Messkonzepts (Auftrag A3) — wer ein neues braucht,
// trägt es HIER ein, damit GA4 nicht mit Freitext-Namen zuwuchert.
export type TrackEventName =
  | "scroll_50"
  | "scroll_75"
  | "engaged_60s"
  | "view_pricing"
  | "faq_open"
  | "cta_click"
  | "signup_start"
  | "signup_field_error"
  | "signup_complete"
  | "lead_magnet_submit";

export type TrackParams = Record<string, string | number | boolean>;

/** Sendet ein GA4-Ereignis. Ohne geladenes gtag (kein Consent) still verworfen. */
export function track(name: TrackEventName, params: TrackParams = {}): void {
  if (DEV) {
    console.log(`[analytics] ${name}`, params);
    return;
  }
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}

/** Google-Ads-Conversion (send_to = ID/Label). Label aus den Env-Variablen. */
export function adsConversion(label: string): void {
  if (!ADS_CONVERSION_ID || !label) return;
  if (DEV) {
    console.log(`[analytics] ads-conversion ${ADS_CONVERSION_ID}/${label}`);
    return;
  }
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "conversion", { send_to: `${ADS_CONVERSION_ID}/${label}` });
}

/** Manueller page_view (GA4 ist mit send_page_view:false konfiguriert). */
export function sendePageview(pfad: string): void {
  if (!istOeffentlicherPfad(pfad)) return;
  if (DEV) {
    console.log(`[analytics] page_view ${pfad}`);
    return;
  }
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: pfad,
    page_location: window.location.href,
    page_title: document.title,
  });
}
