// Hilfsfunktionen für Server Actions: Next.js signalisiert redirect()/notFound()
// intern über geworfene Fehler mit einem speziellen `digest`. Diese dürfen in
// einem catch-Block NICHT verschluckt werden, sondern müssen erneut geworfen
// werden, damit die Navigation funktioniert.
export function isNextControlFlowError(e: unknown): boolean {
  if (typeof e !== "object" || e === null || !("digest" in e)) return false;
  const digest = (e as { digest: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}

// Liefert eine kurze, für die URL geeignete Fehlermeldung.
export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/\s+/g, " ").trim().slice(0, 180);
}
