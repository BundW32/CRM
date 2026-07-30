import { NextResponse } from "next/server";
import { uebernehmeBasiszinssaetze } from "@/lib/weg/basiszins-abruf-service";

export const dynamic = "force-dynamic";

/**
 * Holt den Basiszinssatz bei der Bundesbank und trägt fehlende Halbjahre nach.
 *
 * **Monatlich statt halbjährlich**, obwohl sich der Satz nur zum 1.1. und 1.7.
 * ändert (§ 247 Abs. 2 BGB): Der Lauf ist vollständig idempotent — vorhandene
 * Sätze werden nie überschrieben, fehlende ergänzt. Ein monatlicher Versuch
 * heilt sich damit selbst, wenn die Bekanntmachung sich verzögert, der Abruf
 * einmal scheitert oder die Bundesbank an genau dem einen Tag nicht erreichbar
 * ist. Zwei Termine im Jahr hätten dagegen genau zwei Chancen.
 *
 * Absicherung über CRON_SECRET wie bei den übrigen Jobs. Ein Fehlschlag ist
 * kein Fehler der Anwendung: Dann bleibt der manuelle Weg, und die Oberfläche
 * weist die Lücke ohnehin aus.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await uebernehmeBasiszinssaetze();
  // Auch ein misslungener Abruf antwortet mit 200: Der Job hat getan, was er
  // konnte. Ein 500er ließe Vercel es als Ausfall melden, obwohl nichts kaputt
  // ist — und würde die echten Ausfälle im Rauschen untergehen lassen.
  return NextResponse.json({ ok: !result.fehler, ...result });
}
