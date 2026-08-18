"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { SERVICE_EMAIL } from "@/components/marketing/brand";
import { isWegSaas } from "@/lib/app-mode";
import { signOffName } from "@/lib/branding";
import { fallbackBranding } from "@/lib/branding-server";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Kontakt-Funnel für Fragen und Anregungen (/kontakt).
 *
 * Bewusst OHNE Anmeldung: Der Funnel richtet sich vor allem an Interessenten,
 * die noch kein Konto haben. Es wird nichts gespeichert — die Anfrage geht als
 * E-Mail an das Service-Postfach, die absendende Person erhält eine
 * Eingangsbestätigung. Mehr braucht es nicht, und was nicht gespeichert wird,
 * muss auch nicht gelöscht werden.
 */

const ANLIEGEN = { frage: "Frage", anregung: "Anregung" } as const;

const schema = z.object({
  anliegen: z.enum(["frage", "anregung"]),
  // Freiwillig – hilft dem Service-Postfach nur beim Einsortieren.
  thema: z.string().trim().max(100).optional(),
  nachricht: z.string().trim().min(10).max(5000),
  name: z.string().trim().min(2).max(200),
  email: z.email(),
});

export async function sendeKontaktanfrage(formData: FormData) {
  // Harte Sperre wie bei der Registrierung: Den Funnel gibt es nur auf
  // wegportal24 — unabhängig davon, ob die Seite erreichbar war.
  if (!isWegSaas()) {
    redirect("/login");
  }

  // Honeypot: ein für Menschen unsichtbares Feld. Füllt es ein Bot aus, tun wir
  // so, als sei alles gut (kein Hinweis auf die Erkennung), senden aber nichts.
  if (String(formData.get("hp_url") ?? "").trim()) {
    redirect("/kontakt/danke");
  }

  // Missbrauchsschutz: Der Weg steht offen im Netz. Fünf Nachrichten je IP und
  // Stunde reichen für jedes echte Anliegen.
  const ip = await getClientIp();
  if (!(await checkRateLimit(`kontakt:${ip}`, 5, 3600))) {
    redirect("/kontakt?fehler=limit");
  }

  const parsed = schema.safeParse({
    anliegen: String(formData.get("anliegen") ?? ""),
    thema: String(formData.get("thema") ?? "") || undefined,
    nachricht: formData.get("nachricht"),
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    redirect("/kontakt?fehler=eingabe");
  }

  const d = parsed.data;
  const branding = fallbackBranding();
  const eingangText = new Date().toLocaleString("de-DE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });

  const block =
    `Anliegen: ${ANLIEGEN[d.anliegen]}\n` +
    (d.thema ? `Thema: ${d.thema}\n` : "") +
    `Name: ${d.name}\n` +
    `E-Mail: ${d.email}\n` +
    `Eingang: ${eingangText}\n\n` +
    `Nachricht:\n${d.nachricht}\n`;

  // 1) An das Service-Postfach. Ohne diese Nachricht bliebe das Anliegen folgenlos.
  await sendMail(
    SERVICE_EMAIL,
    `${ANLIEGEN[d.anliegen]} über das Kontaktformular – ${d.name}`,
    `Über den Kontakt-Funnel auf wegportal24.de ist folgende Nachricht eingegangen:\n\n` +
      block +
      `\nBitte an ${d.email} antworten.\n`,
    undefined,
    branding
  );

  // 2) An die absendende Person – damit sie weiß, dass ihr Anliegen angekommen
  //    ist, und den eigenen Wortlaut in der Hand hat. Absender ist das
  //    Service-Postfach: Eine Antwort auf diese Mail landet damit genau dort,
  //    wo das Anliegen ohnehin liegt — nicht bei no-reply@ oder info@.
  await sendMail(
    d.email,
    "Ihre Nachricht ist bei uns eingegangen",
    `Guten Tag ${d.name},\n\n` +
      `vielen Dank für Ihre Nachricht. Sie ist mit folgendem Inhalt bei uns eingegangen:\n\n` +
      block +
      `\nWir melden uns so schnell wie möglich bei Ihnen. Wenn Sie etwas ergänzen möchten, ` +
      `antworten Sie einfach auf diese E-Mail.\n\n` +
      `Mit freundlichen Grüßen\n${signOffName(branding)}`,
    undefined,
    branding,
    { from: `${branding.displayName} <${SERVICE_EMAIL}>` }
  );

  redirect("/kontakt/danke");
}
