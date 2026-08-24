// Einwilligungs-Verwaltung für Statistik-/Marketing-Dienste (GA4, Google Ads).
//
// Abgrenzung, damit niemand die zwei Systeme verwechselt: Das eigene
// First-Party-Tracking (lib/analytics/tracking.ts) ist cookiefrei und läuft
// OHNE Einwilligung — es setzt nichts am Browser. GA4 und Ads-Conversion
// setzen Cookies und brauchen nach § 25 TTDSG eine aktive Einwilligung VOR
// dem Laden. Diese Datei hält die pure Logik (Format, Version, Parsing);
// Speicherung und Oberfläche liegen in components/analytics/consent-banner.tsx.
//
// Die Auswahl liegt in localStorage — das ist selbst einwilligungsfrei
// (unbedingt erforderlich, um die Entscheidung zu behalten; ohne sie käme das
// Banner bei jedem Aufruf wieder). `version` steigt, wenn sich Zwecke oder
// Kategorien ändern — gespeicherte Einwilligungen älterer Versionen gelten
// nicht mehr, das Banner erscheint erneut.

export const CONSENT_VERSION = 1;
export const CONSENT_STORAGE_KEY = "wp-consent";

// Fenster-Ereignisse, über die Banner und Google-Tag lose gekoppelt sind:
// "open" öffnet das Banner erneut (Footer-Link „Cookie-Einstellungen"),
// "changed" meldet eine neue Auswahl (detail: Consent).
export const CONSENT_OPEN_EVENT = "wp-consent-open";
export const CONSENT_CHANGED_EVENT = "wp-consent-changed";

export type ConsentAuswahl = {
  statistik: boolean;
  marketing: boolean;
};

/**
 * Gibt es überhaupt etwas einzuwilligen? Ohne konfigurierte Google-IDs
 * (NEXT_PUBLIC_*, zur Bauzeit eingebettet) laden weder GA4 noch Ads — dann
 * erscheint auch kein Banner und kein Footer-Link. Die B&W-Tür setzt die
 * Variablen nicht und bleibt damit komplett unverändert.
 */
export function consentNoetig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GA4_ID || process.env.NEXT_PUBLIC_ADS_CONVERSION_ID,
  );
}

export type Consent = ConsentAuswahl & {
  version: number;
  /** ISO-Zeitpunkt der Entscheidung (Nachweis). */
  zeitpunkt: string;
};

export function neuerConsent(auswahl: ConsentAuswahl, jetzt: Date = new Date()): Consent {
  return {
    version: CONSENT_VERSION,
    statistik: auswahl.statistik,
    marketing: auswahl.marketing,
    zeitpunkt: jetzt.toISOString(),
  };
}

/**
 * Gespeicherten Wert lesen. null bei allem, was nicht exakt passt — auch bei
 * einer älteren Version: Dann gilt die Einwilligung als nicht erteilt und
 * das Banner fragt neu.
 */
export function parseConsent(raw: string | null | undefined): Consent | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (
      v?.version !== CONSENT_VERSION ||
      typeof v.statistik !== "boolean" ||
      typeof v.marketing !== "boolean" ||
      typeof v.zeitpunkt !== "string"
    ) {
      return null;
    }
    return {
      version: CONSENT_VERSION,
      statistik: v.statistik,
      marketing: v.marketing,
      zeitpunkt: v.zeitpunkt,
    };
  } catch {
    return null;
  }
}
