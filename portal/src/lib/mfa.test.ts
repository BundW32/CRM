import { describe, expect, it } from "vitest";
import {
  hashEmailMfaCode,
  hashRecoveryCode,
  loeseRecoveryCodeEin,
  neueRecoveryCodes,
  neuerEmailMfaCode,
  neuerRecoveryCode,
  normalisiereRecoveryCode,
  pruefeEmailMfaCode,
} from "./mfa";

describe("E-Mail-Codes", () => {
  const jetzt = new Date("2026-08-10T12:00:00Z");

  it("sind 6 Ziffern, auch mit führenden Nullen", () => {
    for (let i = 0; i < 50; i++) {
      expect(neuerEmailMfaCode()).toMatch(/^\d{6}$/);
    }
  });

  it("passen gegen ihren Hash, solange der Ablauf nicht erreicht ist", () => {
    const code = "042137";
    const user = {
      mfaEmailCodeHash: hashEmailMfaCode(code),
      mfaEmailCodeExpiresAt: new Date(jetzt.getTime() + 60_000),
    };
    expect(pruefeEmailMfaCode(user, code, jetzt)).toBe(true);
    // Leerzeichen aus der Mail kopiert: „042 137".
    expect(pruefeEmailMfaCode(user, "042 137", jetzt)).toBe(true);
    expect(pruefeEmailMfaCode(user, "042138", jetzt)).toBe(false);
  });

  it("lehnen abgelaufene Codes ab", () => {
    const code = "042137";
    const user = {
      mfaEmailCodeHash: hashEmailMfaCode(code),
      mfaEmailCodeExpiresAt: new Date(jetzt.getTime() - 1_000),
    };
    expect(pruefeEmailMfaCode(user, code, jetzt)).toBe(false);
  });

  it("lehnen ab, wenn kein Code gespeichert ist", () => {
    expect(
      pruefeEmailMfaCode({ mfaEmailCodeHash: null, mfaEmailCodeExpiresAt: null }, "042137", jetzt),
    ).toBe(false);
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
