import { NextResponse } from "next/server";
import { ownedProperties, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { getUser } from "@/lib/session";
import { generateBeschlussSammlung } from "@/lib/documents/beschluss-sammlung";
import { fileNamePart, pdfResponse } from "@/lib/documents/pdf-response";

export const dynamic = "force-dynamic";

// Liefert die Beschluss-Sammlung eines WEG-Objekts als PDF (Verwalter im Scope
// oder Eigentümer des Objekts).
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const propertyId = new URL(request.url).searchParams.get("objekt") ?? "";
  if (!propertyId) return NextResponse.json({ error: "Objekt fehlt" }, { status: 400 });

  // Zugriff prüfen (Verwalter im Scope oder Eigentümer).
  let allowed = false;
  if (user.role === "VERWALTER") {
    const inScope = await db.property.findFirst({
      where: { id: propertyId, ...(await propertyWhereForVerwalter(user)), managementType: "WEG" },
      select: { id: true },
    });
    allowed = Boolean(inScope);
  } else if (user.role === "EIGENTUEMER") {
    const owned = await ownedProperties(user.id);
    // Defense-in-Depth: zusätzlich zur Eigentümerschaft die Org prüfen (Ownership
    // sollte nie mandantenübergreifend sein – hier trotzdem hart abgesichert).
    allowed = owned.some((p) => p.id === propertyId && p.organizationId === user.organizationId);
  }
  if (!allowed) return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { name: true, organizationId: true },
  });
  if (!property) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    // Nur GEFASSTE Beschlüsse (§24 VII WEG) – zurückgezogene/offene gehören nicht
    // in die Sammlung.
    const resolutions = await db.resolution.findMany({
      where: { propertyId, status: { in: ["ANGENOMMEN", "ABGELEHNT"] } },
      orderBy: [{ number: "asc" }, { decidedAt: "asc" }],
      include: { votes: { select: { choice: true } } },
    });

    const branding = await getBrandingForOrg(property.organizationId);
    const pdf = await generateBeschlussSammlung({
      propertyName: property.name,
      issuer: {
        legalName: branding.legalName,
        contactLine: [branding.addressLine, branding.email].filter(Boolean).join(" · "),
      },
      entries: resolutions.map((r) => ({
        number: r.number,
        title: r.title,
        decidedAt: r.decidedAt,
        status: r.status as "ANGENOMMEN" | "ABGELEHNT" | "ZURUECKGEZOGEN" | "OFFEN",
        ja: r.votes.filter((v) => v.choice === "JA").length,
        nein: r.votes.filter((v) => v.choice === "NEIN").length,
        enthaltung: r.votes.filter((v) => v.choice === "ENTHALTUNG").length,
      })),
      generatedAt: new Date(),
    });

    const fileName = `Beschluss-Sammlung_${fileNamePart(property.name)}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Beschluss-Sammlung-Export fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
