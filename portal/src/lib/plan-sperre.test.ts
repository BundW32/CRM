import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Wachhund für die Plan-Sperre des Start-Umfangs.
//
// Die Preisseite verspricht: Start (kostenlos) heißt einrichten und ansehen —
// die Arbeitsfunktionen (Wirtschaftsplan, Jahresabrechnung, Hausgeld,
// Buchhaltung, Versammlung, Beschlüsse, Dokumente, Aushänge) gehören zu den
// bezahlten Tarifen. Durchgesetzt wird das serverseitig über
// `planErlaubt("vollerUmfang")` (lib/plan-guard.ts) in den PRODUZIERENDEN
// Actions dieser Bereiche; ein ausgeblendeter Knopf allein wäre keine Sperre.
//
// Der Test liest den Quelltext, weil die Regel in Server-Actions steckt, die
// ohne laufende Datenbank nicht aufrufbar sind: Er hält fest, DASS die Sperre
// in jeder verabredeten Aktion steht — beim Umbauen ginge genau das still
// verloren. Die Tarif-Matrix selbst prüft billing.test.ts (hatPlanFunktion).
const GESPERRTE_AKTIONEN: Record<string, string[]> = {
  "src/app/(portal)/verwaltung/weg/[propertyId]/wirtschaftsplan/actions.ts": [
    "createPlan",
    "resolvePlan",
  ],
  "src/app/(portal)/verwaltung/weg/[propertyId]/jahresabrechnung/actions.ts": [
    "createStatement",
    "finalizeStatement",
  ],
  "src/app/(portal)/verwaltung/weg/[propertyId]/hausgeld/actions.ts": [
    "createMahnung",
    "schreibeSollstellungenFort",
  ],
  "src/app/(portal)/verwaltung/weg/[propertyId]/buchhaltung/actions.ts": [
    "createBooking",
    "createTransfer",
    "importCsvAction",
  ],
  "src/app/(portal)/versammlungen/actions.ts": ["createMeeting", "sendInvitation"],
  "src/app/(portal)/beschluesse/actions.ts": ["createResolution"],
  "src/app/(portal)/dokumente/actions.ts": ["uploadDocument"],
  "src/app/(portal)/aushaenge/actions.ts": ["createAnnouncement"],
};

// Verwalter-Plus: neue Nachrichten an den zertifizierten Verwalter.
const PLUS_AKTIONEN = "src/app/(portal)/verwaltung/verwalter-tickets/actions.ts";

describe("Plan-Sperre der Arbeitsfunktionen (Start-Umfang)", () => {
  for (const [pfad, funktionen] of Object.entries(GESPERRTE_AKTIONEN)) {
    it(`sperrt in ${pfad.split("/").slice(-2).join("/")}: ${funktionen.join(", ")}`, () => {
      const quelltext = readFileSync(join(process.cwd(), pfad), "utf8");
      for (const fn of funktionen) {
        // Die Sperre muss INNERHALB der Funktion stehen, vor der nächsten
        // exportierten Action — irgendwo in der Datei genügt nicht.
        const start = quelltext.indexOf(`export async function ${fn}(`);
        expect(start, `${fn} fehlt in ${pfad}`).toBeGreaterThan(-1);
        const ende = quelltext.indexOf("export async function", start + 1);
        const rumpf = quelltext.slice(start, ende === -1 ? undefined : ende);
        expect(
          rumpf.includes('await planErlaubt("vollerUmfang")'),
          `Plan-Sperre fehlt in ${fn} (${pfad})`,
        ).toBe(true);
        expect(rumpf.includes("flash=nur-mit-tarif"), `Meldung fehlt in ${fn}`).toBe(true);
      }
    });
  }

  it("sperrt neue Verwalter-Ticket-Nachrichten hinter Verwalter-Plus", () => {
    const quelltext = readFileSync(join(process.cwd(), PLUS_AKTIONEN), "utf8");
    // anfrageErstellen und rueckfrageSenden laufen beide über den gemeinsamen
    // Wächter; anfrageSchliessen bewusst nicht (bezahlte Antworten aufräumen).
    expect(quelltext).toContain('hatPlanFunktion(org, "verwalterTicket")');
    const treffer = quelltext.match(/await requireVerwalterTicketPlan\(\)/g) ?? [];
    expect(treffer.length).toBe(2);
  });
});
