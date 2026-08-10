"use server";

import { redirect } from "next/navigation";
import { ingestQuelle, runIngest } from "@/lib/analytics/ingest";
import { requirePlatformAdmin } from "@/lib/platform";

function backTo(suffix = ""): string {
  return `/plattform/analytics/system${suffix}`;
}

// Manueller Re-Sync einer Datenquelle. Der Guard steht hier UND im Layout —
// der Proxy gated keine Pfade, und eine Server-Action ist von überall
// aufrufbar. Das Ergebnis (auch ein Fehler) steht danach im IngestRun-
// Protokoll auf derselben Seite; der Flash sagt nur, ob es lief.
export async function resyncAction(formData: FormData) {
  await requirePlatformAdmin();

  const key = String(formData.get("quelle") ?? "");
  const quelle = ingestQuelle(key);
  if (!quelle) redirect(backTo("?flash=quelle-nicht-angebunden"));
  const ergebnis = await runIngest(quelle.key);
  if (!ergebnis) redirect(backTo("?flash=quelle-nicht-angebunden"));
  redirect(
    backTo(ergebnis.status === "error" ? "?flash=sync-fehlgeschlagen" : "?flash=sync-fertig"),
  );
}
