import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INVOICE_TRANSITIONS,
  computeTrialEnd,
  formatCents,
  formatInvoiceNumber,
  invoiceGrossCents,
  isPlatformAdminUser,
  parseAdminAllowlist,
  trialDays,
} from "./platform";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseAdminAllowlist", () => {
  it("gibt bei undefined/leer eine leere Liste zurück", () => {
    expect(parseAdminAllowlist(undefined)).toEqual([]);
    expect(parseAdminAllowlist(null)).toEqual([]);
    expect(parseAdminAllowlist("")).toEqual([]);
    expect(parseAdminAllowlist("  ,  , ")).toEqual([]);
  });
  it("trimmt, kleinschreibt und filtert leere Einträge", () => {
    expect(parseAdminAllowlist(" A@x.de , B@Y.DE ,")).toEqual(["a@x.de", "b@y.de"]);
  });
});

describe("isPlatformAdminUser", () => {
  it("erlaubt nur E-Mails aus der Allowlist (case-insensitiv)", () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "chef@bw.de");
    expect(isPlatformAdminUser({ email: "Chef@BW.de", isPlatformAdmin: true })).toBe(true);
    expect(isPlatformAdminUser({ email: "andere@bw.de", isPlatformAdmin: true })).toBe(false);
    expect(isPlatformAdminUser({ email: null, isPlatformAdmin: true })).toBe(false);
  });
  it("ohne Env-Allowlist immer false", () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "");
    expect(isPlatformAdminUser({ email: "chef@bw.de", isPlatformAdmin: true })).toBe(false);
  });
  it("ohne Datenbank-Flag immer false – auch mit passender Adresse", () => {
    // Der Angriff, den diese Wand abwehrt: Ein Verwalter legt in seiner eigenen
    // Organisation einen Nutzer auf eine Betreiber-Adresse an und vergibt das
    // Passwort selbst. Das Flag kann er dabei nicht setzen.
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "chef@bw.de");
    expect(isPlatformAdminUser({ email: "chef@bw.de", isPlatformAdmin: false })).toBe(false);
    expect(isPlatformAdminUser({ email: "chef@bw.de" })).toBe(false);
  });
});

describe("trialDays", () => {
  it("90 Tage über HausMatch, sonst 30", () => {
    expect(trialDays("hausmatch")).toBe(90);
    expect(trialDays(null)).toBe(30);
    expect(trialDays("google")).toBe(30);
  });
});

describe("computeTrialEnd", () => {
  const now = new Date("2026-07-03T12:00:00Z");
  it("verlängert ab jetzt, wenn kein/abgelaufenes Ende", () => {
    expect(computeTrialEnd(null, now, 30)).toEqual(new Date("2026-08-02T12:00:00Z"));
    expect(computeTrialEnd(new Date("2026-01-01T00:00:00Z"), now, 30)).toEqual(
      new Date("2026-08-02T12:00:00Z"),
    );
  });
  it("verlängert ab dem noch laufenden Ende (verkürzt nie)", () => {
    const future = new Date("2026-09-01T00:00:00Z");
    expect(computeTrialEnd(future, now, 30)).toEqual(new Date("2026-10-01T00:00:00Z"));
  });
});

describe("formatInvoiceNumber", () => {
  it("BW-JAHR-NNNN mit führenden Nullen", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("BW-2026-0001");
    expect(formatInvoiceNumber(2026, 1234)).toBe("BW-2026-1234");
    expect(formatInvoiceNumber(2026, 12345)).toBe("BW-2026-12345");
  });
});

describe("formatCents", () => {
  it("deutsche Währungsdarstellung", () => {
    expect(formatCents(123450)).toMatch(/1\.234,50/);
    expect(formatCents(0)).toMatch(/0,00/);
  });
});

describe("invoiceGrossCents", () => {
  it("summiert Positionen und schlägt USt auf", () => {
    // 2 × 4900 + 1 × 1000 = 10800 netto; 19% = 2052; brutto 12852.
    expect(
      invoiceGrossCents(19, [
        { quantity: 2, unitPriceCents: 4900 },
        { quantity: 1, unitPriceCents: 1000 },
      ]),
    ).toBe(12852);
  });
  it("0% USt = netto", () => {
    expect(invoiceGrossCents(0, [{ quantity: 1, unitPriceCents: 5000 }])).toBe(5000);
  });
});

describe("INVOICE_TRANSITIONS", () => {
  it("erlaubt sinnvolle Übergänge und sperrt Endzustände", () => {
    expect(INVOICE_TRANSITIONS.ENTWURF).toContain("OFFEN");
    expect(INVOICE_TRANSITIONS.OFFEN).toContain("BEZAHLT");
    expect(INVOICE_TRANSITIONS.ENTWURF).not.toContain("BEZAHLT");
    expect(INVOICE_TRANSITIONS.BEZAHLT).toEqual([]);
    expect(INVOICE_TRANSITIONS.STORNIERT).toEqual([]);
  });
});
