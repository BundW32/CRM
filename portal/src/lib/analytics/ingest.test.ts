import { describe, expect, it } from "vitest";
import {
  ingestQuelle,
  ingestQuellen,
  runIngestMit,
  type IngestRunDelegate,
} from "./ingest";

// Aufzeichnender Delegate statt echter DB: Geprüft wird der Rahmen
// (Protokoll-Einträge, Status-Ableitung), nicht Prisma.
function fakeRuns() {
  const created: { source: string; status: string }[] = [];
  const updated: { id: string; data: Record<string, unknown> }[] = [];
  const delegate: IngestRunDelegate = {
    async create(args) {
      created.push(args.data);
      return { id: `run-${created.length}` };
    },
    async update(args) {
      updated.push({ id: args.where.id, data: args.data });
    },
  };
  return { delegate, created, updated };
}

describe("runIngestMit", () => {
  it("protokolliert Start und Erfolg mit Zeilenzahl", async () => {
    const { delegate, created, updated } = fakeRuns();
    const ergebnis = await runIngestMit(delegate, "ga4", async () => ({
      rows: 42,
      message: "3 Tage nachgeladen",
    }));
    expect(created).toEqual([{ source: "ga4", status: "laeuft" }]);
    expect(ergebnis).toEqual({ status: "ok", rowsWritten: 42, message: "3 Tage nachgeladen" });
    expect(updated[0].data).toMatchObject({ status: "ok", rowsWritten: 42 });
    expect(updated[0].data.finishedAt).toBeInstanceOf(Date);
  });

  it("meldet partial, wenn der Runner es sagt", async () => {
    const { delegate } = fakeRuns();
    const ergebnis = await runIngestMit(delegate, "gsc", async () => ({
      rows: 10,
      partial: true,
      message: "Quota erreicht",
    }));
    expect(ergebnis.status).toBe("partial");
  });

  it("fängt Fehler des Runners und protokolliert sie, statt zu werfen", async () => {
    const { delegate, updated } = fakeRuns();
    const ergebnis = await runIngestMit(delegate, "ads", async () => {
      throw new Error("Token abgelaufen");
    });
    expect(ergebnis).toEqual({ status: "error", rowsWritten: 0, message: "Token abgelaufen" });
    // Der begonnene Lauf bleibt nicht auf "laeuft" hängen — genau solche
    // Leichen machten die System-Seite unlesbar.
    expect(updated[0].data).toMatchObject({ status: "error" });
  });
});

describe("Registry", () => {
  it("kennt genau die fünf Quellen des Datenmodells", () => {
    expect(ingestQuellen.map((q) => q.key)).toEqual(["ga4", "gsc", "ads", "stripe", "newsletter"]);
  });

  it("nicht angebundene Quellen erklären, wann sie kommen", () => {
    for (const q of ingestQuellen) {
      if (!q.runner) expect(q.folgt).toBeTruthy();
    }
  });

  it("ingestQuelle validiert unbekannte Schlüssel weg", () => {
    expect(ingestQuelle("ga4")?.label).toContain("GA4");
    expect(ingestQuelle("dropTables")).toBeNull();
  });
});
