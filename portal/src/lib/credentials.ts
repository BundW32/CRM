// Hilfsfunktionen für Zugangsdaten ohne E-Mail (Zugangsschreiben).
import crypto from "crypto";
import { db } from "./db";

// Erst-Passwort ohne leicht verwechselbare Zeichen (kein 0/O, 1/I/l)
const PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generatePassword(length = 10) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PW_ALPHABET[bytes[i] % PW_ALPHABET.length];
  }
  // In zwei Vierergruppen lesbar machen, z. B. "Hk7P-r2Mn"
  return length >= 8 ? `${out.slice(0, length - 4)}-${out.slice(length - 4)}` : out;
}

function slugifyName(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 24) || "nutzer"
  );
}

// Eindeutigen Benutzernamen aus dem Namen ableiten (für Zugänge ohne E-Mail)
export async function generateUsername(name: string) {
  const base = slugifyName(name);
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    const existing = await db.user.findUnique({ where: { username: candidate } });
    if (!existing) return candidate;
  }
  return `${base}.${crypto.randomBytes(2).toString("hex")}`;
}
