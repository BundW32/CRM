import type { VerwalterAnfrageStatus } from "@/generated/prisma/client";
import type { BadgeTone } from "@/components/data-display";

// Status-Beschriftung der Verwalter-Tickets — EINE Quelle für die Liste, die
// Detailseite und den Betreiber-Bereich. „Wartet auf Antwort" statt „Offen":
// Der Status sagt, WER am Zug ist, nicht nur, dass etwas aussteht.
export const ANFRAGE_STATUS: Record<VerwalterAnfrageStatus, { label: string; tone: BadgeTone }> = {
  OFFEN: { label: "Wartet auf Antwort", tone: "warning" },
  BEANTWORTET: { label: "Beantwortet", tone: "success" },
  GESCHLOSSEN: { label: "Geschlossen", tone: "neutral" },
};
