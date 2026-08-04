// Logos als transparente PNG aus /public.
// Höhe wird über die className gesteuert (z. B. "h-16 w-auto").
import { defaultLogoPath } from "@/lib/branding";

const LOGO_W = 1694;
const LOGO_H = 1143;

export function BwLogo({ className = "h-20 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/bw-logo.png"
      alt="B&W Immobilien Management"
      width={LOGO_W}
      height={LOGO_H}
      className={className}
    />
  );
}

export function BwLogoCompact({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/bw-logo.png"
      alt="B&W Immobilien Management"
      width={LOGO_W}
      height={LOGO_H}
      className={className}
    />
  );
}

// Organisationslogo (White-Label). `src` zeigt entweder auf das eigene Logo
// der Organisation (über /api/files/org-logo/…) oder fällt auf das B&W-Logo
// zurück. Die Maße sind unbekannt, daher wird die Höhe per className gesteuert.
export function OrgLogo({
  src,
  alt,
  className = "h-10 w-auto",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}

/**
 * Das Logo **dieses Deployments** — B&W oder wegportal24.
 *
 * Für die Seiten vor der Anmeldung (Login, Passwort vergessen, Einrichtung,
 * Handwerker-Link): Dort gibt es noch keine Organisation, deren Logo man zeigen
 * könnte, und bis hierher stand deshalb überall fest das B&W-Logo — auch auf
 * wegportal24.de, wo es die Marke eines fremden Unternehmens ist.
 *
 * Nur in Server-Komponenten verwenden: `defaultLogoPath()` liest `APP_MODE`.
 */
export function ProductLogo({ className = "h-20 w-auto" }: { className?: string }) {
  const src = defaultLogoPath();
  const weg = src.includes("wegportal24");
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={weg ? "wegportal24" : "B&W Immobilien Management"}
      width={weg ? 1473 : LOGO_W}
      height={weg ? 300 : LOGO_H}
      className={className}
    />
  );
}
