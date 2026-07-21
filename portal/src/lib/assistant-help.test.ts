import { describe, expect, it } from "vitest";
import { HELP_TOPICS, helpForUser } from "./assistant-help";

describe("helpForUser", () => {
  it("liefert nur Themen der jeweiligen Rolle", () => {
    const verwalter = helpForUser("VERWALTER");
    const eigentuemer = helpForUser("EIGENTUEMER");
    expect(verwalter.every((t) => t.roles.includes("VERWALTER"))).toBe(true);
    expect(eigentuemer.every((t) => t.roles.includes("EIGENTUEMER"))).toBe(true);
    // Verwalter-spezifisches Thema erscheint nicht beim Eigentümer.
    expect(verwalter.some((t) => t.title === "Objekt anlegen")).toBe(true);
    expect(eigentuemer.some((t) => t.title === "Objekt anlegen")).toBe(false);
  });

  it("enthält für beide Rollen mindestens ein How-to und gemeinsame Themen", () => {
    expect(helpForUser("VERWALTER").length).toBeGreaterThan(0);
    expect(helpForUser("EIGENTUEMER").length).toBeGreaterThan(0);
    // Gemeinsame Themen (Zähler, Dokumente) für beide Rollen sichtbar.
    const shared = HELP_TOPICS.filter((t) => t.roles.length === 2);
    expect(shared.length).toBeGreaterThan(0);
  });
});
