// Zwei-Faktor-Anmeldung (P1-10): Pflicht-Regel und Wiederherstellungscodes.
// Der TOTP-Algorithmus selbst liegt in lib/totp.ts, die Ver-/Entschlüsselung
// des Secrets in lib/crypto.ts — hier steht die fachliche Klammer.

import { randomBytes } from "node:crypto";
import { isPlatformAdminUser } from "@/lib/platform-admin";
import { hashToken } from "@/lib/token-hash";

export const RECOVERY_CODE_ANZAHL = 10;

/**
 * Für wen ist MFA Pflicht? Betreiber-Konten und Verwalter-SuperAdmins — die
 * Konten, deren Übernahme die Daten VIELER Menschen öffnet (Betreiber: alle
 * Organisationen; SuperAdmin: die ganze Gemeinschaft samt Bankdaten). Für
 * alle anderen ist MFA freiwillig über die Konto-Seite.
 */
export function istMfaPflicht(user: {
  email: string | null;
  isPlatformAdmin?: boolean;
  role: string;
  isSuperAdmin: boolean;
}): boolean {
  return isPlatformAdminUser(user) || (user.role === "VERWALTER" && user.isSuperAdmin);
}

export function hatMfa(user: { totpEnabledAt: Date | null }): boolean {
  return user.totpEnabledAt != null;
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
