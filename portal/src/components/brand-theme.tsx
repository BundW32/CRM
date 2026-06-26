import { deriveBrandShades } from "@/lib/branding";

// Überschreibt zur Laufzeit die Marken-Akzentfarbe (Orange-Slots) mit der
// Primärfarbe der Organisation. Das <style>-Tag steht nach dem Tailwind-CSS in
// der Kaskade und gewinnt daher gegen die :root-Defaults aus globals.css.
// Wird nichts gesetzt, bleibt es bei der Standard-Marke (B&W-Orange).
export function BrandTheme({ primaryColor }: { primaryColor: string | null }) {
  const { base, dark, light } = deriveBrandShades(primaryColor);
  const css = `:root{--color-brand-orange:${base};--color-brand-orange-dark:${dark};--color-brand-orange-light:${light};}`;
  return <style>{css}</style>;
}
