// Katalog der optionalen Integrationsbereiche (Adapter-Prinzip). Jeder Bereich
// ist ein reiner Beschleuniger: Ohne hinterlegten API-Zugang zeigt die UI den
// manuellen Weg (Zero-Key-Prinzip). SEPA-Lastschrift ist bewusst NICHT hier,
// da sie ganz ohne Schlüssel funktioniert (reine XML-Dateierzeugung).

export type IntegrationProvider = { value: string; label: string };

export type IntegrationArea = {
  key: string; // stabiler Schlüssel (DB: IntegrationSetting.area)
  title: string;
  description: string;
  providers: IntegrationProvider[];
  keyLabel: string; // Beschriftung des Schlüsselfelds
  manualFallback: string; // manueller Weg, wenn kein Schlüssel hinterlegt ist
  moduleHint: string; // informativ: zugehöriges Ausbaumodul
};

export const INTEGRATION_AREAS: IntegrationArea[] = [
  {
    key: "BANKING",
    title: "Open Banking – automatischer Umsatzabruf",
    description:
      "Ruft Kontoumsätze automatisch ab und übergibt sie an den vorhandenen Bankimport (Duplikaterkennung inklusive).",
    providers: [
      { value: "finapi", label: "finAPI" },
      { value: "gocardless", label: "GoCardless / Nordigen" },
    ],
    keyLabel: "API-Schlüssel / Client-Secret",
    manualFallback:
      "Ohne Zugang: Kontoumsätze als CSV-Datei aus dem Online-Banking exportieren und über den CSV-Bankimport einlesen.",
    moduleHint: "M-G",
  },
  {
    key: "MESSDIENST",
    title: "Messdienst-Import – Heizkosten",
    description:
      "Importiert die Heizkostenverteilung des Messdienstleisters direkt in die Jahresabrechnung (als StatementUnitAmount).",
    providers: [
      { value: "ista", label: "ista" },
      { value: "techem", label: "Techem" },
      { value: "minol", label: "Minol" },
      { value: "brunata", label: "Brunata" },
    ],
    keyLabel: "API-Schlüssel / Zugangsdaten",
    manualFallback:
      "Ohne Zugang: die Heizkostenabrechnung des Messdienstes wie bisher manuell je Einheit in der Jahresabrechnung erfassen.",
    moduleHint: "M-H",
  },
];

export function integrationArea(key: string): IntegrationArea | undefined {
  return INTEGRATION_AREAS.find((a) => a.key === key);
}
