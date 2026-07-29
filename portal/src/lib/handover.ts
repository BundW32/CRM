// Server-seitige Hilfsfunktionen rund um Wohnungsübergaben (PDF-Erzeugung).
// Wird aus den Server-Actions der /uebergabe-Schritte verwendet.
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { saveBuffer, readUpload } from "@/lib/storage";
import { generateHandoverPdfBuffer } from "@/lib/handover-pdf";
import { briefkopfAus } from "@/lib/documents/briefkopf";
import { fotoVorbereiten } from "@/lib/documents/photo";

const handoverInclude = {
  unit: { include: { property: true } },
  rooms: { include: { photos: true } },
  meters: { orderBy: { sortOrder: "asc" as const } },
};

// Erzeugt das Übergabe-PDF neu, speichert es und hinterlegt den storedName.
// Gibt storedName + Buffer zurück (oder null, wenn die Übergabe nicht existiert).
export async function createHandoverPdf(
  handoverId: string
): Promise<{ storedName: string; buffer: Buffer } | null> {
  const handover = await db.handover.findUnique({
    where: { id: handoverId },
    include: handoverInclude,
  });
  if (!handover) return null;

  // Org-Branding als Fallback für den Protokollführer (Verwaltung), falls am
  // Übergabe-Datensatz keine managerCompany hinterlegt ist — und für die
  // Mandantenoptik (Farbe, Logo, Kontaktzeilen) im Kopf des Protokolls.
  const branding = await getBrandingForOrg(handover.organizationId);
  const kopf = await briefkopfAus(branding);

  // Fotos laden und verkleinern. Sie gehören ins Protokoll — es ist ein
  // Beweissicherungsdokument —, aber unverkleinert wäre es zweistellig
  // megabyteschwer und käme durch keinen Mail-Anhang.
  const rooms = await Promise.all(
    handover.rooms.map(async (room) => ({
      ...room,
      photoImages: (
        await Promise.all(
          room.photos.map(async (photo) => {
            try {
              const bytes = new Uint8Array(await readUpload(photo.storedName));
              const fertig = await fotoVorbereiten(bytes);
              return fertig
                ? { bytes: fertig.jpeg, breite: fertig.breite, hoehe: fertig.hoehe, titel: photo.caption }
                : null;
            } catch {
              // Ein fehlendes Foto darf das Protokoll nicht verhindern.
              return null;
            }
          }),
        )
      ).filter((bild) => bild !== null),
    })),
  );

  const buffer = await generateHandoverPdfBuffer({
    ...handover,
    rooms,
    checklist: (handover.checklist ?? null) as Record<string, string> | null,
    fallbackCompany: branding.legalName,
    brand: kopf.brand,
    logo: kopf.logo,
    issuerLines: kopf.issuer.lines,
  });

  const unitLabel = handover.unit.label.replace(/[^a-zA-Z0-9]/g, "_");
  const dateStr = handover.handoverDate.toISOString().split("T")[0];
  const fileName = `uebergabe_${unitLabel}_${dateStr}.pdf`;

  const { storedName } = await saveBuffer(buffer, fileName, "application/pdf", ["application/pdf"]);

  await db.handover.update({
    where: { id: handoverId },
    data: { pdfStoredName: storedName },
  });

  return { storedName, buffer };
}

// Lädt das vorhandene PDF oder erzeugt es bei Bedarf neu.
export async function ensureHandoverPdfBuffer(handoverId: string): Promise<Buffer | null> {
  const handover = await db.handover.findUnique({
    where: { id: handoverId },
    select: { pdfStoredName: true },
  });
  if (!handover) return null;

  if (handover.pdfStoredName) {
    try {
      return await readUpload(handover.pdfStoredName);
    } catch {
      // Datei nicht mehr lesbar → neu erzeugen
    }
  }
  const built = await createHandoverPdf(handoverId);
  return built?.buffer ?? null;
}
