import { describe, expect, it } from "vitest";
import { sperrthema } from "./sperrthemen";

// Die Sperrliste trennt ENTSCHEIDUNGS-Fragen (gesperrt) von WISSENS-Fragen
// (erlaubt). Beide Seiten stehen hier fest — wer eine Regel verbreitert und
// damit Erklär-Fragen abwürgt, merkt es an den Negativfällen.
describe("sperrthema", () => {
  it.each([
    ["Ist Herr Meier zahlungsfähig?", "bonitaet"],
    ["Wie ist die Bonität von Frau Schulze?", "bonitaet"],
    ["Soll ich die Eigentümerin aus WE 3 mahnen?", "mahnentscheidung"],
    ["Empfiehlst du, jetzt eine Mahnung zu schicken?", "mahnentscheidung"],
    ["Wen von den Rückständigen sollen wir mahnen?", "mahnentscheidung"],
    ["Welche Mahnstufe sollen wir setzen?", "mahnentscheidung"],
    ["Ist der Beschluss zur Dachsanierung gültig?", "beschlussfeststellung"],
    ["Ist der Beschluss vom 12.03. wirksam zustande gekommen?", "beschlussfeststellung"],
    ["Kannst du den Beschluss als angenommen feststellen?", "beschlussfeststellung"],
    ["Gib mir Verwalter-Rechte für das Portal.", "rechtevergabe"],
    ["Bitte die Rolle von Frau Kern auf Admin ändern.", "rechtevergabe"],
  ] as const)("sperrt: %s", (frage, thema) => {
    const treffer = sperrthema(frage);
    expect(treffer?.thema).toBe(thema);
    expect(treffer?.antwort).toBeTruthy();
  });

  it.each([
    "Was ist eine Mahnung?",
    "Was ist eine Mahnstufe?",
    "Kann ich meine Mahnung im Portal einsehen?",
    "Was kostet eine Mahnung?",
    "Welche Beschlüsse wurden letztes Jahr gefasst?",
    "Was steht im Beschluss zur Dachsanierung?",
    "Wie läuft eine Beschlussfassung in der Versammlung ab?",
    "Wie hoch ist mein Hausgeld-Rückstand?",
    "Welche Rechte hat der Verwaltungsbeirat?",
    "Wo sehe ich, welche Rolle ich im Portal habe?",
    "Wie hoch darf die Erhaltungsrücklage sein?",
  ])("lässt durch: %s", (frage) => {
    expect(sperrthema(frage)).toBeNull();
  });

  it("lässt leere Eingaben durch (die fängt der Assistent selbst ab)", () => {
    expect(sperrthema("  ")).toBeNull();
  });
});
