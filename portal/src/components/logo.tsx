// B&W-Logo als Bild. Verwendet die Originaldatei aus /public/bw-logo.png,
// damit es exakt dem Markenauftritt entspricht (Login, Header, Zugangsschreiben).

// Originalmaße der Logodatei (für seitenverhältnistreue Skalierung)
const LOGO_W = 1694;
const LOGO_H = 1143;

export function BwLogo({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/bw-logo.png"
      alt="B&W Immobilien Management"
      width={LOGO_W}
      height={LOGO_H}
      className={`h-24 w-auto ${className}`}
    />
  );
}

export function BwLogoCompact({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/bw-logo.png"
      alt="B&W Immobilien Management"
      width={LOGO_W}
      height={LOGO_H}
      className={`h-12 w-auto ${className}`}
    />
  );
}
