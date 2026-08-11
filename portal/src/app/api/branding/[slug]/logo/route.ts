import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Öffentliche Logo-Auslieferung pro Mandant (Slug). Logos sind reine
 * Branding-Assets ohne Personenbezug und müssen auch in unauthentifizierten
 * Kontexten (E-Mails, Login-Seite) abrufbar sein.
 *
 * Der Abruf läuft ausschließlich über `readUpload`. Bis zum 11.08.2026 stand
 * hier ein eigenes `fetch(stored, { Authorization: Bearer
 * BLOB_READ_WRITE_TOKEN })` — ohne die `isBlobUrl()`-Prüfung, die
 * `src/lib/storage.ts` ausdrücklich für JEDEN Abruf vorschreibt, der ein
 * Zugriffs-Token mitschickt. `logoStoredName` kommt aus der Datenbank; wäre
 * dort je eine fremde URL gelandet (Import, Migration, Manipulation), hätte
 * diese Route das Token — Lese- UND Schreibrecht auf sämtliche Kundendateien
 * aller Mandanten — an einen beliebigen fremden Server geschickt. Und zwar
 * über eine Route, die ohne Anmeldung erreichbar ist.
 *
 * Das ist genau der Grund, aus dem die Prüfung in `storage.ts` liegt und nicht
 * als Kopie an jeder Abrufstelle: Eine eigene Abrufstelle vergisst sie.
 * Deshalb hat diese Route jetzt keine mehr.
 */

// Der Content-Type wird aus dem gespeicherten Namen abgeleitet, weil der Weg
// über `readUpload` keinen Antwort-Header eines Upstreams mehr liefert.
// Blob-URLs tragen die Endung im Pfad (`uploads/<uuid>.png`); Query und
// Fragment dürfen dabei nicht mitzählen.
function contentTypeFor(stored: string): string {
  if (stored.startsWith("data:")) {
    const m = stored.match(/^data:([^;,]+)/);
    if (m) return m[1];
  }
  const pfad = stored.split(/[?#]/)[0];
  if (/\.jpe?g$/i.test(pfad)) return "image/jpeg";
  if (/\.webp$/i.test(pfad)) return "image/webp";
  return "image/png";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const org = await db.organization.findUnique({
    where: { slug },
    select: { logoStoredName: true },
  });
  if (!org?.logoStoredName) {
    return NextResponse.json({ error: "Kein Logo" }, { status: 404 });
  }

  const stored = org.logoStoredName;

  try {
    const data = await readUpload(stored);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeFor(stored),
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    // Deckt auch den abgewiesenen Fremd-Host ab: `readUpload` wirft dann
    // „Nicht erlaubter Speicher-Host." — nach außen bleibt es ein 404, damit
    // die Route nicht ausplaudert, was in `logoStoredName` steht.
    return NextResponse.json({ error: "Logo nicht lesbar" }, { status: 404 });
  }
}
