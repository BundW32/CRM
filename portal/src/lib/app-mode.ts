// ── App-Modus (Bereitstellungs-Variante) ─────────────────────────────────────
// EINE Codebasis, ZWEI Vercel-Projekte. Unterschieden allein über die Server-Env
// `APP_MODE`. Domänen-/Feature-Unterschiede laufen weiterhin über
// `Organization.accountType` + `isSelfManaged()` (siehe src/lib/access.ts) – dieser
// Helfer steuert nur das domainunabhängige Gating (Registrierung, Startseite).
//
//   "verwaltung" (Default): B&W-Tür – Single-Tenant, KEINE Registrierung,
//                           volle Profi-Features, Domain portal.bundwimmobilien.de.
//   "weg":                  WEG-SaaS – öffentliche Selbstverwalter-WEGs,
//                           Registrierung an (immer accountType="selbstverwalter"),
//                           eigene DB/Domain/E-Mail, kein Inbound.
export type AppMode = "verwaltung" | "weg";

// Aktueller Modus. Default ist "verwaltung"; "weg" NUR bei APP_MODE==="weg".
// Bewusst strikt (exakter Vergleich), damit ein Tippfehler nie versehentlich die
// öffentliche Registrierung freischaltet.
export function appMode(): AppMode {
  return process.env.APP_MODE === "weg" ? "weg" : "verwaltung";
}

// Ist dieses Deployment die WEG-SaaS-Variante?
export function isWegSaas(): boolean {
  return appMode() === "weg";
}

// Ist die öffentliche Self-Service-Registrierung erlaubt? Nur im "weg"-Modus.
export function registrationEnabled(): boolean {
  return isWegSaas();
}

// Produktname für Fließtext auf Seiten, die BEIDE Türen ausliefern (Rechtsseiten,
// insbesondere /ki-transparenz). Ohne diesen Helfer stünde auf
// portal.bundwimmobilien.de „wegportal24 ist Anbieter der KI-Funktionen" – eine
// Aussage über das falsche Produkt. Für das Logo gibt es <PublicBrand />.
export function productName(): string {
  return isWegSaas() ? "wegportal24" : "B&W Kundenportal";
}
