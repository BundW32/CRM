"use server";

import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform";

// Die Prüfung selbst läuft beim Rendern der Seite (`?pruefen=1`), nicht hier.
// Grund: Sie liefert eine Tabelle mit vier Befunden — eine Server-Action kann
// nach `redirect()` nichts mehr zurückgeben, und die Befunde in die URL zu
// packen hieße, sie zu verstümmeln.
//
// Diese Action gibt es trotzdem, statt eines schlichten Links: Ein Testupload
// dauert spürbar. Über den `PendingButton` sieht man, dass etwas läuft — sonst
// klickt man ein zweites Mal und schreibt zwei Testdateien.
export async function starteAblagePruefung() {
  await requirePlatformAdmin();
  redirect("/verwaltung/ablage?pruefen=1");
}
