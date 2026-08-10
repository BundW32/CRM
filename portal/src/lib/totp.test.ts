import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUrl,
  totpCode,
  verifyTotp,
} from "./totp";

// Der Standard-Testschlüssel aus RFC 6238 Anhang B: ASCII
// "12345678901234567890" → Base32.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("base32", () => {
  it("kodiert den RFC-Schlüssel wie erwartet", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("ist eine Rundreise für beliebige Bytes", () => {
    for (const laenge of [1, 5, 19, 20, 32]) {
      const buf = Buffer.from(Array.from({ length: laenge }, (_, i) => (i * 37) % 256));
      expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    }
  });

  it("verkraftet Kleinschreibung, Leerzeichen und Padding", () => {
    expect(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq==").toString("ascii")).toBe(
      "12345678901234567890",
    );
  });
});

describe("totpCode — RFC-6238-Testvektoren (SHA-1, letzte 6 der 8 Ziffern)", () => {
  // Anhang B nennt 8-stellige Codes; die 6-stellige Fassung ist deren Rest —
  // dieselben Vektoren, wie sie jede Authenticator-App erzeugt.
  const vektoren: Array<[number, string]> = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];

  for (const [zeit, erwartet] of vektoren) {
    it(`t=${zeit} → ${erwartet}`, () => {
      expect(totpCode(RFC_SECRET, zeit)).toBe(erwartet);
    });
  }
});

describe("verifyTotp", () => {
  it("akzeptiert den aktuellen Code und das Nachbarfenster", () => {
    const t = 1111111111;
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, t), t)).toBe(true);
    // ±30 s: Uhrenabweichung zwischen Handy und Server.
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, t - 30), t)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, t + 30), t)).toBe(true);
  });

  it("lehnt Codes außerhalb des Fensters ab", () => {
    const t = 1111111111;
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, t - 90), t)).toBe(false);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, t + 90), t)).toBe(false);
  });

  it("lehnt alles ab, was keine 6 Ziffern ist", () => {
    expect(verifyTotp(RFC_SECRET, "12345", 59)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "1234567", 59)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "28708a", 59)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "", 59)).toBe(false);
  });

  it("verkraftet Leerzeichen in der Eingabe (Apps zeigen '287 082')", () => {
    expect(verifyTotp(RFC_SECRET, "287 082", 59)).toBe(true);
  });
});

describe("generateTotpSecret", () => {
  it("liefert 32 Base32-Zeichen (20 Bytes) und keine Dubletten", () => {
    const a = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateTotpSecret()).not.toBe(a);
  });
});

describe("otpauthUrl", () => {
  it("baut die URL mit kodiertem Aussteller und Konto", () => {
    const url = otpauthUrl("ABC234", "info@example.de", "wegportal24");
    expect(url).toBe(
      "otpauth://totp/wegportal24%3Ainfo%40example.de?secret=ABC234&issuer=wegportal24&algorithm=SHA1&digits=6&period=30",
    );
  });
});
