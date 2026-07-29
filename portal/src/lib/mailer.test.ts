import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDING, emailLinkColor, onBrandTextColor } from "./branding";
import { extractCallToAction, renderHtml, summarizeMail } from "./mailer";

describe("extractCallToAction", () => {
  it("löst die Abschlusszeile als Aufforderung heraus", () => {
    const { before, after, cta } = extractCallToAction(
      "Es gibt Neues.\n\nZum Vorgang: https://portal.example/vorgaenge/42",
    );
    expect(cta).toEqual({ label: "Zum Vorgang", url: "https://portal.example/vorgaenge/42" });
    expect(before).toBe("Es gibt Neues.");
    expect(after).toBe("");
  });

  it("nimmt die letzte Linkzeile – sie ist die eigentliche Aufforderung", () => {
    const { before, cta } = extractCallToAction(
      "Anmeldung: https://portal.example/login\nZum Vorgang: https://portal.example/v/1",
    );
    expect(cta?.url).toBe("https://portal.example/v/1");
    // Der übrige Link bleibt im Text stehen und wird dort verlinkt
    expect(before).toContain("https://portal.example/login");
  });

  it("lässt Text ohne Linkzeile unverändert", () => {
    const text = "Guten Tag,\n\nIhr Zugang wurde angelegt.";
    expect(extractCallToAction(text)).toEqual({ before: text, after: "", cta: null });
  });

  it("greift nicht bei einer Linkzeile ohne Beschriftung", () => {
    expect(extractCallToAction("https://portal.example/x").cta).toBeNull();
  });

  it("behält den Text nach der Linkzeile – die Grußformel bleibt am Ende", () => {
    const { before, after, cta } = extractCallToAction(
      "Es gibt Neues.\n\nZum Vorgang: https://portal.example/v/1\n\nMit freundlichen Grüßen\nMuster GmbH",
    );
    expect(cta?.label).toBe("Zum Vorgang");
    expect(before).toBe("Es gibt Neues.");
    expect(after).toBe("Mit freundlichen Grüßen\nMuster GmbH");
  });
});

describe("renderHtml", () => {
  const branding = { ...DEFAULT_BRANDING, email: "info@example.de" };

  it("baut aus der Abschlusszeile einen Knopf", () => {
    const html = renderHtml("Betreff", "Text\n\nZum Vorgang: https://portal.example/v/1", branding);
    expect(html).toContain('href="https://portal.example/v/1"');
    expect(html).toContain("Zum Vorgang</a>");
  });

  it("escaped Nutzertext auch im Preheader", () => {
    const html = renderHtml("Betreff", "<script>alert(1)</script>", branding);
    expect(html).not.toContain("<script>");
  });

  it("nutzt die Akzentfarbe des Mandanten, nicht eine feste Farbe", () => {
    const html = renderHtml("Betreff", "Text", { ...branding, primaryColor: "#123456" });
    expect(html).toContain("#123456");
  });

  it("zeigt die Kontaktdaten des Mandanten in der Fußzeile", () => {
    const html = renderHtml("Betreff", "Text", {
      ...branding,
      legalName: "Hausverwaltung Muster GmbH",
    });
    expect(html).toContain("Hausverwaltung Muster GmbH");
    expect(html).not.toContain("B&amp;W Immobilien Management UG");
  });
});

describe("emailLinkColor", () => {
  it("dunkelt die Marke ab, bis sie auf Weiß lesbar ist (WCAG AA)", () => {
    // Das Marken-Orange selbst kommt nur auf ~2:1 – als Link unbrauchbar.
    expect(emailLinkColor("#f69018")).not.toBe("#f69018");
  });

  it("lässt eine ohnehin dunkle Farbe unangetastet", () => {
    expect(emailLinkColor("#0c534a")).toBe("#0c534a");
  });
});

describe("onBrandTextColor", () => {
  it("setzt dunkle Schrift auf helle Marken", () => {
    expect(onBrandTextColor("#ffe066")).toBe("#111827");
  });

  it("setzt weiße Schrift auf dunkle Marken", () => {
    expect(onBrandTextColor("#0c534a")).toBe("#ffffff");
  });
});

describe("summarizeMail", () => {
  it("zählt nur, was wirklich rausging", () => {
    expect(summarizeMail(["sent", "no_recipient", "sent", "failed"])).toEqual({
      sent: 2,
      disabled: false,
    });
  });

  it("meldet fehlende SMTP-Einrichtung getrennt von 'nichts versandt'", () => {
    expect(summarizeMail(["disabled", "disabled"]).disabled).toBe(true);
    // Gemischt ist NICHT „deaktiviert" – dann lief der Versand ja grundsätzlich.
    expect(summarizeMail(["disabled", "sent"]).disabled).toBe(false);
  });

  it("meldet bei leerer Empfängerliste keine Deaktivierung", () => {
    expect(summarizeMail([])).toEqual({ sent: 0, disabled: false });
  });
});
