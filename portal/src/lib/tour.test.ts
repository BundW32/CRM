import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "tinyglobby";
import { describe, expect, it } from "vitest";
import { TOUR_SCHRITTE, tourSchritteFuer } from "./tour";

// Eine Führung, die auf ein Element zeigt, das es nicht mehr gibt, ist
// schlimmer als keine: Sie dunkelt die Seite ab und leuchtet ins Leere. Und
// gemerkt wird das erst, wenn jemand das Programm zum ersten Mal öffnet — also
// genau bei dem, dem es am meisten schaden würde.
//
// Deshalb hier die statische Gegenprobe: Jedes Ziel eines Schritts muss als
// `data-tour`-Marker im Quelltext stehen.

const wurzel = join(__dirname, "..", "..");
const dateien = globSync(["src/**/*.tsx"], { cwd: wurzel }).map((p: string) => join(wurzel, p));

/** Alle Marker, die irgendwo gesetzt werden — auch die abgeleiteten. */
function vorhandeneMarker(): Set<string> {
  const gefunden = new Set<string>();
  for (const f of dateien) {
    const quelle = readFileSync(f, "utf8");
    // Feste Marker: data-tour="name"
    for (const m of quelle.matchAll(/data-tour="([^"{]+)"/g)) gefunden.add(m[1]);
    // Abgeleitete Marker der Navigation: data-tour={`nav-${…}`}
    if (/data-tour=\{`nav-\$\{/.test(quelle)) gefunden.add("nav-*");
  }
  return gefunden;
}

describe("Geführte Einrichtung", () => {
  it("sieht überhaupt Dateien", () => {
    expect(dateien.length).toBeGreaterThan(50);
  });

  it("findet für jeden Schritt sein Ziel", () => {
    const marker = vorhandeneMarker();
    const ohneZiel = TOUR_SCHRITTE.filter((s) => s.ziel).filter((s) => {
      // Navigationsziele entstehen aus `app-nav.ts`; geprüft wird, dass die
      // Ableitung überhaupt existiert und der Menüpunkt dort steht.
      if (s.ziel!.startsWith("nav-")) return !marker.has("nav-*");
      return !marker.has(s.ziel!);
    });
    expect(ohneZiel.map((s) => s.ziel)).toEqual([]);
  });

  it("verweist nur auf Menüpunkte, die es gibt", () => {
    const nav = readFileSync(join(wurzel, "src/lib/app-nav.ts"), "utf8");
    const fehlend = TOUR_SCHRITTE.filter((s) => s.ziel?.startsWith("nav-")).filter((s) => {
      // `nav-verwaltung-weg` → href "/verwaltung/weg"
      const href = "/" + s.ziel!.slice(4).replace(/-/g, "/");
      return !nav.includes(`"${href}"`);
    });
    expect(fehlend.map((s) => s.ziel)).toEqual([]);
  });

  it("bleibt kurz genug, dass jemand sie zu Ende liest", () => {
    // Sieben Schritte ist die Grenze aus dem Plan. Wer sie überschreitet,
    // erklärt nicht mehr, sondern hält auf.
    expect(TOUR_SCHRITTE.length).toBeLessThanOrEqual(7);
    const zuLang = TOUR_SCHRITTE.filter((s) => s.text.length > 340);
    expect(zuLang.map((s) => s.titel)).toEqual([]);
  });

  it("zeigt dem professionellen Verwalter keine Selbstverwalter-Schritte", () => {
    const profi = tourSchritteFuer({ selbstverwaltung: false, mitAssistent: true });
    const selbst = tourSchritteFuer({ selbstverwaltung: true, mitAssistent: true });
    expect(profi.length).toBeLessThan(selbst.length);
    expect(profi.every((s) => !s.nurSelbstverwaltung)).toBe(true);
  });

  it("verspricht keinen Assistenten, wenn es keinen gibt", () => {
    // Ohne API-Schlüssel gibt es das Widget nicht. Ein Schritt, der es
    // anpreist, schickt den Nutzer auf eine vergebliche Suche.
    const ohne = tourSchritteFuer({ selbstverwaltung: true, mitAssistent: false });
    expect(ohne.some((s) => s.ziel === "assistent")).toBe(false);
  });
});
