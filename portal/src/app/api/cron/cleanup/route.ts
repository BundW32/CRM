import { NextResponse } from "next/server";
import { runRetentionCleanup } from "@/lib/retention";

export const dynamic = "force-dynamic";

// Täglicher Aufräum-Job (Vercel-Cron). Absicherung über CRON_SECRET: Vercel sendet
// bei gesetztem CRON_SECRET automatisch den Header "Authorization: Bearer <secret>".
// Ohne gesetztes/korrektes Secret: 401 – der Job läuft dann nicht.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runRetentionCleanup();
  return NextResponse.json({ ok: true, ...result });
}
