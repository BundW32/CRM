import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Wachhund gegen einen Widerspruch, den keine Typprüfung sieht: Zwei Stellen im
 * Produkt zählten „Buchungen ohne Kostenart" verschieden.
 *
 * Die Übersicht und die Buchhaltung zählten `EINNAHME` **und** `AUSGABE` und
 * schrieben daneben, diese Buchungen „blockieren die Jahresabrechnung".
 * Blockierend sind aber nur Ausgaben (`statement-service.ts` lädt für den
 * Befund „ohne-kostenart" ausschließlich `kind: "AUSGABE"`): Ein
 * Hausgeld-Eingang trägt zu Recht keine Kostenart, sondern eine
 * Einheitenzuordnung. In einem Prüflauf meldete die Übersicht deshalb sieben
 * Blocker, während die Jahresabrechnung sauber durchlief und sich fertigstellen
 * ließ — zwei widersprüchliche Aussagen über dieselbe Sache.
 *
 * Geprüft wird der Quelltext, weil der Widerspruch zwischen Datenbankabfragen
 * besteht, die ohne laufende Datenbank nicht aufrufbar sind. Der Test hält
 * fest, dass die drei Abfragen dieselbe Grenze ziehen — genau das ginge beim
 * nächsten Umbau still verloren.
 */

const datei = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const ARBEITSBEREICH = "src/app/(portal)/verwaltung/weg/Arbeitsbereich.tsx";
const BUCHHALTUNG = "src/app/(portal)/verwaltung/weg/[propertyId]/buchhaltung/page.tsx";
const STATEMENT = "src/lib/weg/statement-service.ts";

describe("Warnung „ohne Kostenart“ und der echte Blocker", () => {
  it("blockiert in der Jahresabrechnung nur wegen AUSGABEN", () => {
    // Der Maßstab, an dem sich die beiden Zähler messen lassen müssen.
    expect(datei(STATEMENT)).toMatch(
      /kind:\s*"AUSGABE",\s*\n\s*costTypeId:\s*null,/,
    );
  });

  it.each([
    ["Übersicht", ARBEITSBEREICH],
    ["Buchhaltung", BUCHHALTUNG],
  ])("zählt in der %s ebenfalls nur Ausgaben", (_name, pfad) => {
    const text = datei(pfad);
    // Kein `costTypeId: null` darf mit einer Einnahmen einschließenden
    // Bedingung zusammenstehen.
    const verdaechtig = text.match(
      /costTypeId:\s*null,[\s\S]{0,120}?kind:\s*\{\s*in:\s*\[[^\]]*EINNAHME/g,
    );
    expect(
      verdaechtig,
      `Zählt Einnahmen mit, obwohl nur Ausgaben blockieren:\n${verdaechtig?.join("\n---\n")}`,
    ).toBeNull();
  });

  it("nennt in der Meldung ausdrücklich Ausgaben", () => {
    // „Buchungen ohne Kostenart" ließ offen, welche gemeint sind — und schickte
    // damit auf die Suche nach Einnahmen, an denen nichts zu tun ist.
    for (const pfad of [ARBEITSBEREICH, BUCHHALTUNG]) {
      expect(datei(pfad), pfad).toMatch(/Ausgabebuchung(en)? (ist|sind)/);
    }
  });
});
