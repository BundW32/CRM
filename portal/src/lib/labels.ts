import type {
  Audience,
  DocumentCategory,
  Role,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@/generated/prisma/client";

export const roleLabels: Record<Role, string> = {
  VERWALTER: "Verwalter",
  EIGENTUEMER: "Eigentümer",
  MIETER: "Mieter",
  HANDWERKER: "Handwerker",
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

// Schadenskategorien — Basis für die spätere Schlagwort-Automatisierung (Stufe 3)
export const damageCategories = [
  "Wasserschaden",
  "Heizung / Warmwasser",
  "Elektrik",
  "Sanitär",
  "Fenster / Türen",
  "Schimmel / Feuchtigkeit",
  "Aufzug",
  "Treppenhaus / Gemeinschaftsflächen",
  "Außenanlage",
  "Sonstiges",
];

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
