import type {
  Audience,
  ContactMethod,
  DocumentCategory,
  MaintenanceInterval,
  ManagementType,
  MeterType,
  ResolutionStatus,
  Role,
  TicketPriority,
  TicketStatus,
  TicketType,
  Trade,
  VoteChoice,
} from "@/generated/prisma/client";

export const roleLabels: Record<Role, string> = {
  VERWALTER: "Verwalter",
  EIGENTUEMER: "Eigentümer",
  MIETER: "Mieter",
  HANDWERKER: "Handwerker",
};

// Kontotyp einer Organisation (Selbstverwalter-Feinschliff). Bestimmt nur die
// Ansprache/Texte – die interne Rollenlogik bleibt unverändert (VERWALTER).
export type AccountType = "verwaltung" | "selbstverwalter";

export const accountTypeLabels: Record<AccountType, string> = {
  verwaltung: "Hausverwaltung",
  selbstverwalter: "Selbstverwaltung",
};

// Bezeichnung der „Einheit", die die Organisation verwaltet – für Ansprache.
export function orgNounFor(accountType: string): string {
  return accountType === "selbstverwalter" ? "WEG / Ihr Objekt" : "Hausverwaltung";
}

// Stimmprinzip einer WEG.
export const votingPrincipleLabels: Record<string, string> = {
  KOPF: "Kopfprinzip (eine Stimme je Eigentümer)",
  MEA: "Wertprinzip (Stimmgewicht nach Miteigentumsanteilen)",
  OBJEKT: "Objektprinzip (eine Stimme je Einheit)",
};

export const ticketTypeLabels: Record<TicketType, string> = {
  SCHADEN: "Schadensmeldung",
  ANFRAGE: "Anfrage",
  DOKUMENT_ANFRAGE: "Dokumentanforderung",
  SONSTIGES: "Sonstiges",
};

export const ticketStatusLabels: Record<TicketStatus, string> = {
  NEU: "Neu",
  IN_BEARBEITUNG: "In Bearbeitung",
  BEAUFTRAGT: "Beauftragt",
  ERLEDIGT: "Erledigt",
  GESCHLOSSEN: "Geschlossen",
};

export const ticketStatusStyles: Record<TicketStatus, string> = {
  NEU: "bg-blue-100 text-blue-800",
  IN_BEARBEITUNG: "bg-amber-100 text-amber-800",
  BEAUFTRAGT: "bg-purple-100 text-purple-800",
  ERLEDIGT: "bg-green-100 text-green-800",
  GESCHLOSSEN: "bg-gray-200 text-gray-700",
};

export const ticketPriorityLabels: Record<TicketPriority, string> = {
  NIEDRIG: "Niedrig",
  NORMAL: "Normal",
  HOCH: "Hoch",
  DRINGEND: "Dringend",
};

export const documentCategoryLabels: Record<DocumentCategory, string> = {
  ABRECHNUNG: "Abrechnung",
  PROTOKOLL: "Protokoll",
  VERTRAG: "Vertrag",
  BESCHEINIGUNG: "Bescheinigung",
  SONSTIGES: "Sonstiges",
};

export const audienceLabels: Record<Audience, string> = {
  MIETER: "Mieter",
  EIGENTUEMER: "Eigentümer",
  ALLE: "Alle",
};

export const tradeLabels: Record<Trade, string> = {
  SANITAER: "Sanitär",
  HEIZUNG: "Heizung / Warmwasser",
  ELEKTRO: "Elektro",
  DACH: "Dachdecker",
  MALER: "Maler / Lackierer",
  BODENLEGER: "Bodenleger",
  FENSTER_TUEREN: "Fenster / Türen",
  SCHLOSSEREI: "Schlüssel / Schloss",
  GARTEN: "Garten / Außenanlage",
  REINIGUNG: "Reinigung",
  SCHAEDLINGSBEKAEMPFUNG: "Schädlingsbekämpfung",
  AUFZUG: "Aufzug",
  ALLGEMEIN: "Hausmeister / Allgemein",
  SONSTIGES: "Sonstiges",
};

export const contactMethodLabels: Record<ContactMethod, string> = {
  EMAIL: "E-Mail",
  TELEFON: "Telefon",
  MOBIL: "Mobil",
  POST: "Post",
};

export const meterTypeLabels: Record<MeterType, string> = {
  STROM: "Strom",
  GAS: "Gas",
  WASSER_KALT: "Wasser (kalt)",
  WASSER_WARM: "Wasser (warm)",
  HEIZUNG: "Heizung",
  SONSTIGES: "Sonstiges",
};

export const maintenanceIntervalLabels: Record<MaintenanceInterval, string> = {
  MONATLICH: "Monatlich",
  QUARTALSWEISE: "Quartalsweise",
  HALBJAEHRLICH: "Halbjährlich",
  JAEHRLICH: "Jährlich",
  ZWEIJAEHRLICH: "Alle 2 Jahre",
  EINMALIG: "Einmalig",
};

export const resolutionStatusLabels: Record<ResolutionStatus, string> = {
  OFFEN: "Abstimmung läuft",
  ANGENOMMEN: "Angenommen",
  ABGELEHNT: "Abgelehnt",
  ZURUECKGEZOGEN: "Zurückgezogen",
};

export const voteChoiceLabels: Record<VoteChoice, string> = {
  JA: "Ja",
  NEIN: "Nein",
  ENTHALTUNG: "Enthaltung",
};

export const managementTypeLabels: Record<ManagementType, string> = {
  MIETVERWALTUNG: "Mietverwaltung",
  WEG: "WEG (Eigentümergemeinschaft)",
};

// Vom Mieter/Eigentümer anforderbare Dokumente
export const requestableDocuments = [
  "Wohnungsgeberbescheinigung",
  "Mietbescheinigung",
  "Nebenkostenabrechnung",
  "Betriebskostenabrechnung",
  "Mietvertrag (Kopie)",
  "Hausgeldabrechnung",
  "Sonstiges",
];

// Intervall in Monaten (für die Berechnung der nächsten Fälligkeit)
export const maintenanceIntervalMonths: Record<MaintenanceInterval, number | null> = {
  MONATLICH: 1,
  QUARTALSWEISE: 3,
  HALBJAEHRLICH: 6,
  JAEHRLICH: 12,
  ZWEIJAEHRLICH: 24,
  EINMALIG: null,
};

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
