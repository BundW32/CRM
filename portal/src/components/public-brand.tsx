// Markenzeichen auf den öffentlichen Seiten, die BEIDE Türen ausliefern:
// Rechtsseiten (/impressum, /datenschutz, /agb, /avv, /ki-transparenz) und der
// Login. Je Deployment eine andere Marke:
//
//   APP_MODE=weg         → Wortmarke „wegportal24", verlinkt auf die Landing
//   APP_MODE=verwaltung  → B&W-Logo (portal.bundwimmobilien.de), ohne Link:
//                          dort ist „/" nur eine Weiterleitung zum Login.
//
// Ohne diese Weiche stünde das B&W-Impressum unter fremder Marke – die
// Landing-Page-Vorlage hatte das Logo bedingungslos ersetzt –, und umgekehrt
// begrüßte das B&W-Logo die Selbstverwalter auf wegportal24.de/login.
//
// `variant` unterscheidet nur die Größe: „legal" sitzt links über der Überschrift
// einer Rechtsseite, „login" zentriert über dem Anmeldeformular.
import Link from "next/link";
import { BwLogo } from "@/components/logo";
import { Wordmark } from "@/components/marketing/wordmark";
import { isWegSaas } from "@/lib/app-mode";

export function PublicBrand({ variant = "legal" }: { variant?: "legal" | "login" }) {
  const login = variant === "login";

  if (!isWegSaas()) {
    return <BwLogo className={login ? "mx-auto mb-1 h-20 w-auto" : "mb-6 h-14 w-auto"} />;
  }

  return (
    <Link
      href="/"
      className={login ? "mb-2 block text-center" : "mb-6 inline-block"}
      aria-label="wegportal24 – zur Startseite"
    >
      <Wordmark className={login ? "text-3xl" : "text-2xl"} />
    </Link>
  );
}
