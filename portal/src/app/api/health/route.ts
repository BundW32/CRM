import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Ziel für den externen Uptime-Check (Audit B-4): Ein Wächter außerhalb der
// Plattform ruft diese Route im Minutentakt auf und alarmiert den Betreiber,
// wenn sie nicht mit 200 antwortet. Ohne diese Route prüfte ein Uptime-Check
// nur, ob Vercel HTML ausliefert — die Datenbank, ohne die kein Login und
// keine Seite funktioniert, bliebe unbeobachtet.
//
// Bewusst ohne Secret: Die Route muss für den externen Wächter erreichbar
// sein und verrät nichts über den Bestand — nur „läuft" oder „läuft nicht".
// Keine Details im Fehlerfall (kein Fehlertext, keine Versionsnummern): Was
// genau klemmt, steht in den Logs, nicht in einer öffentlichen Antwort.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
