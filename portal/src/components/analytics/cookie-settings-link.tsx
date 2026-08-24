"use client";

// Footer-Link „Cookie-Einstellungen": öffnet das Einwilligungs-Banner erneut,
// damit die Auswahl jederzeit widerrufbar ist (Art. 7 Abs. 3 DSGVO). Ohne
// konfigurierte Google-IDs gibt es nichts einzustellen — dann rendert der
// Link nichts, und die B&W-Tür bleibt unverändert.

import { CONSENT_OPEN_EVENT, consentNoetig } from "@/lib/analytics/consent";

export function CookieSettingsLink({ className = "" }: { className?: string }) {
  if (!consentNoetig()) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
      className={`underline underline-offset-2 transition-colors hover:text-white ${className}`}
    >
      Cookie-Einstellungen
    </button>
  );
}
