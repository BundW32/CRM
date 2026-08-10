import { describe, expect, it } from "vitest";
import {
  bereinigeReferrer,
  geraetAusUserAgent,
  istBot,
  parsePageview,
  sessionFenster,
} from "./tracking";

describe("istBot", () => {
  it("erkennt gängige Crawler und Werkzeuge", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "curl/8.5.0",
      "python-requests/2.31",
      "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0",
      "WhatsApp/2.23.20",
    ]) {
      expect(istBot(ua), ua).toBe(true);
    }
  });

  it("lässt echte Browser durch", () => {
    for (const ua of [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
    ]) {
      expect(istBot(ua), ua).toBe(false);
    }
  });

  it("ohne User-Agent gilt: kein Browser", () => {
    expect(istBot(null)).toBe(true);
    expect(istBot("")).toBe(true);
  });
});

describe("geraetAusUserAgent", () => {
  it("unterscheidet mobil, Tablet und Desktop", () => {
    expect(
      geraetAusUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile Safari"),
    ).toBe("mobil");
    // Android-Telefon trägt "Mobile", Android-Tablet nicht.
    expect(geraetAusUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari")).toBe(
      "mobil",
    );
    expect(geraetAusUserAgent("Mozilla/5.0 (Linux; Android 14; SM-X710) Safari")).toBe("tablet");
    expect(geraetAusUserAgent("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) Safari")).toBe(
      "tablet",
    );
    expect(geraetAusUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0")).toBe(
      "desktop",
    );
  });
});

describe("bereinigeReferrer", () => {
  it("behält Host + Pfad, verwirft Query und Fragment", () => {
    expect(
      bereinigeReferrer("https://www.google.com/search?q=weg+verwaltung#top", "www.wegportal24.de"),
    ).toBe("www.google.com/search");
  });

  it("wird bei internem Referrer zu null", () => {
    expect(
      bereinigeReferrer("https://www.wegportal24.de/preise", "www.wegportal24.de"),
    ).toBeNull();
  });

  it("verwirft Unbrauchbares", () => {
    expect(bereinigeReferrer("", "host")).toBeNull();
    expect(bereinigeReferrer("kein-url", "host")).toBeNull();
    expect(bereinigeReferrer("javascript:alert(1)", "host")).toBeNull();
  });

  it("Wurzelpfad erscheint ohne Schrägstrich", () => {
    expect(bereinigeReferrer("https://t3n.de/", "www.wegportal24.de")).toBe("t3n.de");
  });
});

describe("parsePageview", () => {
  it("nimmt eine gültige Snippet-Nutzlast an", () => {
    const p = parsePageview(
      JSON.stringify({
        t: "pageview",
        p: "/preise",
        r: "https://www.google.com/",
        w: 1440,
        us: "google",
        um: "cpc",
        uc: "weg-2026",
      }),
    );
    expect(p).toEqual({
      path: "/preise",
      referrer: "https://www.google.com/",
      breite: 1440,
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "weg-2026",
    });
  });

  it("weist andere Typen als pageview ab — Funnel-Ereignisse sind serverseitig", () => {
    expect(parsePageview(JSON.stringify({ t: "subscribed", p: "/" }))).toBeNull();
  });

  it("weist kaputte oder übergroße Nutzlasten ab", () => {
    expect(parsePageview("kein json")).toBeNull();
    expect(parsePageview(JSON.stringify({ t: "pageview", p: "ohne-slash" }))).toBeNull();
    expect(parsePageview(JSON.stringify({ t: "pageview", p: "/x".repeat(200) }))).toBeNull();
    expect(parsePageview("x".repeat(5000))).toBeNull();
  });

  it("fehlende Kür-Felder werden zu null", () => {
    const p = parsePageview(JSON.stringify({ t: "pageview", p: "/" }));
    expect(p).toEqual({
      path: "/",
      referrer: null,
      breite: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });
  });
});

describe("sessionFenster", () => {
  it("wechselt alle 30 Minuten", () => {
    const a = sessionFenster(new Date("2026-08-10T10:00:00Z"));
    const b = sessionFenster(new Date("2026-08-10T10:29:59Z"));
    const c = sessionFenster(new Date("2026-08-10T10:30:00Z"));
    expect(a).toBe(b);
    expect(c).toBe(a + 1);
  });
});
