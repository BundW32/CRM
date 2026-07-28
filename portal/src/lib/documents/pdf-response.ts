// Gemeinsame Auslieferung erzeugter PDFs.
//
// Zwei Dinge, die vorher in jeder Route einzeln (und unterschiedlich) gelöst
// waren:
//
//  1. „Öffnen" vs. „Herunterladen". Das Portal ist eine installierbare PWA
//     (manifest: display=standalone). Ein inline ausgeliefertes PDF landet dort
//     im eingebauten Betrachter — ohne Browserleiste, also ohne Zurück-Weg. Für
//     abgelegte Dateien war das in /api/files/[kind]/[id] mit ?download=1 längst
//     gelöst, für die zehn Generator-Routen nicht: die lieferten fest `inline`.
//
//  2. Der Dateiname. Die Generator-Routen ersetzten jedes Sonderzeichen durch
//     „_" ("Müllerstraße" → "M_llerstra_e"). Richtig ist der doppelte Weg:
//     ASCII-Fallback für alte Clients plus RFC-5987-Variante mit UTF-8.
import { NextResponse } from "next/server";

// Entfernt nur, was in einem Dateinamen bzw. im Header nicht vorkommen darf —
// Umlaute und andere Buchstaben bleiben erhalten (dafür ist filename* da).
export function fileNamePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentDisposition(fileName: string, download: boolean): string {
  const clean = fileNamePart(fileName) || "dokument.pdf";
  const ascii = clean.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

// ?download=1 erzwingt die Übergabe an das PDF-Programm des Geräts.
export function wantsDownload(request: Request): boolean {
  return new URL(request.url).searchParams.get("download") === "1";
}

export function pdfResponse(pdf: Uint8Array, fileName: string, request: Request): NextResponse {
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(fileName, wantsDownload(request)),
      "Cache-Control": "private, no-store",
    },
  });
}
