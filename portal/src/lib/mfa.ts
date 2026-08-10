// Zwei-Faktor-Anmeldung (P1-10): Wiederherstellungscodes und E-Mail-Codes.
// Der TOTP-Algorithmus selbst liegt in lib/totp.ts, die Ver-/Entschlüsselung
// des Secrets in lib/crypto.ts — hier steht die fachliche Klammer.
//
// MFA ist OPTIONAL (Entscheidung des Betreibers vom 10.08.2026): Jede Person
// wählt in den Einstellungen selbst, ob und mit welchem Verfahren —
// Authenticator-App (TOTP) oder Code per E-Mail. Es gibt keinen Zwang beim
// Login; die frühere Pflicht-Regel für Betreiber/SuperAdmins wurde bewusst
// zurückgenommen. Empfohlen bleibt sie für diese Konten trotzdem.

import { randomBytes, randomInt } from "node:crypto";
import { hashToken } from "@/lib/token-hash";

export const RECOVERY_CODE_ANZAHL = 10;

export function hatMfa(user: {
  totpEnabledAt: Date | null;
  mfaEmailEnabledAt: Date | null;
}): boolean {
  return user.totpEnabledAt != null || user.mfaEmailEnabledAt != null;
}

// ── E-Mail-Codes ─────────────────────────────────────────────────────────────
// Ein 6-stelliger Zahlencode je Anmeldung bzw. Bestätigung — kryptographisch
// zufällig, kurzlebig und nur als Hash gespeichert. Bewusst dieselbe Länge
// und Optik wie der App-Code, damit das Eingabefeld für beide Verfahren
// dasselbe sein kann.

export const EMAIL_CODE_GUELTIG_MINUTEN = 10;

export function neuerEmailMfaCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashEmailMfaCode(code: string): string {
  return hashToken(code.replace(/\s/g, ""));
}

/** Passt die Eingabe zum gespeicherten, noch nicht abgelaufenen Code? */
export function pruefeEmailMfaCode(
  user: { mfaEmailCodeHash: string | null; mfaEmailCodeExpiresAt: Date | null },
  eingabe: string,
  now: Date = new Date(),
): boolean {
  if (!user.mfaEmailCodeHash || !user.mfaEmailCodeExpiresAt) return false;
  if (user.mfaEmailCodeExpiresAt.getTime() < now.getTime()) return false;
  return hashEmailMfaCode(eingabe) === user.mfaEmailCodeHash;
}

/**
 * Ein Wiederherstellungscode: 10 Zeichen aus einem Alphabet ohne
 * verwechselbare Zeichen (kein 0/O, 1/I/L), gruppiert als XXXXX-XXXXX.
 * ~47 Bit Zufall je Code — bei 10 Codes und fail-closed-Rate-Limit (5
 * Versuche je Viertelstunde) unerratbar.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function neuerRecoveryCode(): string {
  const bytes = randomBytes(10);
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (i === 4) code += "-";
  }
  return code;
}

export function neueRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_ANZAHL }, neuerRecoveryCode);
}

/** Eingaben tolerant normalisieren: Groß/klein, Leerzeichen, fehlender Strich. */
export function normalisiereRecoveryCode(eingabe: string): string {
  const roh = eingabe.toUpperCase().replace(/[\s-]/g, "");
  return roh.length === 10 ? `${roh.slice(0, 5)}-${roh.slice(5)}` : eingabe.toUpperCase().trim();
}

export function hashRecoveryCode(code: string): string {
  return hashToken(normalisiereRecoveryCode(code));
}

/**
 * Löst einen Code gegen die gespeicherten Hashes ein. Ergebnis: die
 * verbleibende Liste ohne den eingelösten Hash — oder null, wenn der Code
 * nicht (mehr) gilt. Jeder Code ist genau einmal einlösbar; das Entfernen
 * schreibt der Aufrufer zurück.
 */
export function loeseRecoveryCodeEin(
  gespeicherteHashes: string[],
  eingabe: string,
): string[] | null {
  const hash = hashRecoveryCode(eingabe);
  if (!gespeicherteHashes.includes(hash)) return null;
  return gespeicherteHashes.filter((h) => h !== hash);
}
