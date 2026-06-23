export function portalUrl(path: string) {
  const base = process.env.PORTAL_BASE_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}
