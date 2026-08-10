import { describe, expect, it } from "vitest";
import {
  hashRecoveryCode,
  istMfaPflicht,
  loeseRecoveryCodeEin,
  neueRecoveryCodes,
  neuerRecoveryCode,
  normalisiereRecoveryCode,
} from "./mfa";

describe("istMfaPflicht", () => {
  const basis = { email: "x@example.de", isPlatformAdmin: false };

  it("gilt für Verwalter-SuperAdmins", () => {
    expect(istMfaPflicht({ ...basis, role: "VERWALTER", isSuperAdmin: true })).toBe(true);
  });

  it("gilt nicht für gewöhnliche Verwalter, Eigentümer, Mieter", () => {
    expect(istMfaPflicht({ ...basis, role: "VERWALTER", isSuperAdmin: false })).toBe(false);
    expect(istMfaPflicht({ ...basis, role: "EIGENTUEMER", isSuperAdmin: false })).toBe(false);
    expect(istMfaPflicht({ ...basis, role: "MIETER", isSuperAdmin: false })).toBe(false);
  });

  it("gilt nicht für einen SuperAdmin-MIETER (den es nicht geben sollte)", () => {
    // Die Pflicht hängt an Rolle UND Flag — ein fehlerhaft gesetztes Flag auf
    // einer Nicht-Verwalter-Rolle erzwingt keine MFA-Sackgasse für Laien.
    expect(istMfaPflicht({ ...basis, role: "EIGENTUEMER", isSuperAdmin: true })).toBe(false);
  });
});

describe("Recovery-Codes", () => {
  it("haben das Format XXXXX-XXXXX ohne verwechselbare Zeichen", () => {
    for (let i = 0; i < 20; i++) {
      expect(neuerRecoveryCode()).toMatch(/^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
    }
  });

  it("werden als Satz von 10 erzeugt, ohne Dubletten", () => {
    const codes = neueRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it("normalisieren tolerant: klein, Leerzeichen, ohne Strich", () => {
    expect(normalisiereRecoveryCode("abcde fghjk")).toBe("ABCDE-FGHJK");
    expect(normalisiereRecoveryCode("abcdefghjk")).toBe("ABCDE-FGHJK");
    expect(normalisiereRecoveryCode(" ABCDE-FGHJK ")).toBe("ABCDE-FGHJK");
  });

  it("lösen genau einmal ein und entfernen den verbrauchten Hash", () => {
    const codes = neueRecoveryCodes();
    const hashes = codes.map(hashRecoveryCode);

    const rest = loeseRecoveryCodeEin(hashes, codes[3].toLowerCase());
    expect(rest).not.toBeNull();
    expect(rest).toHaveLength(9);

    // Zweite Einlösung desselben Codes gegen die Restliste: verbraucht.
    expect(loeseRecoveryCodeEin(rest!, codes[3])).toBeNull();
    // Ein anderer Code geht weiterhin.
    expect(loeseRecoveryCodeEin(rest!, codes[0])).toHaveLength(8);
  });

  it("lehnen unbekannte Eingaben ab", () => {
    const hashes = neueRecoveryCodes().map(hashRecoveryCode);
    expect(loeseRecoveryCodeEin(hashes, "AAAAA-AAAAA")).toBeNull();
    expect(loeseRecoveryCodeEin(hashes, "")).toBeNull();
  });
});
