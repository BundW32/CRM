// Absolute Portal-URL aus einer FESTEN Basis (PORTAL_BASE_URL). Bewusst rein und
// OHNE Server-Abhängigkeiten (kein next/headers), damit dieser Helfer auch in
// Client-Komponenten importierbar bleibt. Für request-abhängige Links (richtige
// Domain aus dem aktuellen Host) siehe portalUrlFromRequest in url-server.ts.
export function portalUrl(path: string) {
  const base = process.env.PORTAL_BASE_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}
