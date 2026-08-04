// Pure Prüf-Helfer für die Plattform-Betreiber-Ebene. Bewusst OHNE Import von
// session.ts, damit session.ts diese Funktionen nutzen kann (kein Zirkular-Import).

// Parst die Allowlist aus der Env: trennt an Kommas, trimmt, klein, leere raus.
export function parseAdminAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Ist dieser Nutzer ein Plattform-Betreiber? Es müssen BEIDE Wände fallen:
//
//  1. `User.isPlatformAdmin` in der Datenbank — nur per Migration oder Seed
//     setzbar, von keiner Oberfläche aus erreichbar.
//  2. die E-Mail-Adresse in der Env-Allowlist PLATFORM_ADMIN_EMAILS — nur wer
//     Zugriff auf die Server-Umgebung hat, kann sie ändern.
//
// Die Allowlist allein genügte NICHT, obwohl das Schema die doppelte Wand seit
// jeher beschreibt: Ein Verwalter darf in seiner eigenen Organisation Nutzer mit
// frei gewählter E-Mail-Adresse anlegen und deren Erstpasswort setzen
// (verwaltung/nutzer/actions.ts). Er legte damit einen Nutzer auf eine Adresse
// aus der Allowlist an, meldete sich mit dem selbst vergebenen Passwort an und
// war Betreiber über sämtliche Mandanten. Die einzige Bremse war die
// Eindeutigkeit der E-Mail-Spalte — also genau die Adressen, zu denen noch kein
// Konto besteht, und das sind Support- und Sammeladressen. Das Datenbank-Flag
// schließt diesen Weg: Es lässt sich über keine Anwendungsfunktion setzen.
export function isPlatformAdminUser(user: {
  email: string | null;
  isPlatformAdmin?: boolean;
}): boolean {
  if (!user.isPlatformAdmin) return false;
  if (!user.email) return false;
  const allow = parseAdminAllowlist(process.env.PLATFORM_ADMIN_EMAILS);
  return allow.includes(user.email.trim().toLowerCase());
}
