import { NextResponse } from "next/server";
import { isAssistantEnabled } from "@/lib/assistant";
import { db } from "@/lib/db";
import { indexiereOrganisation, indexVerfuegbar } from "@/lib/ki/wissensindex";

export const dynamic = "force-dynamic";
// Viele Organisationen nacheinander plus Google-Aufrufe — die Vorgabe von 10 s
// reicht dafür nicht. Dank Hash-Abgleich ist der Normallauf trotzdem billig:
// Unveränderte Quellen werden ohne Einbettung übersprungen.
export const maxDuration = 300;

// Nächtlicher Abgleich des KI-Wissensindex (Vercel-Cron, siehe vercel.json).
// Absicherung wie die übrigen Cron-Routen über CRON_SECRET. Fehler in einer
// Organisation stoppen nicht den Rest — sonst hinge der Index aller Kunden an
// der kaputtesten Quelle.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAssistantEnabled() || !(await indexVerfuegbar())) {
    return NextResponse.json({ ok: true, uebersprungen: "Assistent aus oder Index nicht verfügbar" });
  }

  const orgs = await db.organization.findMany({
    where: { active: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let quellen = 0;
  let neu = 0;
  let entfernt = 0;
  let fehler = 0;
  for (const org of orgs) {
    try {
      const ergebnis = await indexiereOrganisation(org.id);
      if (!ergebnis) {
        fehler += 1;
        continue;
      }
      quellen += ergebnis.quellen;
      neu += ergebnis.neu;
      entfernt += ergebnis.entfernt;
    } catch (e) {
      fehler += 1;
      console.error(
        `[ki-index] Organisation ${org.id}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  return NextResponse.json({ ok: true, organisationen: orgs.length, quellen, neu, entfernt, fehler });
}
