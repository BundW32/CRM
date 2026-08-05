"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signOffName } from "@/lib/branding";
import { fallbackBranding } from "@/lib/branding-server";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Kündigungserklärung über die Kündigungsschaltfläche (§ 312k BGB).
 *
 * Bewusst OHNE Anmeldung: Die Vorschrift verlangt, dass die Schaltfläche
 * ständig verfügbar sowie unmittelbar und leicht zugänglich ist. Eine
 * Kündigung, die erst nach erfolgreichem Login möglich wäre, hinge am
 * Passwort — und genau daran scheitert sie im Zweifel.
 *
 * Deshalb gilt hier auch: Es wird NICHTS gelöscht und kein Konto gesperrt.
 * Die Erklärung wird zugestellt und bestätigt; über die Beendigung entscheidet
 * die Anbieterin anhand der Vertragslage. Andernfalls könnte ein Fremder mit
 * geratener E-Mail-Adresse den Zugang einer Gemeinschaft abschalten.
 */

const schema = z.object({
  art: z.enum(["ordentlich", "ausserordentlich"]),
  gemeinschaft: z.string().trim().min(2).max(200),
  name: z.string().trim().min(2).max(200),
  email: z.email(),
  // Freiwillig – § 312k verlangt keine Begründung für die ordentliche Kündigung.
  kundennummer: z.string().trim().max(200).optional(),
  zeitpunkt: z.string().trim().max(200).optional(),
  grund: z.string().trim().max(2000).optional(),
});

export async function erklaereKuendigung(formData: FormData) {
  // Missbrauchsschutz: Der Weg steht offen im Netz. Fünf Erklärungen je IP und
  // Stunde reichen für jeden echten Fall.
  const ip = await getClientIp();
  if (!(await checkRateLimit(`kuendigung:${ip}`, 5, 3600))) {
    redirect("/kuendigen?fehler=limit");
  }

  const parsed = schema.safeParse({
    art: String(formData.get("art") ?? "ordentlich"),
    gemeinschaft: formData.get("gemeinschaft"),
    name: formData.get("name"),
    email: formData.get("email"),
    kundennummer: String(formData.get("kundennummer") ?? "") || undefined,
    zeitpunkt: String(formData.get("zeitpunkt") ?? "") || undefined,
    grund: String(formData.get("grund") ?? "") || undefined,
  });
  if (!parsed.success) {
    redirect("/kuendigen?fehler=eingabe");
  }

  const d = parsed.data;
  const branding = fallbackBranding();
  const eingang = new Date();
  const eingangText = eingang.toLocaleString("de-DE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });

  const artText =
    d.art === "ausserordentlich"
      ? "Außerordentliche Kündigung aus wichtigem Grund"
      : "Ordentliche Kündigung";

  const block =
    `Art der Kündigung: ${artText}\n` +
    `Gemeinschaft / Kunde: ${d.gemeinschaft}\n` +
    `Erklärende Person: ${d.name}\n` +
    `E-Mail: ${d.email}\n` +
    (d.kundennummer ? `Kunden-/Vertragsnummer: ${d.kundennummer}\n` : "") +
    (d.zeitpunkt ? `Gewünschter Beendigungszeitpunkt: ${d.zeitpunkt}\n` : "") +
    (d.grund ? `Grund: ${d.grund}\n` : "") +
    `Eingang: ${eingangText}\n`;

  // 1) An die Anbieterin. Ohne diese Nachricht bliebe die Erklärung folgenlos.
  await sendMail(
    branding.email,
    `Kündigung über die Kündigungsschaltfläche – ${d.gemeinschaft}`,
    `Über die Kündigungsschaltfläche nach § 312k BGB ist folgende Erklärung eingegangen:\n\n` +
      block +
      `\nBitte den Zugang der Erklärung in Textform bestätigen und die Beendigung zum ` +
      `zulässigen Zeitpunkt vormerken.\n`,
    undefined,
    branding
  );

  // 2) An die erklärende Person – die Bestätigung nach § 312k Abs. 4 BGB.
  //    Sie muss den Inhalt, das Datum des Zugangs und den Zeitpunkt der
  //    Beendigung wiedergeben, soweit dieser feststeht.
  await sendMail(
    d.email,
    "Ihre Kündigung ist bei uns eingegangen",
    `Guten Tag ${d.name},\n\n` +
      `wir bestätigen den Zugang Ihrer Kündigungserklärung mit folgendem Inhalt:\n\n` +
      block +
      `\nWir prüfen die Erklärung und teilen Ihnen den Zeitpunkt der Vertragsbeendigung ` +
      `gesondert mit. Nach den Allgemeinen Geschäftsbedingungen endet der Vertrag zum Ende ` +
      `des laufenden Abrechnungsmonats, sofern kein anderer Zeitpunkt gilt.\n\n` +
      `Ihre Daten bleiben bis zur Beendigung unverändert zugänglich; danach können Sie sie ` +
      `noch mindestens 30 Tage lang exportieren.\n\n` +
      `Diese Bestätigung wurde automatisch erzeugt. Sie können auf diese E-Mail antworten.\n\n` +
      `Mit freundlichen Grüßen\n${signOffName(branding)}`,
    undefined,
    branding
  );

  redirect("/kuendigen/bestaetigt");
}
