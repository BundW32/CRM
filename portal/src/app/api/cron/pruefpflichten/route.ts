import { NextResponse } from "next/server";
import { runComplianceReminders } from "@/lib/weg/compliance-reminder";

export const dynamic = "force-dynamic";

// Täglicher Erinnerungs-Job (Vercel-Cron) für fällige WEG-Prüfpflichten.
// Absicherung über CRON_SECRET wie beim Aufräum-Job. Ohne SMTP-Adapter ist der
// Versand ein kontrollierter No-Op (Fallback = Dashboard).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runComplianceReminders();
  return NextResponse.json({ ok: true, ...result });
}
