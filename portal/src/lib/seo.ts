import type { Metadata } from "next";

// ── Seiten, die nicht in den Suchindex gehören ───────────────────────────────
// Anmeldung, Registrierung und die Bestätigungsseiten dahinter haben für
// Suchende keinen Wert: Sie tragen ein Formular und drei Zeilen Text. Im
// Seobility-Report vom 12.08.2026 tauchten sie als „Seite mit wenig Inhalt"
// und „Seite ohne Fließtext" auf und zogen die Bewertung der ganzen Domain
// nach unten.
//
// `follow: true` ist Absicht: Die Links dieser Seiten (Impressum, Datenschutz,
// zurück zur Startseite) sollen weiter verfolgt werden — nur die Seite selbst
// gehört nicht in den Index.
//
// WICHTIG: Diese Seiten dürfen in `robots.ts` NICHT zusätzlich per `Disallow`
// gesperrt werden. Eine gesperrte Seite wird nicht abgerufen, und was nicht
// abgerufen wird, kann sein `noindex` nicht zeigen — Google indexiert solche
// Adressen dann ersatzweise ohne Beschreibung. Genau die Kombination, die
// gern empfohlen wird, hebt die Wirkung also auf.
export const NICHT_INDEXIEREN: Metadata["robots"] = { index: false, follow: true };

// Für Seiten hinter einem Einmal-Link (Passwort setzen, E-Mail bestätigen):
// Hier soll auch den Links nicht gefolgt werden — die Adresse selbst ist das
// Geheimnis.
export const NICHT_INDEXIEREN_STRENG: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
};
