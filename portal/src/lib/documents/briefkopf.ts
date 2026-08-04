// Absenderangaben und Mandantenoptik für Briefe — einmal aus dem Branding
// abgeleitet, damit jeder Brief denselben Kopf trägt.
//
// Bisher baute jede Route ihre eigene `contactLine` zusammen und keine nutzte
// `primaryColor` oder ein Logo: Alle Dokumente kamen im festen B&W-Grün heraus,
// gleich welcher Mandant sie verschickte.
import path from "node:path";
import { defaultLogoPath, type OrgBranding } from "@/lib/branding";
import { readUpload } from "@/lib/storage";
import { brandColor } from "./kit";
import type { LetterIssuer } from "./kit";

export type Briefkopf = {
  issuer: LetterIssuer;
  brand: ReturnType<typeof brandColor>;
  /** Bilddaten des hochgeladenen Logos oder der Pfad zum Standardlogo. */
  logo: string | Uint8Array | null;
  city: string | null;
};

// Das Logo des Produkts, wenn der Mandant keins hochgeladen hat. Auf
// wegportal24 ist das nicht B&W — sonst trüge jede Jahresabrechnung, jede
// Einladung und jede Mahnung einer selbstverwaltenden Gemeinschaft die Marke
// einer fremden Hausverwaltung im Briefkopf.
function standardLogo(): string {
  return path.join(process.cwd(), "public", defaultLogoPath().replace(/^\//, ""));
}

export async function briefkopfAus(branding: OrgBranding): Promise<Briefkopf> {
  const kontakt = [branding.addressLine, branding.email, branding.phone].filter(
    (value): value is string => Boolean(value),
  );
  return {
    issuer: { legalName: branding.legalName, lines: kontakt },
    brand: brandColor(branding.primaryColor),
    logo: await ladeLogo(branding.logoStoredName),
    city: branding.city,
  };
}

/**
 * Ein hochgeladenes Mandantenlogo liegt im Dateispeicher (Blob, Datei oder
 * Data-URL). Fehlt es oder lässt es sich nicht lesen, bleibt es beim
 * Standardlogo: Ein abgebrochener Export wäre schlimmer als ein Brief ohne das
 * eigene Signet.
 */
async function ladeLogo(storedName: string | null): Promise<string | Uint8Array | null> {
  if (!storedName) return standardLogo();
  try {
    return new Uint8Array(await readUpload(storedName));
  } catch {
    return standardLogo();
  }
}
