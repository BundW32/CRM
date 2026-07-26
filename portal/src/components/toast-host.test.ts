import { describe, expect, it } from "vitest";
import { naechsteToasts } from "./toast-host";

const gespeichert = { text: "Gespeichert.", tone: "success" as const };
const geloescht = { text: "Gelöscht.", tone: "success" as const };
const hinweis = { text: "Gespeichert.", tone: "info" as const };

let id = 0;
const naechste = () => id++;

describe("naechsteToasts", () => {
  it("nimmt die erste Meldung auf", () => {
    const r = naechsteToasts([], gespeichert, naechste());
    expect(r).toHaveLength(1);
    expect(r[0].anzahl).toBe(1);
  });

  it("fasst dieselbe Meldung zusammen, statt zu stapeln", () => {
    let r = naechsteToasts([], gespeichert, naechste());
    r = naechsteToasts(r, gespeichert, naechste());
    r = naechsteToasts(r, gespeichert, naechste());
    expect(r).toHaveLength(1);
    expect(r[0].anzahl).toBe(3);
  });

  it("erneuert beim Zusammenfassen die id – sonst liefe der Ablauf weiter", () => {
    const erst = naechsteToasts([], gespeichert, naechste());
    const dann = naechsteToasts(erst, gespeichert, naechste());
    expect(dann[0].id).not.toBe(erst[0].id);
  });

  it("fasst nur zusammen, was wirklich gleich ist", () => {
    let r = naechsteToasts([], gespeichert, naechste());
    r = naechsteToasts(r, geloescht, naechste());
    expect(r).toHaveLength(2);

    // Gleicher Text, anderer Tonfall – bleibt getrennt.
    let s = naechsteToasts([], gespeichert, naechste());
    s = naechsteToasts(s, hinweis, naechste());
    expect(s).toHaveLength(2);
  });

  it("fasst nur mit der JÜNGSTEN Karte zusammen", () => {
    // Sonst spränge ein Zähler oben in der Liste hoch, während unten Neues
    // erscheint – die Reihenfolge wäre nicht mehr nachvollziehbar.
    let r = naechsteToasts([], gespeichert, naechste());
    r = naechsteToasts(r, geloescht, naechste());
    r = naechsteToasts(r, gespeichert, naechste());
    expect(r).toHaveLength(3);
    expect(r.map((t) => t.anzahl)).toEqual([1, 1, 1]);
  });

  it("zeigt höchstens drei und wirft den ältesten hinaus", () => {
    let r: ReturnType<typeof naechsteToasts> = [];
    for (const text of ["A", "B", "C", "D"]) {
      r = naechsteToasts(r, { text, tone: "success" }, naechste());
    }
    expect(r.map((t) => t.text)).toEqual(["B", "C", "D"]);
  });

  it("behält die neueste Meldung – sie gehört zur gerade ausgelösten Aktion", () => {
    let r: ReturnType<typeof naechsteToasts> = [];
    for (const text of ["A", "B", "C", "D", "E"]) {
      r = naechsteToasts(r, { text, tone: "success" }, naechste());
    }
    expect(r[r.length - 1].text).toBe("E");
  });
});
