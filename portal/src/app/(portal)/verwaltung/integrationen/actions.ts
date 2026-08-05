"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUDIT, logAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { integrationArea } from "@/lib/integrations";
import { requireVerwalter } from "@/lib/session";
import { pruefeVerbindung, type VerbindungsErgebnis } from "@/lib/assistant";

function back(param?: string): never {
  redirect(`/verwaltung/integrationen${param ? `?${param}` : ""}`);
}

// Speichert (oder aktualisiert) einen Integrationszugang. Der Schlüssel wird
// verschlüsselt abgelegt; ein leeres Schlüsselfeld lässt einen vorhandenen
// Schlüssel unverändert (nur Provider ändern, ohne Neu-Eingabe).
export async function saveIntegration(formData: FormData) {
  const verwalter = await requireVerwalter();
  const area = String(formData.get("area") ?? "");
  const provider = String(formData.get("provider") ?? "").trim() || null;
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  const def = integrationArea(area);
  if (!def) back("fehler=bereich");

  const existing = await db.integrationSetting.findUnique({
    where: { organizationId_area: { organizationId: verwalter.organizationId, area } },
    select: { id: true, secretEnc: true },
  });

  // Ohne neuen Schlüssel UND ohne vorhandenen Schlüssel: nichts zu aktivieren.
  const secretEnc = apiKey ? encryptSecret(apiKey) : existing?.secretEnc ?? null;
  if (!secretEnc) back("fehler=schluessel");

  await db.integrationSetting.upsert({
    where: { organizationId_area: { organizationId: verwalter.organizationId, area } },
    create: {
      organizationId: verwalter.organizationId,
      area,
      provider,
      secretEnc,
      enabled: true,
      updatedById: verwalter.id,
    },
    update: { provider, secretEnc, enabled: true, updatedById: verwalter.id },
  });

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.INTEGRATION_SAVED,
    targetType: "IntegrationSetting",
    targetId: area,
    meta: { provider },
  });
  revalidatePath("/verwaltung/integrationen");
  back("gespeichert=1");
}

// Entfernt einen Integrationszugang wieder (zurück zum manuellen Weg).
export async function clearIntegration(formData: FormData) {
  const verwalter = await requireVerwalter();
  const area = String(formData.get("area") ?? "");
  if (!integrationArea(area)) back("fehler=bereich");

  await db.integrationSetting.deleteMany({
    where: { organizationId: verwalter.organizationId, area },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.INTEGRATION_CLEARED,
    targetType: "IntegrationSetting",
    targetId: area,
  });
  revalidatePath("/verwaltung/integrationen");
  back("geloescht=1");
}

/**
 * Prüft Schlüssel und Modellnamen direkt bei Google.
 *
 * Nur für SuperAdmins: Das Ergebnis nennt zwar nie den Schlüssel, verrät aber
 * den Zustand der Betreiber-Einrichtung — das geht einen eingeschränkten
 * Verwalter nichts an.
 */
export async function testeAssistentVerbindung(): Promise<VerbindungsErgebnis> {
  const verwalter = await requireVerwalter();
  if (!verwalter.isSuperAdmin) {
    return {
      ok: false,
      meldung: "Diese Prüfung darf nur der Administrator der Organisation ausführen.",
      details: null,
      modelle: [],
    };
  }
  return pruefeVerbindung();
}
