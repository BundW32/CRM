import { NextResponse } from "next/server";
import { isSelfManaged, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { briefkopfAus } from "@/lib/documents/briefkopf";
import {
  generateVerwaltervertrag,
  type VerwaltervertragAngaben,
} from "@/lib/documents/verwaltervertrag";
import { fileNamePart, pdfResponse } from "@/lib/documents/pdf-response";
import { getOrganization, getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Freitext aus dem Formular: trimmen, Steuerzeichen heraus, Länge deckeln —
// die Werte landen unverändert im PDF.
function text(params: URLSearchParams, name: string, maxLength = 120): string | undefined {
  const wert = params.get(name)?.replace(/[\p{Cc}\p{Cf}]/gu, " ").trim();
  return wert ? wert.slice(0, maxLength) : undefined;
}

// `<input type="date">` liefert JJJJ-MM-TT; im Vertrag steht TT.MM.JJJJ.
// Alles andere wird verworfen — dann bleibt die Ausfülllinie stehen.
function datum(params: URLSearchParams, name: string): string | undefined {
  const wert = params.get(name)?.trim() ?? "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wert);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : undefined;
}

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

  const params = new URL(request.url).searchParams;
  const propertyId = params.get("objekt") ?? "";
  if (!propertyId) return NextResponse.json({ error: "Objekt fehlt" }, { status: 400 });

  const verguetungRaw = params.get("verguetung");
  const intervallRaw = params.get("intervall");
  const angaben: VerwaltervertragAngaben = {
    vertreterName: text(params, "vertreter"),
    beschlussDatum: datum(params, "beschluss"),
    topNummer: text(params, "top", 20),
    verwalterName: text(params, "verwalter"),
    verwalterAnschrift: text(params, "verwalterAnschrift", 200),
    beginn: datum(params, "beginn"),
    ende: datum(params, "ende"),
    innenGrenzeEur: text(params, "grenze", 20),
    verguetung:
      verguetungRaw === "EHRENAMT" ? "EHRENAMT" : verguetungRaw === "AUFWAND" ? "AUFWAND" : undefined,
    verguetungBetragEur: text(params, "betrag", 20),
    verguetungIntervall:
      intervallRaw === "MONAT" ? "MONAT" : intervallRaw === "JAHR" ? "JAHR" : undefined,
    haftungGrenzeEur: text(params, "haftung", 20),
    sonderleistungen: text(params, "sonder", 300),
    ort: text(params, "ort", 80),
  };

  const property = await db.property.findFirst({
    where: { id: propertyId, ...(await propertyWhereForVerwalter(user)), managementType: "WEG" },
    select: {
      name: true,
      street: true,
      zip: true,
      city: true,
      organizationId: true,
      // Einheiten ohne Stellplätze — der Vertrag rechnet die Vergütung je
      // Einheit; Stellplätze werden separat ausgewiesen.
      _count: {
        select: {
          units: { where: { unitType: { not: "STELLPLATZ" } } },
        },
      },
      units: { where: { unitType: "STELLPLATZ" }, select: { id: true } },
    },
  });
  if (!property) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const kopf = await briefkopfAus(await getBrandingForOrg(property.organizationId));
    const pdf = await generateVerwaltervertrag({
      propertyName: property.name,
      propertyAddress: `${property.street}, ${property.zip} ${property.city}`,
      unitsCount: property._count.units,
      stellplaetzeCount: property.units.length,
      issuer: kopf.issuer,
      brand: kopf.brand,
      logo: kopf.logo,
      generatedAt: new Date(),
      angaben,
    });

    const fileName = `Verwaltervertrag_Muster_${fileNamePart(property.name)}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Verwaltervertrag-Export fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
