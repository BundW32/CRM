// Anwendungsseitige Verschlüsselung für optionale Integrations-Secrets (API-Keys
// Dritter). Zero-Key-Prinzip: Ohne hinterlegten Schlüssel läuft die App komplett
// ohne diese Werte — sind sie aber gesetzt, werden sie NIE im Klartext in der DB
// abgelegt. AES-256-GCM mit einem aus dem Server-Secret abgeleiteten Schlüssel.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const secret =
    process.env.INTEGRATION_ENC_KEY || process.env.SESSION_SECRET || "";
  if (secret.length < 16) {
    throw new Error("Kein ausreichendes Server-Secret für die Verschlüsselung gesetzt.");
  }
  // 32-Byte-Schlüssel deterministisch aus dem Secret ableiten.
  return createHash("sha256").update(secret).digest();
}

// Verschlüsselt Klartext → "v1:<iv>:<tag>:<ciphertext>" (alles base64).
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

// Entschlüsselt einen mit encryptSecret erzeugten Wert. Wirft bei Manipulation.
export function decryptSecret(enc: string): string {
  const parts = enc.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Ungültiges Secret-Format.");
  }
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ct = Buffer.from(parts[3], "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

// Maskiert ein Secret für die Anzeige (nur die letzten 4 Zeichen sichtbar).
export function maskSecret(plain: string): string {
  if (plain.length <= 4) return "••••";
  return `••••${plain.slice(-4)}`;
}
