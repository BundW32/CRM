// Die EINE Quelle für die Umlageschlüssel einer Sonderumlage — Formular
// (page.tsx) und Server-Action (actions.ts) lesen beide von hier. Vorher
// führten beide je eine eigene Liste, und die des Formulars kannte
// JE_STELLPLATZ nicht: Der Schlüssel war „umgesetzt", aber nicht wählbar —
// genau der Doppellisten-Fehler, vor dem AGENTS.md warnt. Die Konstante kann
// nicht in actions.ts wohnen: Eine „use server"-Datei darf nur async-
// Funktionen exportieren.
//
// Sonderumlagen nutzen die strikten Verteilungsschlüssel (die manuellen
// VERBRAUCH/FESTBETRAG/INDIVIDUELL sind hier nicht sinnvoll). JE_STELLPLATZ
// auch hier: Eine Sonderumlage für die Toranlage trifft nur die Stellplätze —
// derselbe strikte Schlüssel wie in Plan und Abrechnung.
export const SONDERUMLAGE_KEYS = ["MEA", "FLAECHE", "EINHEITEN", "PERSONEN", "JE_STELLPLATZ"] as const;
