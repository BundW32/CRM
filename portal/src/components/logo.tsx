// B&W-Logo als transparentes PNG aus /public/bw-logo.png.
// Höhe wird über die className gesteuert (z. B. "h-16 w-auto").

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
