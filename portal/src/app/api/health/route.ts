import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Öffentlicher Health-Check für externes Uptime-Monitoring — bislang gab es
// keinen Ansatzpunkt dafür (docs/AUDIT-SaaS-Fundament-2026-08-06.md, B-4).
// Bewusst ohne Auth: Ein Uptime-Dienst muss ihn ohne Zugangsdaten erreichen
// können. Liefert deshalb absichtlich keine Details im Fehlerfall (kein
// Stacktrace, keine Verbindungsdaten) — nur ob die Datenbank erreichbar ist.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
