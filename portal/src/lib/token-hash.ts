// Einweg-Hash für Tokens, die im Klartext per Link/E-Mail verschickt werden,
// aber niemals im Klartext in der Datenbank stehen sollen (Passwort-Reset,
// E-Mail-Bestätigung, Einladungslink).
//
// Anders als bei Passwörtern braucht es kein Salt und keinen langsamen
// Algorithmus: Der Rohwert hat schon 256 Bit Zufall (crypto.randomBytes(32))
// und ist nicht erratbar — die einzige Aufgabe des Hashes ist, dass ein
// Datenbank-Leck (Backup, Log, Fehlkonfiguration, ein Dienstleister mit
// Lesezugriff) keinen direkt einlösbaren Link preisgibt. Vorher stand der Token
// im Klartext in derselben Spalte, über die er auch geprüft wird.
import { createHash } from "node:crypto";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
