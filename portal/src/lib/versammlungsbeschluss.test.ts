import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Wachhund für eine Trennung, die man im Code nicht sieht, aber teuer bezahlt:
//
// Ein Beschluss-Tagesordnungspunkt einer Versammlung legt sofort einen Beschluss
// mit Status OFFEN an. Ohne Unterscheidung sieht die Beschlüsse-Seite ihn wie einen
// Umlaufbeschluss – samt Stimmformular. Dann kann über einen Punkt, der erst in der
// Versammlung nach Aussprache zu beschließen ist, vorab abgestimmt werden. Das
// Gesetz trennt beides: Beschlussfassung in der Versammlung (§ 23 Abs. 1 WEG) und
// Umlaufbeschluss (§ 23 Abs. 3 WEG) sind verschiedene Verfahren.
//
// Der Test liest den Quelltext, weil die Regel in einer Server-Action steckt, die
// ohne laufende Datenbank nicht aufrufbar ist. Er prüft deshalb nicht das Ergebnis,
// sondern dass die Prüfung überhaupt noch dasteht – genau das ginge beim Umbauen
// still verloren.

const actions = readFileSync(
  join(process.cwd(), "src/app/(portal)/beschluesse/actions.ts"),
  "utf8",
);

describe("Vorab-Abstimmung über Versammlungspunkte", () => {
  it("wird in beiden Stimm-Aktionen serverseitig geblockt", () => {
    // castVote (Eigentümer) und castVoteForOwner (Verwalter trägt schriftlich ein).
    const treffer = actions.match(/await istVersammlungsBeschluss\(/g) ?? [];
    expect(treffer.length).toBe(2);
  });

  it("greift nur bei noch bevorstehenden Versammlungen", () => {
    // Nach der Versammlung muss die Verwaltung das dort gefasste Ergebnis
    // eintragen können – sonst wäre der Beschluss für immer blockiert.
    expect(actions).toMatch(/status:\s*\{\s*in:\s*\["GEPLANT",\s*"EINBERUFEN"\]\s*\}/);
  });

  it("führt zu einer erklärenden Meldung statt zu einem stillen Abbruch", () => {
    expect(actions).toContain("fehler=versammlung");
  });
});
