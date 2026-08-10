// Gemeinsame Definitionen für die strukturierte Zustandsaufnahme einer Wohnungsübergabe.
// Wird von den Wizard-Clients, der Zusammenfassung und der PDF-Erzeugung genutzt,
// damit Schlüssel und Beschriftungen überall identisch sind.

export type CheckState = "ok" | "maengel" | "na";

export type CheckPoint = { key: string; label: string };

// Beschriftungen der Raumarten (für PDF / Zusammenfassung).
export const ROOM_TYPE_LABELS: Record<string, string> = {
  WOHNZIMMER: "Wohnzimmer",
  SCHLAFZIMMER: "Schlafzimmer",
  KINDERZIMMER: "Kinderzimmer",
  KUECHE: "Küche",
  BAD: "Bad",
  GAESTE_WC: "Gäste-WC",
  FLUR: "Flur / Diele",
  ABSTELLRAUM: "Abstellraum",
  BALKON: "Balkon",
  TERRASSE: "Terrasse",
  KELLER: "Keller",
  GARAGE: "Garage",
  BUERO: "Büro",
  ESSZIMMER: "Esszimmer",
  GARDEROBE: "Garderobe",
  HAUSWIRTSCHAFTSRAUM: "Hauswirtschaftsraum",
  SONSTIGES: "Sonstiges",
};

// Prüfpunkte, die in JEDEM Raum erscheinen.
export const UNIVERSAL_ROOM_CHECKS: CheckPoint[] = [
  { key: "waende", label: "Wände" },
  { key: "boden", label: "Boden / Bodenbelag" },
  { key: "decke", label: "Decke" },
  { key: "fenster", label: "Fenster" },
  { key: "tueren", label: "Türen" },
  { key: "heizung", label: "Heizung / Heizkörper" },
  { key: "elektro", label: "Steckdosen / Schalter / Licht" },
];

// Zusätzliche Prüfpunkte für Küchen.
export const KUECHE_CHECKS: CheckPoint[] = [
  { key: "kueche_einbau", label: "Einbauküche" },
  { key: "kueche_herd", label: "Herd / Backofen / Kochfeld" },
  { key: "kueche_spuele", label: "Spüle & Armaturen" },
  { key: "kueche_dunstabzug", label: "Dunstabzug" },
];

// Zusätzliche Prüfpunkte für Bad / WC.
export const BAD_CHECKS: CheckPoint[] = [
  { key: "sani_wc", label: "WC / Spülung" },
  { key: "sani_wanne", label: "Wanne / Dusche" },
  { key: "sani_armaturen", label: "Armaturen / Abflüsse" },
  { key: "sani_fliesen", label: "Fliesen / Fugen" },
  { key: "sani_schimmel", label: "Feuchtigkeit / Schimmel" },
];

// Liefert die Prüfpunkte (in Reihenfolge) für eine Raumart.
export function checksForRoomType(roomType: string): CheckPoint[] {
  const points = [...UNIVERSAL_ROOM_CHECKS];
  if (roomType === "KUECHE") points.push(...KUECHE_CHECKS);
  if (roomType === "BAD" || roomType === "GAESTE_WC") points.push(...BAD_CHECKS);
  return points;
}

// Beschriftung zu jedem bekannten Raum-Prüfpunkt (für PDF / Zusammenfassung).
export const ALL_ROOM_CHECK_LABELS: Record<string, string> = Object.fromEntries(
  [...UNIVERSAL_ROOM_CHECKS, ...KUECHE_CHECKS, ...BAD_CHECKS].map((p) => [p.key, p.label]),
);

// Reduzierte allgemeine Checkliste (Schritt 3) – nur Haus- bzw. gebäudebezogene Punkte.
// Raumspezifische Punkte (Wände, Fenster, Küche, Bad …) werden jetzt direkt im Raum erfasst.
export const GENERAL_CHECKLIST_SECTIONS: { title: string; items: CheckPoint[] }[] = [
  {
    title: "Haustechnik",
    items: [
      { key: "heizung", label: "Heizungsanlage funktioniert" },
      { key: "warmwasser", label: "Warmwasserversorgung funktioniert" },
      { key: "elektrik", label: "Elektrische Anlage / Sicherungskasten in Ordnung" },
      { key: "rauchmelder", label: "Rauchmelder vorhanden und funktionsfähig" },
      { key: "co_melder", label: "CO-Melder vorhanden (falls relevant)" },
    ],
  },
  {
    title: "Allgemein & Übergabe",
    items: [
      { key: "keller_ok", label: "Kellerabteil vorhanden und übergeben" },
      { key: "garage_ok", label: "Garage / Stellplatz übergeben" },
      { key: "briefkasten", label: "Briefkasten beschriftet" },
      { key: "benutzungshinweise", label: "Einweisungen / Bedienungsanleitungen übergeben" },
      { key: "muell", label: "Wohnung besenrein übergeben" },
    ],
  },
];

// Allgemeine Checkliste für die Übergabe einer STELLPLATZ-Einheit. Die
// Wohnungs-Punkte (Warmwasser, Rauchmelder, „Wohnung besenrein") passen dort
// nicht — wer einen Tiefgaragenplatz übergibt, prüft Zufahrt, Tor und
// Bodenfläche, nicht den Sicherungskasten der Wohnung.
export const STELLPLATZ_CHECKLIST_SECTIONS: { title: string; items: CheckPoint[] }[] = [
  {
    title: "Zustand",
    items: [
      { key: "sp_boden", label: "Bodenfläche / Markierung in Ordnung" },
      { key: "sp_tor", label: "Tor / Schranke funktioniert" },
      { key: "sp_beleuchtung", label: "Beleuchtung funktioniert" },
      { key: "sp_frei", label: "Stellplatz geräumt und besenrein" },
    ],
  },
  {
    title: "Übergabe",
    items: [
      { key: "sp_schluessel", label: "Schlüssel / Handsender / Zufahrtskarte übergeben" },
      { key: "benutzungshinweise", label: "Einweisungen / Bedienungsanleitungen übergeben" },
    ],
  },
];

/** Checkliste passend zur Art der übergebenen Einheit. */
export function generalChecklistSectionsFor(
  unitType?: string | null,
): { title: string; items: CheckPoint[] }[] {
  return unitType === "STELLPLATZ" ? STELLPLATZ_CHECKLIST_SECTIONS : GENERAL_CHECKLIST_SECTIONS;
}

export const GENERAL_CHECKLIST_LABELS: Record<string, string> = Object.fromEntries(
  [...GENERAL_CHECKLIST_SECTIONS, ...STELLPLATZ_CHECKLIST_SECTIONS]
    .flatMap((s) => s.items)
    .map((i) => [i.key, i.label]),
);

export const CHECK_STATE_META: Record<CheckState, { label: string; short: string }> = {
  ok: { label: "In Ordnung", short: "✓" },
  maengel: { label: "Mängel", short: "!" },
  na: { label: "Nicht vorhanden", short: "–" },
};

// Hilfsfunktion: zählt die als "Mängel" markierten Prüfpunkte in einem checks-JSON.
export function countRoomMaengel(checks: Record<string, string> | null | undefined): number {
  if (!checks) return 0;
  return Object.entries(checks).filter(([k, v]) => !k.startsWith("note_") && v === "maengel").length;
}
