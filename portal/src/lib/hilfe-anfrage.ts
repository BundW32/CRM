// Hilfe-Anfrage aus dem angemeldeten Bereich („Problem melden").
//
// Der schwebende Hilfe-Knopf in der Portal-Shell (`components/help-widget.tsx`)
// schickt die Schilderung als E-Mail an das Betreiber-Postfach — gespeichert
// wird nichts. Die reine Logik (Prüfung der Eingabe, Empfänger, Mailtext) liegt
// hier, damit sie ohne SMTP und Sitzung prüfbar ist; die Server-Action in
// `app/(portal)/hilfe/actions.ts` hängt nur noch Sitzung, Drossel und Versand an.
//
// Anders als der Kontakt-Funnel (/kontakt) kennt dieser Weg die Person schon:
// Name, E-Mail, Rolle und Organisation kommen aus der Sitzung, nicht aus dem
// Formular. Dazu tragen wir Seite und Browser mit — genau die zwei Angaben, die
// bei „geht nicht" sonst in der ersten Rückfrage erfragt werden müssten.

import { z } from "zod";
import { SERVICE_EMAIL } from "@/components/marketing/brand";
import { isWegSaas } from "@/lib/app-mode";
import { fallbackBranding } from "@/lib/branding-server";

export const HILFE_ARTEN = {
  fehler: "Etwas funktioniert nicht",
  frage: "Ich habe eine Frage",
  sonstiges: "Sonstiges",
} as const;

export type HilfeArt = keyof typeof HILFE_ARTEN;

export const hilfeSchema = z.object({
  art: z.enum(["fehler", "frage", "sonstiges"]),
  nachricht: z.string().trim().min(10).max(5000),
  // Vom Widget automatisch befüllt; beides optional, weil ein Nutzer auch ohne
  // JavaScript-Kontext eine Meldung loswerden können soll.
  seite: z.string().trim().max(300).optional(),
  browser: z.string().trim().max(500).optional(),
});

export type HilfeEingabe = z.infer<typeof hilfeSchema>;

/**
 * Empfänger der Meldung: auf wegportal24 das Service-Postfach (wie der
 * Kontakt-Funnel), auf der B&W-Tür die Adresse des Deployment-Brandings.
 */
export function hilfeEmpfaenger(): string {
  if (isWegSaas()) return SERVICE_EMAIL;
  return fallbackBranding().email ?? "info@bundwimmobilien.de";
}

export type HilfeAbsender = {
  id: string;
  name: string;
  email: string | null;
  rolle: string;
  organisation: string;
};

export type HilfeMail = { betreff: string; text: string; block: string };

/**
 * Baut Betreff und Text der Betreiber-Mail. `block` ist der Kern (Angaben +
 * Schilderung) und wird in der Eingangsbestätigung an die Person wiederverwendet.
 */
export function baueHilfeMail(
  eingabe: HilfeEingabe,
  absender: HilfeAbsender,
  jetzt: Date = new Date(),
): HilfeMail {
  const eingang = jetzt.toLocaleString("de-DE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });

  const block =
    `Art: ${HILFE_ARTEN[eingabe.art]}\n` +
    `Name: ${absender.name}\n` +
    `E-Mail: ${absender.email ?? "– (Zugang ohne E-Mail-Adresse)"}\n` +
    `Rolle: ${absender.rolle}\n` +
    `Organisation: ${absender.organisation}\n` +
    `Nutzer-ID: ${absender.id}\n` +
    (eingabe.seite ? `Seite: ${eingabe.seite}\n` : "") +
    (eingabe.browser ? `Browser: ${eingabe.browser}\n` : "") +
    `Eingang: ${eingang}\n\n` +
    `Schilderung:\n${eingabe.nachricht}\n`;

  const betreff = `[Hilfe] ${HILFE_ARTEN[eingabe.art]} – ${absender.name} (${absender.organisation})`;

  const antwortHinweis = absender.email
    ? `Bitte an ${absender.email} antworten.`
    : `Die Person hat keine E-Mail-Adresse hinterlegt — Rückmeldung nur über das Portal (Nachrichten) oder die verwaltende Person.`;

  const text =
    `Über den Hilfe-Knopf im angemeldeten Bereich ist folgende Meldung eingegangen:\n\n` +
    block +
    `\n${antwortHinweis}\n`;

  return { betreff, text, block };
}
