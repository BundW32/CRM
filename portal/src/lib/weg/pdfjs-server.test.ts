import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { installiereDomStubs } from "./pdfjs-server";

vi.setConfig({ testTimeout: 60_000 });

describe("installiereDomStubs", () => {
  it("setzt die Klassen nur, wenn sie fehlen", () => {
    const g = globalThis as Record<string, unknown>;
    const vorher = g.DOMMatrix;
    installiereDomStubs();
    expect(typeof g.DOMMatrix).toBe("function");
    expect(typeof g.Path2D).toBe("function");
    // Ist eine echte Klasse da (Node mit Canvas-Paket, Browser), bleibt sie.
    if (vorher) expect(g.DOMMatrix).toBe(vorher);
  });
});

describe("Belegerkennung ohne @napi-rs/canvas (Produktionsfall Vercel)", () => {
  it("liest ein Text-PDF, obwohl das Canvas-Paket nicht auflösbar ist", async () => {
    // Der Produktionsfall lässt sich im Testprozess nicht nachstellen: Dort
    // ist das Paket installiert, und pdf.js ist schon geladen. Deshalb ein
    // Kindprozess mit einem Auflösungs-Haken, der genau dieses Paket
    // verweigert — so, wie es das Vercel-Bundle tut.
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    ["Dachdeckerei Mueller GmbH", "Rechnungs-Nr.: 2026-114 Rechnungsdatum: 14.03.2026", "Gesamtbetrag 1.250,00 EUR"].forEach(
      (z, i) => page.drawText(z, { x: 50, y: 790 - i * 16, size: 10, font }),
    );
    const dir = mkdtempSync(join(tmpdir(), "pdfjs-ohne-canvas-"));
    try {
      const pdfPfad = join(dir, "rechnung.pdf");
      writeFileSync(pdfPfad, await doc.save());

      const haken = join(dir, "ohne-canvas.cjs");
      writeFileSync(
        haken,
        `const Module = require("node:module");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "@napi-rs/canvas") throw new Error("simuliert: Paket nicht im Bundle");
  return original.call(this, request, ...rest);
};
`,
      );
      const skript = join(dir, "lauf.mts");
      writeFileSync(
        skript,
        `import { readFileSync } from "node:fs";
import { erkenneBelegLokal } from ${JSON.stringify(join(process.cwd(), "src/lib/weg/beleg-lokal.ts"))};
const bytes = new Uint8Array(readFileSync(process.argv[2]));
const r = await erkenneBelegLokal(bytes, "application/pdf");
process.stdout.write("ERGEBNIS " + JSON.stringify(r));
`,
      );

      const lauf = spawnSync(
        process.execPath,
        ["--require", haken, "--import", "tsx", skript, pdfPfad],
        { cwd: process.cwd(), encoding: "utf8", timeout: 50_000 },
      );
      // Beweis, dass die Simulation griff: pdf.js hat das Paket gesucht und
      // nicht bekommen. Ohne diese Zeile prüfte der Test den Normalfall.
      expect(lauf.stderr, "Der Auflösungs-Haken hat nicht gegriffen").toContain('Cannot load "@napi-rs/canvas"');
      const zeile = lauf.stdout.split("\n").find((l) => l.startsWith("ERGEBNIS "));
      expect(zeile, `stdout: ${lauf.stdout}\nstderr: ${lauf.stderr}`).toBeDefined();
      const ergebnis = JSON.parse(zeile!.slice("ERGEBNIS ".length));
      expect(ergebnis?.quelle).toBe("text");
      expect(ergebnis?.daten).toMatchObject({
        creditor: "Dachdeckerei Mueller GmbH",
        invoiceNumber: "2026-114",
        invoiceDate: "2026-03-14",
        grossCents: 125000,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
