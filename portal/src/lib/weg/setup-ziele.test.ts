import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Der Einrichtungs-Assistent führte bei Schritt 3 („Eigentümer je Einheit
// zuordnen") auf die WEG-Stammdaten. Dort kann man Eigentümer nur aus
// **vorhandenen** Personen auswählen — und eine frisch registrierte
// Gemeinschaft hat keine. Der Neukunde stand also bei Schritt 3 von 8 vor einem
// leeren Auswahlfeld, ohne Hinweis, wo Personen entstehen.
//
// Statisch geprüft, weil der Rückfall unsichtbar wäre: Ein `href`, das wieder
// auf die Stammdaten zeigt, sieht im Quelltext genauso richtig aus.

const wurzel = join(__dirname, "..", "..", "..");
const quelle = (p: string) => readFileSync(join(wurzel, p), "utf8");

describe("Einrichtung: der Weg zum ersten Eigentümer", () => {
  it("führt ins Objektformular, solange niemand erfasst ist", () => {
    const s = quelle("src/lib/weg/setup-status.ts");
    // Der Schritt muss auf `ownedUnits === 0` verzweigen und dann ins
    // Objektformular führen — nur dort lassen sich Personen anlegen.
    expect(s).toMatch(/b\.ownedUnits === 0[\s\S]{0,200}\/verwaltung\/objekte\/\$\{propertyId\}\/bearbeiten/);
  });

  it("führt auf die Stammdaten, sobald Eigentümer da sind", () => {
    // Dort liegen Stichtag, Anteil und der Eigentümerwechsel.
    expect(quelle("src/lib/weg/setup-status.ts")).toContain('stammdaten("eigentuemer")');
  });

  it("erklärt das leere Auswahlfeld auf den Stammdaten", () => {
    // Wer trotzdem dort landet (Menü, Lesezeichen), darf nicht vor einem
    // wortlosen „— wählen —" stehen.
    const s = quelle("src/app/(portal)/verwaltung/weg/[propertyId]/stammdaten/page.tsx");
    expect(s).toContain("ownerCandidates.length === 0");
    expect(s).toMatch(/Eigentümer anlegen und der Einheit zuordnen/);
  });
});

describe("Einrichtung: der MEA-Nenner", () => {
  it("wird beim Anlegen aus den Anteilen abgeleitet", () => {
    // 300 + 250 + 450 eingetragen und danach „MEA-Nenner fehlt" zu lesen, ist
    // eine Warnung nach fehlerfreier Eingabe — bei jedem Neukunden.
    const s = quelle("src/app/(portal)/verwaltung/objekte/neu/actions.ts");
    expect(s).toMatch(/unitsToCreate\.every\(\(u\) => u\.mea != null\)/);
    expect(s).toMatch(/data: \{ meaTotal: summe \}/);
  });
});
