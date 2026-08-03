// Gemeinsame Filter auf Buchungen.
import type { Prisma } from "@/generated/prisma/client";

/**
 * Buchungen, die fachlich noch zählen: weder storniert noch selbst eine
 * Stornobuchung.
 *
 * Ein Stornopaar bleibt im Journal sichtbar (Nachvollziehbarkeit) und hebt sich
 * im Kontostand von selbst auf, weil die Gegenbuchung die umgekehrte Richtung
 * hat. In der **Kostenverteilung** genügt das nicht: Das Storno einer Ausgabe
 * ist eine Einnahme und würde die Ausgabensumme der Kostenart nicht mindern —
 * die Kosten würden trotz Storno umgelegt. Deshalb fällt das Paar überall dort
 * heraus, wo Beträge fachlich ausgewertet werden (Jahresabrechnung,
 * Vorjahres-Istwerte, Zahlungen je Einheit).
 */
export const NOT_REVERSED: Prisma.BookingWhereInput = {
  reversalOfId: null,
  reversedBy: { is: null },
};
