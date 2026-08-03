import { describe, expect, it } from "vitest";
import { pageHrefFor } from "./list-query";

describe("pageHrefFor", () => {
  it("trägt alle aktiven Filter beim Blättern mit", () => {
    const href = pageHrefFor("/vorgaenge", { q: "dach", status: "OFFEN", objekt: "p1" });
    expect(href(2)).toBe("/vorgaenge?q=dach&status=OFFEN&objekt=p1&page=2");
  });

  it("lässt Seite 1 ohne Param – der Standardfall bleibt eine saubere URL", () => {
    expect(pageHrefFor("/vorgaenge", { q: "dach" })(1)).toBe("/vorgaenge?q=dach");
    expect(pageHrefFor("/vorgaenge", {})(1)).toBe("/vorgaenge");
  });

  it("übernimmt die alte Seitenzahl nicht in den neuen Link", () => {
    expect(pageHrefFor("/vorgaenge", { page: "7", q: "dach" })(2)).toBe("/vorgaenge?q=dach&page=2");
  });

  it("überspringt leere Werte", () => {
    expect(pageHrefFor("/vorgaenge", { q: "", status: undefined, objekt: "p1" })(3)).toBe(
      "/vorgaenge?objekt=p1&page=3",
    );
  });

  it("kodiert Sonderzeichen aus der Suche", () => {
    expect(pageHrefFor("/objekte", { q: "Kieferstraße 12" })(2)).toBe(
      "/objekte?q=Kieferstra%C3%9Fe+12&page=2",
    );
  });

  // Seiten mit mehreren Listen: jede blättert über ihren eigenen Param, und der
  // Link der einen darf die Seitenzahl der anderen nicht verlieren.
  it("hält bei mehreren Listen die Seitenzahlen auseinander", () => {
    const sp = { mseite: "3", aseite: "5", q: "müller" };
    expect(pageHrefFor("/hausgeld", sp, "mseite")(4)).toBe("/hausgeld?aseite=5&q=m%C3%BCller&mseite=4");
    expect(pageHrefFor("/hausgeld", sp, "aseite")(2)).toBe("/hausgeld?mseite=3&q=m%C3%BCller&aseite=2");
  });
});
