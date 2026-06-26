// White-Label-Branding (Phase 4.4)
// ---------------------------------
// Zentrale Helfer für die organisationsspezifische Darstellung: Akzentfarbe
// (überschreibt die Marken-Orange-Variablen zur Laufzeit) und Logo-URL.
// Die strukturelle Dunkelgrün-/Shell-Farbe bleibt als neutrale Chrome-Farbe
// bestehen – pro Mandant wird die Akzentfarbe und das Logo getauscht.

// Standard = aktuelles B&W-Orange (Fallback, wenn ein Mandant nichts gesetzt hat)
export const DEFAULT_PRIMARY = "#f69018";

// Validiert/normalisiert eine Hex-Farbe auf das Format „#rrggbb" (Kleinbuchstaben).
// Gibt null zurück, wenn die Eingabe keine gültige Hex-Farbe ist.
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  let hex = input.trim().toLowerCase();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  // Kurzform #abc -> #aabbcc
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
}

function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// Mischt eine Farbe mit Weiß (amount > 0) oder Schwarz (amount < 0).
// amount in [-1, 1]: -0.15 = 15 % dunkler, 0.9 = 90 % Richtung Weiß.
function mix(hex: string, amount: number): string {
  const [r, g, b] = toRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex(r + (target - r) * t, g + (target - g) * t, b + (target - b) * t);
}

// Leitet aus einer Primärfarbe die drei Marken-Orange-Slots ab:
//   base  – die Akzentfarbe selbst (Buttons, aktive Navigation, Badges)
//   dark  – ~16 % dunkler (Hover/aktive Zustände)
//   light – sehr heller Tint (Badge-Hintergründe, weiche Flächen)
export function deriveBrandShades(primary: string | null | undefined): {
  base: string;
  dark: string;
  light: string;
} {
  const base = normalizeHex(primary) ?? DEFAULT_PRIMARY;
  return {
    base,
    dark: mix(base, -0.16),
    light: mix(base, 0.9),
  };
}

// URL, unter der das Logo der Organisation ausgeliefert wird. Fällt auf das
// statische B&W-Logo zurück, wenn der Mandant (noch) kein eigenes hinterlegt hat.
export function orgLogoUrl(org: {
  id: string;
  logoStoredName: string | null;
}): string {
  return org.logoStoredName ? `/api/files/org-logo/${org.id}` : "/bw-logo.png";
}
