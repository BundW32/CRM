// Absenderangaben und Mandantenoptik für Briefe — einmal aus dem Branding
// abgeleitet, damit jeder Brief denselben Kopf trägt.
//
// Bisher baute jede Route ihre eigene `contactLine` zusammen und keine nutzte
// `primaryColor` oder ein Logo: Alle Dokumente kamen im festen B&W-Grün heraus,
// gleich welcher Mandant sie verschickte.
import path from "node:path";
import type { OrgBranding } from "@/lib/branding";
import { brandColor } from "./kit";
import type { LetterIssuer } from "./kit";

export type Briefkopf = {
  issuer: LetterIssuer;
  brand: ReturnType<typeof brandColor>;
  logoPath: string | null;
  city: string | null;
};

export function briefkopfAus(branding: OrgBranding): Briefkopf {
  const kontakt = [branding.addressLine, branding.email, branding.phone].filter(
    (value): value is string => Boolean(value),
  );
  return {
    issuer: { legalName: branding.legalName, lines: kontakt },
    brand: brandColor(branding.primaryColor),
    // Ein hochgeladenes Mandantenlogo liegt im Dateispeicher und wird erst mit
    // der Branding-Stufe eingebunden; bis dahin trägt nur der Standardmandant
    // sein Logo im Brief.
    logoPath: branding.logoStoredName
      ? null
      : path.join(process.cwd(), "public", "bw-logo.png"),
    city: branding.city,
  };
}
