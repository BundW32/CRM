import { describe, expect, it } from "vitest";
import { hashToken } from "./token-hash";

describe("hashToken", () => {
  it("liefert für denselben Rohwert immer denselben Hash", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("liefert für verschiedene Rohwerte verschiedene Hashes", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });

  it("gibt nie den Rohwert zurück", () => {
    // Der ganze Zweck: Was in der Datenbank steht, darf nicht der Link selbst
    // sein.
    expect(hashToken("mein-geheimer-token")).not.toBe("mein-geheimer-token");
  });

  it("liefert einen SHA-256-Hex-Digest (64 Zeichen)", () => {
    expect(hashToken("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});
