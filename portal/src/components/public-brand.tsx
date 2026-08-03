// Markenzeichen auf den öffentlichen Rechtsseiten (/impressum, /datenschutz,
// /agb, /avv, /ki-transparenz). Diese Seiten teilen sich beide Türen, tragen
// aber je Deployment eine andere Marke:
//
//   APP_MODE=weg         → Wortmarke „wegportal24", verlinkt auf die Landing
//   APP_MODE=verwaltung  → B&W-Logo (portal.bundwimmobilien.de), ohne Link:
//                          dort ist „/" nur eine Weiterleitung zum Login.
//
// Ohne diese Weiche stünde das B&W-Impressum unter fremder Marke – die
// Landing-Page-Vorlage hatte das Logo bedingungslos ersetzt.
import Link from "next/link";
import { BwLogo } from "@/components/logo";
import { Wordmark } from "@/components/marketing/wordmark";
import { isWegSaas } from "@/lib/app-mode";

export function PublicBrand() {
  if (!isWegSaas()) return <BwLogo className="mb-6 h-14 w-auto" />;
  return (
    <Link href="/" className="mb-6 inline-block" aria-label="wegportal24 – zur Startseite">
      <Wordmark className="text-2xl" />
    </Link>
  );
}
