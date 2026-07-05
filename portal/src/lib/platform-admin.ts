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

// Ist dieser Nutzer ein Plattform-Betreiber? Flag UND E-Mail in der Allowlist.
export function isPlatformAdminUser(
  user: { isPlatformAdmin: boolean; email: string | null },
): boolean {
  if (!user.isPlatformAdmin) return false;
  if (!user.email) return false;
  const allow = parseAdminAllowlist(process.env.PLATFORM_ADMIN_EMAILS);
  return allow.includes(user.email.trim().toLowerCase());
}
