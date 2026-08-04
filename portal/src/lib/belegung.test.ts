import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  belegungHinweis,
  belegungSchluessel,
  belegungText,
  decodeBelegung,
  encodeBelegung,
} from "./belegung";

const WAECHTER = join(
  __dirname,
  "..",
  "app",
  "(portal)",
  "verwaltung",
  "objekte",
  "[id]",
  "bearbeiten",
  "actions.ts",
);

/**
 * Die Schlüssel eines `_count: { select: { … } }`-Blocks aus dem Quelltext.
 *
 * Der Weg über den Text ist hier der richtige: Geprüft werden soll, was der
 * Wächter **abfragt**, und das steht nur dort. Eine Attrappe der Abfrage würde
 * die eigene Erwartung prüfen, nicht den Wächter.
 */
function countSchluessel(quelle: string): string[][] {
  const bloecke: string[][] = [];
  const re = /_count:\s*\{\s*select:\s*\{([\s\S]*?)\}\s*,?\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(quelle))) {
    bloecke.push([...m[1].matchAll(/(\w+):\s*true/g)].map((t) => t[1]));
  }
  return bloecke;
}

describe("Belegung benennen", () => {
  it("nennt Anzahl und Sache statt einer Summe", () => {
    const text = belegungText("einheit", { unitOwnerships: 2, duePostings: 3, tickets: 0 });
    expect(text).toBe("2 Eigentümer, 3 Sollstellungen");
  });

  it("beugt den Singular", () => {
    expect(belegungText("einheit", { meters: 1, handovers: 1 })).toBe("1 Zähler, 1 Übergabe");
  });

  it("bleibt leer, wenn nichts belegt ist", () => {
    expect(belegungText("einheit", { tickets: 0, documents: 0 })).toBe("");
    expect(encodeBelegung("objekt", { units: 0 })).toBe("");
  });

  it("überträgt Schlüssel und Zahlen unverändert über die URL", () => {
    const counts = { unitOwnerships: 2, duePostings: 3 };
    const posten = decodeBelegung("einheit", encodeBelegung("einheit", counts));
    expect(posten.map((p) => p.text)).toEqual(["2 Eigentümer", "3 Sollstellungen"]);
  });

  it("verwirft Unbekanntes aus der Adresszeile", () => {
    // Der Katalog entscheidet, was gilt – sonst stünde beliebiger Text aus der
    // URL in der Meldung.
    expect(decodeBelegung("einheit", "<script>:9,tickets:2")).toHaveLength(1);
    expect(decodeBelegung("einheit", "tickets:keine")).toHaveLength(0);
    expect(decodeBelegung("einheit", "tickets:-3")).toHaveLength(0);
  });

  it("verspricht das Lösen nur, wo es einen Weg gibt", () => {
    // Eigentümer kann man abziehen …
    expect(belegungHinweis("einheit", { unitOwnerships: 2 })).toMatch(/danach ist das Löschen/);
    // … eine gebuchte Sollstellung nicht.
    expect(belegungHinweis("einheit", { unitOwnerships: 2, duePostings: 1 })).toMatch(
      /lassen sich nicht entfernen/,
    );
  });

  it("benennt jede Beziehung, die der Wächter abfragt", () => {
    // Ohne diese Gegenprobe fällt eine neu hinzugefügte Beziehung still aus der
    // Meldung: Sie sperrt weiter, wird aber nicht mehr genannt – und dann steht
    // wieder „nicht leer" ohne Grund.
    const bloecke = countSchluessel(readFileSync(WAECHTER, "utf8"));
    expect(bloecke.length, "Kein _count-Block im Wächter gefunden").toBeGreaterThan(0);

    const bekannt = new Set([...belegungSchluessel.einheit, ...belegungSchluessel.objekt]);
    const unbenannt = bloecke.flat().filter((k) => !bekannt.has(k));
    expect(unbenannt, `Ohne Klartext in belegung.ts: ${unbenannt.join(", ")}`).toEqual([]);
  });
});
