import type { MetadataRoute } from "next";
import { isWegSaas } from "@/lib/app-mode";
import { siteUrl } from "@/lib/site-url";

// ── sitemap.xml ────────────────────────────────────────────────────────────
// Es gab keine. Ohne Sitemap findet eine Suchmaschine die Unterseiten nur
// über interne Links — die Funktions- und Rechtsseiten hängen aber teils tief
// in der Navigation.
//
// Bewusst eine gepflegte Liste statt einer Ableitung aus dem Dateisystem: Der
// app-Ordner enthält auch alles hinter der Anmeldung, und eine Sitemap, die
// /dashboard meldet, schickt Crawler auf Weiterleitungen zum Login.
type Eintrag = {
  pfad: string;
  prioritaet: number;
  frequenz: "weekly" | "monthly" | "yearly";
};

const OEFFENTLICHE_SEITEN: Eintrag[] = [
  { pfad: "/", prioritaet: 1.0, frequenz: "weekly" },
  { pfad: "/so-funktionierts", prioritaet: 0.9, frequenz: "monthly" },
  { pfad: "/preise", prioritaet: 0.9, frequenz: "monthly" },
  { pfad: "/funktionen/finanzen", prioritaet: 0.8, frequenz: "monthly" },
  { pfad: "/funktionen/hausgeld", prioritaet: 0.8, frequenz: "monthly" },
  { pfad: "/funktionen/versammlung", prioritaet: 0.8, frequenz: "monthly" },
  { pfad: "/funktionen/kommunikation", prioritaet: 0.8, frequenz: "monthly" },
  { pfad: "/funktionen/sondereigentum", prioritaet: 0.8, frequenz: "monthly" },
  { pfad: "/funktionen/ki-berater", prioritaet: 0.8, frequenz: "monthly" },
  // /registrieren steht bewusst NICHT hier: Die Seite trägt seit dem
  // 12.08.2026 ein `noindex` (Formular mit 89 Wörtern Text). Eine Sitemap, die
  // eine nicht indexierbare Adresse meldet, widerspricht sich selbst — die
  // Search Console meldet das als „Von der Sitemap gemeldete Seite ist
  // ausgeschlossen".
  { pfad: "/impressum", prioritaet: 0.3, frequenz: "yearly" },
  { pfad: "/datenschutz", prioritaet: 0.3, frequenz: "yearly" },
  { pfad: "/agb", prioritaet: 0.3, frequenz: "yearly" },
  { pfad: "/widerruf", prioritaet: 0.3, frequenz: "yearly" },
  { pfad: "/kuendigen", prioritaet: 0.2, frequenz: "yearly" },
  { pfad: "/avv", prioritaet: 0.2, frequenz: "yearly" },
  { pfad: "/ki-transparenz", prioritaet: 0.2, frequenz: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // Die B&W-Tür hat keine öffentlichen Seiten — eine leere Sitemap ist dort
  // die ehrliche Antwort (robots.txt sperrt sie ohnehin komplett).
  if (!isWegSaas()) return [];

  const basis = siteUrl();
  const stand = new Date();

  return OEFFENTLICHE_SEITEN.map(({ pfad, prioritaet, frequenz }) => ({
    url: basis + pfad,
    lastModified: stand,
    changeFrequency: frequenz,
    priority: prioritaet,
  }));
}
