import { describe, expect, it } from "vitest";
import {
  baueOpos,
  oposBucketFor,
  schlageZuordnungVor,
  sortiereNachTilgungsreihenfolge,
  type OffenerPosten,
  type Tilgungszweck,
} from "./payment-allocation";

const tag = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const stichtag = tag("2026-07-27");

const posten = (
  id: string,
  datum: string,
  haupt: number,
  extra: Partial<{ kostenCents: number; zinsenCents: number; gemahnt: boolean; quelle: Tilgungszweck }> = {},
): OffenerPosten => ({
  id,
  dueDate: tag(datum),
  hauptCents: haupt,
  quelle: "WIRTSCHAFTSPLAN",
  ...extra,
});

describe("sortiereNachTilgungsreihenfolge (§ 366 Abs. 2 BGB)", () => {
  it("fällige vor nicht fälligen", () => {
    const r = sortiereNachTilgungsreihenfolge(
      [posten("kuenftig", "2026-09-01", 100), posten("faellig", "2026-06-01", 100)],
      stichtag,
    );
    expect(r.map((p) => p.id)).toEqual(["faellig", "kuenftig"]);
  });

  it("die gemahnte Forderung ist die lästigere und kommt zuerst", () => {
    const r = sortiereNachTilgungsreihenfolge(
      [posten("alt", "2026-01-01", 100), posten("gemahnt", "2026-05-01", 100, { gemahnt: true })],
      stichtag,
    );
    expect(r.map((p) => p.id)).toEqual(["gemahnt", "alt"]);
  });

  it("bei gleicher Lästigkeit die ältere zuerst", () => {
    const r = sortiereNachTilgungsreihenfolge(
      [posten("neu", "2026-05-01", 100), posten("alt", "2026-01-01", 100)],
      stichtag,
    );
    expect(r.map((p) => p.id)).toEqual(["alt", "neu"]);
  });

  it("gleiches Datum ergibt eine reproduzierbare Reihenfolge", () => {
    const a = sortiereNachTilgungsreihenfolge([posten("b", "2026-01-01", 1), posten("a", "2026-01-01", 1)], stichtag);
    const b = sortiereNachTilgungsreihenfolge([posten("a", "2026-01-01", 1), posten("b", "2026-01-01", 1)], stichtag);
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });
});

describe("schlageZuordnungVor", () => {
  it("tilgt die älteste Forderung zuerst und teilt den Rest auf die nächste", () => {
    const v = schlageZuordnungVor(
      15_000,
      [posten("jan", "2026-01-01", 10_000), posten("feb", "2026-02-01", 10_000)],
      stichtag,
    );
    expect(v.zuordnungen).toEqual([
      { duePostingId: "jan", betragCents: 10_000, aufKostenCents: 0, aufZinsenCents: 0, aufHauptCents: 10_000 },
      { duePostingId: "feb", betragCents: 5_000, aufKostenCents: 0, aufZinsenCents: 0, aufHauptCents: 5_000 },
    ]);
    expect(v.restCents).toBe(0);
  });

  it("§ 367: Kosten, dann Zinsen, dann Hauptforderung", () => {
    const v = schlageZuordnungVor(
      5_000,
      [posten("jan", "2026-01-01", 10_000, { kostenCents: 500, zinsenCents: 300 })],
      stichtag,
    );
    expect(v.zuordnungen[0]).toMatchObject({
      aufKostenCents: 500,
      aufZinsenCents: 300,
      aufHauptCents: 4_200,
      betragCents: 5_000,
    });
  });

  it("eine Vorauszahlung bleibt Guthaben und tilgt nichts Künftiges", () => {
    // Genau der Befund: Wer im Dezember das nächste Jahr überweist, hatte
    // rechnerisch keinen Rückstand mehr — obwohl der November offen blieb.
    const v = schlageZuordnungVor(
      50_000,
      [posten("nov", "2026-06-01", 10_000), posten("kuenftig", "2026-12-01", 10_000)],
      stichtag,
    );
    expect(v.zuordnungen.map((z) => z.duePostingId)).toEqual(["nov"]);
    expect(v.restCents).toBe(40_000);
  });

  it("ordnet nie mehr zu, als gezahlt wurde", () => {
    const v = schlageZuordnungVor(
      700,
      [posten("a", "2026-01-01", 10_000), posten("b", "2026-02-01", 10_000)],
      stichtag,
    );
    expect(v.zuordnungen.reduce((s, z) => s + z.betragCents, 0)).toBe(700);
    expect(v.restCents).toBe(0);
  });

  it("§ 366 Abs. 1: die Tilgungsbestimmung geht der gesetzlichen Reihenfolge vor", () => {
    // Ohne Bestimmung tilgt die Zahlung das ältere Hausgeld — mit Bestimmung
    // („Sonderumlage Dachsanierung" im Verwendungszweck) nur die Umlage.
    const offen = [
      posten("hausgeld-mai", "2026-05-01", 20_000),
      posten("umlage", "2026-06-01", 100_000, { quelle: "SONDERUMLAGE" }),
    ];
    expect(schlageZuordnungVor(100_000, offen, stichtag).zuordnungen[0].duePostingId).toBe("hausgeld-mai");
    const bestimmt = schlageZuordnungVor(100_000, offen, stichtag, "SONDERUMLAGE");
    expect(bestimmt.zuordnungen).toHaveLength(1);
    expect(bestimmt.zuordnungen[0]).toMatchObject({ duePostingId: "umlage", betragCents: 100_000 });
  });

  it("ohne offene Forderung bleibt alles Guthaben", () => {
    expect(schlageZuordnungVor(1_000, [], stichtag)).toEqual({ zuordnungen: [], restCents: 1_000 });
  });

  it("weist einen negativen Betrag zurück", () => {
    expect(() => schlageZuordnungVor(-1, [], stichtag)).toThrow();
  });
});

describe("Offene Posten mit Altersstruktur", () => {
  it("ordnet nach Tagen seit Fälligkeit ein", () => {
    expect(oposBucketFor(tag("2026-07-01"), stichtag)).toBe("b0_30"); // 26 Tage
    expect(oposBucketFor(tag("2026-06-01"), stichtag)).toBe("b31_60"); // 56 Tage
    expect(oposBucketFor(tag("2026-05-01"), stichtag)).toBe("b61_90"); // 87 Tage
    expect(oposBucketFor(tag("2026-01-01"), stichtag)).toBe("b90plus");
  });

  it("zählt nur Fälliges und merkt sich die älteste Fälligkeit", () => {
    const o = baueOpos(
      [
        { dueDate: tag("2026-07-01"), offenCents: 100 },
        { dueDate: tag("2026-01-01"), offenCents: 200 },
        { dueDate: tag("2026-12-01"), offenCents: 999 }, // noch nicht fällig
        { dueDate: tag("2026-02-01"), offenCents: 0 }, // ausgeglichen
      ],
      stichtag,
    );
    expect(o.gesamtCents).toBe(300);
    expect(o.buckets.b0_30).toBe(100);
    expect(o.buckets.b90plus).toBe(200);
    expect(o.aeltesteFaelligkeit).toEqual(tag("2026-01-01"));
  });
});
