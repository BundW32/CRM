"use server";

import { SERVICE_EMAIL } from "@/components/marketing/brand";
import { isWegSaas } from "@/lib/app-mode";
import { signOffName } from "@/lib/branding";
import { fallbackBranding } from "@/lib/branding-server";
import { baueHilfeMail, hilfeEmpfaenger, hilfeSchema } from "@/lib/hilfe-anfrage";
import { parseBildschirmfoto } from "@/lib/hilfe-bildschirmfoto";
import { roleLabels } from "@/lib/labels";
import { isMailEnabled, sendMail } from "@/lib/mailer";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrganization, requireUser } from "@/lib/session";

/**
 * „Problem melden" aus dem schwebenden Hilfe-Knopf der Portal-Shell.
 *
 * Nur für angemeldete Personen — Name, E-Mail, Rolle und Organisation kommen
 * aus der Sitzung, nicht aus dem Formular. Gespeichert wird nichts: Die
 * Meldung geht als E-Mail an das Betreiber-Postfach (`hilfeEmpfaenger`), die
 * Person bekommt eine Eingangsbestätigung. Kein Redirect, weil das Widget auf
 * jeder Seite sitzt und dort bleiben soll — die Rückmeldung läuft über den
 * zurückgegebenen Zustand (`useActionState`).
 */

export type HilfeState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "fehler"; grund: "eingabe" | "limit" | "versand"; empfaenger: string };

export async function sendeHilfeanfrage(_prev: HilfeState, formData: FormData): Promise<HilfeState> {
  const user = await requireUser();
  const empfaenger = hilfeEmpfaenger();

  // Ohne SMTP käme die Meldung nirgends an — das sagen wir, statt „Danke" zu
  // zeigen und die Person auf eine Antwort warten zu lassen.
  if (!isMailEnabled()) {
    return { status: "fehler", grund: "versand", empfaenger };
  }

  // Drossel je Nutzer (nicht je IP — die Person ist bekannt). Fünf Meldungen
  // pro Stunde reichen für jedes echte Anliegen.
  if (!(await checkRateLimit(`hilfe:${user.id}`, 5, 3600))) {
    return { status: "fehler", grund: "limit", empfaenger };
  }

  const parsed = hilfeSchema.safeParse({
    art: String(formData.get("art") ?? ""),
    nachricht: formData.get("nachricht"),
    seite: String(formData.get("seite") ?? "") || undefined,
    browser: String(formData.get("browser") ?? "") || undefined,
  });
  if (!parsed.success) {
    return { status: "fehler", grund: "eingabe", empfaenger };
  }

  // Bildschirmfoto (freiwillig, vom Widget aufgenommen). Passt es nicht ins
  // Format oder Maß, geht die Meldung ohne Bild raus — nie gar nicht.
  const foto = parseBildschirmfoto(formData.get("foto"));

  const org = await getOrganization();
  const branding = fallbackBranding();
  const mail = baueHilfeMail(
    parsed.data,
    {
      id: user.id,
      name: user.name,
      email: user.email,
      rolle: roleLabels[user.role],
      organisation: org?.name ?? "–",
    },
    { mitFoto: foto !== null },
  );

  // 1) An den Betreiber, mit Bildschirmfoto als Anhang. Ohne diese Mail
  //    bliebe die Meldung folgenlos.
  await sendMail(empfaenger, mail.betreff, mail.text, foto ? [foto] : undefined, branding);

  // 2) Eingangsbestätigung an die Person (Zugänge ohne E-Mail bekommen keine —
  //    sendMail überspringt sie), ohne das Foto: Die Person hat die Seite selbst
  //    vor sich, und der Anhang würde nur ihr Postfach füllen. Auf wegportal24
  //    tritt das Service-Postfach als Absender auf, damit eine Antwort direkt
  //    beim Anliegen landet.
  await sendMail(
    user.email,
    "Ihre Meldung ist bei uns eingegangen",
    `Guten Tag ${user.name},\n\n` +
      `vielen Dank für Ihre Meldung. Sie ist mit folgendem Inhalt bei uns eingegangen:\n\n` +
      mail.block +
      `\nWir melden uns so schnell wie möglich bei Ihnen. Wenn Sie etwas ergänzen möchten, ` +
      `antworten Sie einfach auf diese E-Mail.\n\n` +
      `Mit freundlichen Grüßen\n${signOffName(branding)}`,
    undefined,
    branding,
    isWegSaas() ? { from: `${branding.displayName} <${SERVICE_EMAIL}>` } : {},
  );

  return { status: "ok" };
}
