// Geldbeträge werden als Ganzzahl in Cent gespeichert (keine Float-Rundungsfehler).
// Reine Anzeige-/Eingabe-Helfer – kein Buchhaltungsmodul.

// Parst eine Nutzereingabe ("480", "480,00", "1.234,56", "1234.56") in Cent.
// Liefert null bei leerer/ungültiger Eingabe.
export function parseEuroToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Tausenderpunkte entfernen, Dezimal-Komma in Punkt wandeln
  let normalized = trimmed.replace(/\s|€/g, "");
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

// Formatiert Cent als deutschen Euro-Betrag, z. B. 48000 → "480,00 €".
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
