import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";

beforeAll(() => {
  process.env.INTEGRATION_ENC_KEY = "test-encryption-key-0123456789abcdef";
});

describe("encryptSecret / decryptSecret", () => {
  it("verschlüsselt und entschlüsselt verlustfrei", () => {
    const secret = "finapi_live_sk_9f8e7d6c5b4a";
    const enc = encryptSecret(secret);
    expect(enc).not.toContain(secret);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptSecret(enc)).toBe(secret);
  });

  it("erzeugt bei gleichem Klartext unterschiedliche Chiffren (zufällige IV)", () => {
    expect(encryptSecret("abc")).not.toBe(encryptSecret("abc"));
  });

  it("wirft bei manipuliertem Chiffrat", () => {
    const enc = encryptSecret("geheim");
    const parts = enc.split(":");
    parts[3] = Buffer.from("manipuliert").toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("wirft bei ungültigem Format", () => {
    expect(() => decryptSecret("kein-gueltiges-format")).toThrow();
  });
});

describe("maskSecret", () => {
  it("zeigt nur die letzten vier Zeichen", () => {
    expect(maskSecret("supersecret1234")).toBe("••••1234");
    expect(maskSecret("abc")).toBe("••••");
  });
});
