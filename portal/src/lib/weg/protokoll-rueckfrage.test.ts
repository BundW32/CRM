import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Wachhund für zwei Rückfragen, die es lange nicht gab — und für die Stelle, an
 * der sie sitzen müssen.
 *
 * „Protokoll erstellen (PDF)" heißt harmloser, als der Knopf ist: Er setzt die
 * Versammlung auf DURCHGEFUEHRT, friert Tagesordnung und Einladung ein und legt
 * das PDF für alle Eigentümer ab. Bis hierher tat er das ohne jede Prüfung.
 *
 * Zwei Fälle, beide im Produkttest aufgetreten:
 *
 * 1. **Termin in der Zukunft.** Eine Versammlung mit Termin 39 Tage später ließ
 *    sich sofort als durchgeführt vermerken. Ein Protokoll über ein Ereignis,
 *    das noch nicht stattgefunden hat, untergräbt die Beweiskraft der ganzen
 *    Selbstverwaltungs-Dokumentation.
 * 2. **Offene Beschluss-TOPs.** Ohne eine einzige Stimme entstand das PDF mit
 *    „offen (Ja 0 · Nein 0 · Enthaltung 0)" und ging so an alle Eigentümer.
 *
 * Beides sind bewusst RÜCKFRAGEN, keine Sperren: Der Nachtrag einer außerhalb
 * des Portals abgehaltenen Versammlung muss möglich bleiben.
 *
 * Geprüft wird der Quelltext, weil die Regel in einer Server-Action steckt, die
 * ohne laufende Datenbank nicht aufrufbar ist — dasselbe Vorgehen wie in
 * `versammlungsbeschluss.test.ts`. Der Test hält fest, dass die Prüfung
 * dasteht; genau das ginge beim nächsten Umbau still verloren.
 */

const actions = readFileSync(
  join(process.cwd(), "src/app/(portal)/versammlungen/actions.ts"),
  "utf8",
);
const seite = readFileSync(
  join(process.cwd(), "src/app/(portal)/versammlungen/[id]/page.tsx"),
  "utf8",
);

describe("Rückfrage vor der Protokollerstellung", () => {
  it("vergleicht den Termin gegen die Gegenwart", () => {
    expect(actions).toMatch(/meeting\.scheduledAt\s*>\s*new Date\(\)/);
  });

  it("zählt Beschluss-TOPs, deren Beschluss noch OFFEN ist", () => {
    expect(actions).toMatch(/type:\s*"BESCHLUSS",\s*resolution:\s*\{\s*status:\s*"OFFEN"\s*\}/);
  });

  it("prüft serverseitig, nicht nur in der Oberfläche", () => {
    // Ein ausgeblendeter Knopf ist keine Prüfung: Dieselbe Server-Action ließe
    // sich sonst direkt aufrufen und umginge beide Rückfragen.
    const stelle = actions.indexOf("export async function generateProtocol");
    expect(stelle).toBeGreaterThan(-1);
    const rumpf = actions.slice(stelle, stelle + 1200);
    expect(rumpf).toContain("protokollBedenken");
    expect(rumpf).toContain("bestaetigt");
  });

  it("lässt sich mit ausdrücklicher Bestätigung fortsetzen (kein Hard-Block)", () => {
    // Ohne diesen Weg wäre der Nachtrag einer außerhalb des Portals
    // abgehaltenen Versammlung unmöglich.
    expect(actions).toMatch(/formData\.get\("bestaetigt"\)/);
    expect(seite).toContain('name="bestaetigt"');
  });

  it("hält fest, WANN das Protokoll erzeugt wurde", () => {
    // Ohne diesen Zeitstempel lässt sich nicht erkennen, dass nach der
    // Protokollerstellung noch Beschlussergebnisse eingetragen wurden — die
    // Eigentümer behielten dann stillschweigend ein Protokoll mit „Ja 0".
    expect(actions).toMatch(/protocolGeneratedAt:\s*new Date\(\)/);
    expect(seite).toContain("protokollVeraltet");
  });
});
