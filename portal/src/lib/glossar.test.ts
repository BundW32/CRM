import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "tinyglobby";
import { describe, expect, it } from "vitest";
import { BEGRIFFE, GLOSSAR } from "./glossar";

const wurzel = join(__dirname, "..", "..");
const dateien = globSync(["src/app/**/*.tsx"], { cwd: wurzel }).map((p: string) =>
  join(wurzel, p),
);

describe("Glossar", () => {
  it("sieht überhaupt Dateien", () => {
    expect(dateien.length).toBeGreaterThan(50);
  });

  it("erklärt jeden Begriff in genau einem Satz", () => {
    // Zwei Sätze liest niemand, der gerade etwas anderes vorhat. Die Grenze ist
    // bewusst hart: Sonst wächst aus der Erklärung ein Absatz, und aus dem
    // Absatz ein zweites Handbuch.
    const zuLang = BEGRIFFE.filter((b) => GLOSSAR[b].erklaerung.length > 220);
    expect(zuLang).toEqual([]);
  });

  it("nennt keinen Paragraphen ohne Gesetz", () => {
    // „§ 28 Abs. 1" allein sagt nicht, aus welchem Gesetz — und die Antwort
    // hängt bei diesen Begriffen zwischen WEG, BGB und HeizkostenV.
    const eintraege = BEGRIFFE.map((b) => GLOSSAR[b] as { paragraph?: string });
    const ohneGesetz = eintraege
      .map((e) => e.paragraph)
      .filter((p): p is string => Boolean(p))
      .filter((p) => !/(WEG|BGB|EStG|HeizkostenV|BetrKV)\s*$/.test(p));
    expect(ohneGesetz).toEqual([]);
  });

  it("verwendet nur Begriffe, die es gibt", () => {
    // Ein Tippfehler im `name` würde sonst erst zur Laufzeit auffallen — und
    // dort als leere Erklärung, nicht als Fehler.
    const benutzt = new Set<string>();
    for (const f of dateien) {
      for (const m of readFileSync(f, "utf8").matchAll(/<Begriff\s+name="([^"]+)"/g)) {
        benutzt.add(m[1]);
      }
    }
    const unbekannt = [...benutzt].filter((b) => !(b in GLOSSAR));
    expect(unbekannt).toEqual([]);
  });
});
