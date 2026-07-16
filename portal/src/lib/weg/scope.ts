// Zentrale Scope-Prüfung für den WEG-Finanzbereich: Verwalter + Objektzugriff
// + Verwaltungsart WEG. Jede Seite/Action des Bereichs läuft hierüber.
import { redirect } from "next/navigation";
import type { User } from "@/generated/prisma/client";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

// Lädt das WEG-Objekt oder leitet um (kein Zugriff / kein WEG-Objekt).
export async function requireWegProperty(propertyId: string) {
  const verwalter = await requireVerwalter();
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  return { verwalter, property };
}

// Variante für Server Actions: liefert null statt redirect (Aufrufer entscheidet).
export async function loadWegProperty(verwalter: User, propertyId: string) {
  if (!propertyId) return null;
  if (!(await canVerwalterAccessProperty(verwalter, propertyId))) return null;
  const property = await db.property.findFirst({
    where: {
      id: propertyId,
      organizationId: verwalter.organizationId,
      managementType: "WEG",
    },
  });
  return property;
}
