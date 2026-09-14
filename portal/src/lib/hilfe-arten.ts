// Arten einer Hilfe-Anfrage — in eigener Datei, weil das Client-Widget
// (`components/help-widget.tsx`) sie braucht. `lib/hilfe-anfrage.ts` zieht
// über das Deployment-Branding die Datenbank-Anbindung mit; ein Client-Import
// von dort ließe den Build mit „Can't resolve 'dns'/'fs'/'net'" scheitern.
export const HILFE_ARTEN = {
  fehler: "Etwas funktioniert nicht",
  frage: "Ich habe eine Frage",
  sonstiges: "Sonstiges",
} as const;

export type HilfeArt = keyof typeof HILFE_ARTEN;
