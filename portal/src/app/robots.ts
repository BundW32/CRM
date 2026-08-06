import type { MetadataRoute } from "next";
import { isWegSaas } from "@/lib/app-mode";
import { siteUrl } from "@/lib/site-url";

// ── robots.txt ───────────────────────────────────────────────────────────────
// Es gab keine: /robots.txt lief in den Catch-all der Anwendung und lieferte
// HTML mit Status 404. Suchmaschinen lesen daraus „keine Regeln, keine
// Sitemap“, Prüfwerkzeuge melden einen Fehler.
//
// Zwei Türen, zwei Regelsätze: Die B&W-Variante ist ein reines Kundenportal
// ohne öffentliche Inhalte und gehört vollständig aus dem Index. Nur
// wegportal24 hat Marketing-Seiten, die gefunden werden sollen.
export default function robots(): MetadataRoute.Robots {
  if (!isWegSaas()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Alles hinter der Anmeldung: für Suchmaschinen wertlos, teilweise
        // personenbezogen. Die Seiten sind ohnehin rechtegeprüft — der
        // Eintrag spart den Crawl-Etat für die öffentlichen Seiten.
        disallow: [
          "/api/",
          "/dashboard",
          "/verwaltung",
          "/auftraege",
          "/onboarding",
          "/setup",
          "/uebergabe",
          "/plattform",
          "/passwort-festlegen",
          "/zugangsschreiben",
        ],
      },
    ],
    sitemap: siteUrl() + "/sitemap.xml",
    host: siteUrl(),
  };
}
