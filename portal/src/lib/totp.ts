// TOTP nach RFC 6238 (P1-10) — bewusst ohne zusätzliche Abhängigkeit: Der
// Algorithmus ist ein HMAC mit Zeitfenster (~40 Zeilen), und eine
// Authentifizierungs-Bibliothek wäre genau die Sorte Fremdcode, deren
// Kompromittierung hier am meisten kostet. Die Korrektheit halten die
// offiziellen Testvektoren aus RFC 6238 Anhang B fest (totp.test.ts).
//
// Kompatibel mit allen gängigen Authenticator-Apps (Google Authenticator,
// Aegis, 1Password, …): SHA-1, 6 Ziffern, 30-Sekunden-Schritt — die Vorgaben
// des otpauth-Standards. SHA-1 ist hier keine Schwäche: HMAC-SHA1 ist für
// diesen Zweck ungebrochen, und die Apps unterstützen verlässlich nichts
// anderes.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SCHRITT_SEKUNDEN = 30;
const ZIFFERN = 6;

// ── Base32 (RFC 4648, ohne Padding) ──────────────────────────────────────────
// Authenticator-Apps erwarten das Secret Base32-kodiert — Node bringt dafür
// nichts mit.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let wert = 0;
  let out = "";
  for (const byte of buf) {
    wert = (wert << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(wert >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(wert << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const bereinigt = s.toUpperCase().replace(/[\s=]/g, "");
  let bits = 0;
  let wert = 0;
  const bytes: number[] = [];
  for (const zeichen of bereinigt) {
    const idx = ALPHABET.indexOf(zeichen);
    if (idx < 0) throw new Error("Ungültiges Base32-Zeichen.");
    wert = (wert << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((wert >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ── TOTP ─────────────────────────────────────────────────────────────────────

/** 20 Zufalls-Bytes (RFC-4226-Empfehlung für SHA-1), Base32-kodiert. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Der 6-stellige Code für ein bestimmtes Zeitfenster. */
export function totpCode(secretBase32: string, unixSekunden: number): string {
  const zaehler = Math.floor(unixSekunden / SCHRITT_SEKUNDEN);
  const puffer = Buffer.alloc(8);
  // Der Zähler ist ein 64-Bit-Big-Endian-Wert; für reale Zeiten genügt die
  // untere Hälfte plus Übertrag in die obere.
  puffer.writeUInt32BE(Math.floor(zaehler / 2 ** 32), 0);
  puffer.writeUInt32BE(zaehler >>> 0, 4);
  const mac = createHmac("sha1", base32Decode(secretBase32)).update(puffer).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const auszug =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];
  return String(auszug % 10 ** ZIFFERN).padStart(ZIFFERN, "0");
}

/**
 * Prüft einen eingegebenen Code — konstantzeitig, mit einem Fenster von
 * ±1 Schritt (30 s) für Uhrenabweichung zwischen Handy und Server. Mehr
 * Toleranz weicht die Zwei-Faktor-Eigenschaft auf, weniger sperrt Nutzer mit
 * leicht falsch gehender Uhr grundlos aus.
 */
export function verifyTotp(
  secretBase32: string,
  eingabe: string,
  unixSekunden: number = Math.floor(Date.now() / 1000),
): boolean {
  const bereinigt = eingabe.replace(/\s/g, "");
  if (!/^\d{6}$/.test(bereinigt)) return false;
  const eingabeBuf = Buffer.from(bereinigt);
  let gueltig = false;
  for (const versatz of [-1, 0, 1]) {
    const erwartet = Buffer.from(
      totpCode(secretBase32, unixSekunden + versatz * SCHRITT_SEKUNDEN),
    );
    // Kein früher Ausstieg: alle drei Fenster werden immer geprüft.
    if (timingSafeEqual(eingabeBuf, erwartet)) gueltig = true;
  }
  return gueltig;
}

/** otpauth-URL für den QR-Code der Authenticator-Apps. */
export function otpauthUrl(secretBase32: string, konto: string, aussteller: string): string {
  const label = encodeURIComponent(`${aussteller}:${konto}`);
  const issuer = encodeURIComponent(aussteller);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=${ZIFFERN}&period=${SCHRITT_SEKUNDEN}`;
}
