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

// Logo auf weißem „Chip" – für dunkle Hintergründe (Login, Setup, Hero),
// damit der dunkelgrüne Schriftzug lesbar bleibt.
export function BwLogoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex rounded-2xl bg-white px-6 py-4 shadow-xl shadow-black/25 ${className}`}
    >
      <BwLogo />
    </span>
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
      className={`h-10 w-auto ${className}`}
    />
  );
}
