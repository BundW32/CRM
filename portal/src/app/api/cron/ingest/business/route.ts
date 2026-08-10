import { NextResponse } from "next/server";
import { runIngest } from "@/lib/analytics/ingest";

export const dynamic = "force-dynamic";

// Stündlicher Ingest der Geschäftszahlen (BusinessDaily) — Absicherung über
// CRON_SECRET wie bei den übrigen Cron-Endpunkten. Antwortet auch bei einem
// fehlgeschlagenen Lauf mit 200: Das Ergebnis steht im IngestRun-Protokoll
// (/plattform/analytics/system); ein 5xx brächte nur Vercel-Wiederholungen
// für einen Fehler, der bereits dokumentiert ist.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ergebnis = await runIngest("stripe");
  return NextResponse.json({ ok: true, ...ergebnis });
}
