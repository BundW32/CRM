import { NextResponse } from "next/server";
import { isSelfManaged, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { briefkopfAus } from "@/lib/documents/briefkopf";
import { generateVerwaltervertrag } from "@/lib/documents/verwaltervertrag";
import { fileNamePart, pdfResponse } from "@/lib/documents/pdf-response";
import { getOrganization, getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Liefert den Mustervertrag für die Selbstverwaltung als PDF, vorausgefüllt
// mit Objekt und Absender. Nur für Verwalter selbstverwalteter WEGs — bei
// professionellen Verwaltungen schließt die Gemeinschaft ihren Vertrag mit
// der Verwaltung, nicht mit einem Miteigentümer.
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (user.role !== "VERWALTER") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const org = await getOrganization();
  if (!org || !isSelfManaged(org)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const propertyId = new URL(request.url).searchParams.get("objekt") ?? "";
  if (!propertyId) return NextResponse.json({ error: "Objekt fehlt" }, { status: 400 });

  const property = await db.property.findFirst({
    where: { id: propertyId, ...(await propertyWhereForVerwalter(user)), managementType: "WEG" },
    select: {
      name: true,
      street: true,
      zip: true,
      city: true,
      organizationId: true,
      _count: { select: { units: true } },
    },
  });
  if (!property) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const kopf = await briefkopfAus(await getBrandingForOrg(property.organizationId));
    const pdf = await generateVerwaltervertrag({
      propertyName: property.name,
      propertyAddress: `${property.street}, ${property.zip} ${property.city}`,
      unitsCount: property._count.units,
      issuer: kopf.issuer,
      brand: kopf.brand,
      logo: kopf.logo,
      generatedAt: new Date(),
    });

    const fileName = `Verwaltervertrag_Muster_${fileNamePart(property.name)}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Verwaltervertrag-Export fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
