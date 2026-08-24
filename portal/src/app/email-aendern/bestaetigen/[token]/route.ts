import { NextResponse } from "next/server";
import { AUDIT, logAudit } from "@/lib/audit";
import { signOffName } from "@/lib/branding";
import { getBrandingForOrg } from "@/lib/branding-server";
import { uebernehmeEmailWechsel } from "@/lib/eigene-daten";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Zweite Hälfte des Doppel-Opt-ins (siehe `lib/eigene-daten.ts`): Erst der Klick
// im NEUEN Postfach übernimmt die vorgemerkte Adresse als Anmeldenamen.
//
// Als Route-Handler und nicht als Seite: Das Einlösen schreibt, und ein
// React-Render darf das nicht. Vorbild ist `registrieren/bestaetigen/[token]`.
//
// Bewusst AUSSERHALB von `(portal)` und ohne Anmeldezwang: Der Link wird im
// Postfach geöffnet, oft auf einem anderen Gerät als dem angemeldeten. Hinter
// der Anmeldeschranke landete man auf der Login-Seite — und die will genau die
// Adresse, um die es hier gerade geht. Der Token selbst ist der Nachweis:
// 256 Bit Zufall, nur als Hash gespeichert, 24 Stunden gültig, einmal einlösbar.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ergebnisSeite = (status: string) =>
    NextResponse.redirect(new URL(`/email-aendern/bestaetigt?status=${status}`, request.url));

  // Grenze auch auf das Einlösen, nicht nur auf das Anfordern — sonst ließe
  // sich der Token-Raum von außen abklopfen.
  const ip = await getClientIp();
  if (!(await checkRateLimit(`email-wechsel-einloesen:${ip}`, 10, 3600))) {
    return ergebnisSeite("limit");
  }

  const ergebnis = await uebernehmeEmailWechsel(token);
  if (ergebnis.status !== "ok") return ergebnisSeite(ergebnis.status);

  await logAudit({
    actorId: ergebnis.userId,
    action: AUDIT.EMAIL_CHANGE_CONFIRMED,
    targetType: "User",
    targetId: ergebnis.userId,
    meta: { bisher: ergebnis.alteEmail, neu: ergebnis.neueEmail },
    ip,
  });

  // Abschließende Nachricht an die bisherige Adresse. Sie hängt jetzt nicht
  // mehr am Konto — gerade deshalb muss sie es erfahren: Es ist die letzte
  // Stelle, an der ein unbefugter Wechsel dem bisherigen Inhaber auffallen kann.
  const branding = await getBrandingForOrg(ergebnis.organizationId);
  await sendMail(
    ergebnis.alteEmail,
    "Ihre E-Mail-Adresse wurde geändert",
    `Guten Tag ${ergebnis.name},\n\n` +
      `die E-Mail-Adresse Ihres Portalkontos wurde soeben auf ${ergebnis.neueEmail}\n` +
      `geändert. Anmeldung und Nachrichten laufen ab sofort über die neue Adresse.\n\n` +
      `Waren Sie das nicht, wenden Sie sich bitte umgehend an Ihre Verwaltung.\n\n` +
      `Mit freundlichen Grüßen\n${signOffName(branding)}`,
    undefined,
    branding,
  );

  return ergebnisSeite("ok");
}
