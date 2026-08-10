import { describe, expect, it } from "vitest";
import type { PageviewRow } from "./first-party";
import {
  geraete,
  quelleVon,
  quellen,
  summen,
  tagesReihe,
  topSeiten,
  vergleichsText,
} from "./first-party";
import { parseZeitraum } from "./zeitraum";

function row(overrides: Omit<Partial<PageviewRow>, "ts"> & { ts: string }): PageviewRow {
  return {
    visitorHash: "v1",
    path: "/",
    referrer: null,
    utmSource: null,
    utmMedium: null,
    device: "desktop",
    country: "DE",
    ...overrides,
    ts: new Date(overrides.ts),
  };
}

const HEUTE = new Date("2026-08-10T12:00:00Z");

describe("tagesReihe", () => {
  it("richtet an allen Tagen des Zeitraums aus, Lücken sind 0", () => {
    const z = parseZeitraum({ zeitraum: "7" }, HEUTE); // 03.08.–09.08.
    const punkte = tagesReihe(
      [
        row({ ts: "2026-08-03T08:00:00Z", visitorHash: "a" }),
        row({ ts: "2026-08-03T09:00:00Z", visitorHash: "a" }),
        row({ ts: "2026-08-03T10:00:00Z", visitorHash: "b" }),
        row({ ts: "2026-08-09T23:30:00Z", visitorHash: "c" }),
      ],
      z,
    );
    expect(punkte).toHaveLength(7);
    expect(punkte[0]).toMatchObject({ tag: "2026-08-03", pageviews: 3, besucher: 2 });
    expect(punkte[1]).toMatchObject({ pageviews: 0, besucher: 0 });
    expect(punkte[6]).toMatchObject({ tag: "2026-08-09", pageviews: 1, besucher: 1 });
    expect(punkte[0].label).toBe("03.08.");
  });
});

describe("summen", () => {
  it("zählt Aufrufe und eindeutige Besucher", () => {
    const s = summen([
      row({ ts: "2026-08-03T08:00:00Z", visitorHash: "a" }),
      row({ ts: "2026-08-03T09:00:00Z", visitorHash: "a" }),
      row({ ts: "2026-08-04T09:00:00Z", visitorHash: "b" }),
    ]);
    expect(s).toEqual({ pageviews: 3, besucher: 2 });
  });
});

describe("topSeiten", () => {
  it("sortiert nach Aufrufen und deckelt auf n", () => {
    const rows = [
      row({ ts: "2026-08-03T08:00:00Z", path: "/preise", visitorHash: "a" }),
      row({ ts: "2026-08-03T08:01:00Z", path: "/preise", visitorHash: "b" }),
      row({ ts: "2026-08-03T08:02:00Z", path: "/", visitorHash: "a" }),
      row({ ts: "2026-08-03T08:03:00Z", path: "/funktionen", visitorHash: "a" }),
    ];
    const top = topSeiten(rows, 2);
    expect(top).toHaveLength(2);
    expect(top[0]).toEqual({ name: "/preise", pageviews: 2, besucher: 2 });
  });
});

describe("quelleVon / quellen", () => {
  it("UTM gewinnt vor Referrer, Referrer vor direkt", () => {
    expect(quelleVon({ utmSource: "google", utmMedium: "cpc", referrer: "t3n.de/news" })).toBe(
      "google / cpc",
    );
    expect(quelleVon({ utmSource: null, utmMedium: null, referrer: "t3n.de/news" })).toBe("t3n.de");
    expect(quelleVon({ utmSource: null, utmMedium: null, referrer: null })).toBe("direkt");
  });

  it("gruppiert nach Quelle", () => {
    const rows = [
      row({ ts: "2026-08-03T08:00:00Z", utmSource: "google", utmMedium: "cpc", visitorHash: "a" }),
      row({ ts: "2026-08-03T08:01:00Z", referrer: "www.google.com/search", visitorHash: "b" }),
      row({ ts: "2026-08-03T08:02:00Z", visitorHash: "c" }),
    ];
    const q = quellen(rows);
    expect(q.map((z) => z.name).sort()).toEqual(["direkt", "google / cpc", "www.google.com"]);
  });
});

describe("geraete", () => {
  it("fehlende Geräte-Angabe wird als unbekannt geführt", () => {
    const g = geraete([
      row({ ts: "2026-08-03T08:00:00Z", device: "mobil" }),
      row({ ts: "2026-08-03T08:01:00Z", device: null }),
    ]);
    expect(g.map((z) => z.name).sort()).toEqual(["mobil", "unbekannt"]);
  });
});

describe("vergleichsText", () => {
  it("formatiert Zuwachs, Rückgang und Stillstand", () => {
    expect(vergleichsText(112, 100)).toBe("+12 % vs. Vorperiode");
    expect(vergleichsText(92, 100)).toBe("−8 % vs. Vorperiode");
    expect(vergleichsText(100, 100)).toBe("±0 % vs. Vorperiode");
  });

  it("leere Vorperiode ergibt keinen Vergleich", () => {
    expect(vergleichsText(50, 0)).toBeNull();
  });
});
