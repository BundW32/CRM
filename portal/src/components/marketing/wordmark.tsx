// Marke „wegportal24" der öffentlichen Seiten: Bildzeichen + Wortmarke.
//
// Das Bildzeichen zeigt Miteigentumsanteile – ein Quadrat, in ungleiche Anteile
// geteilt, so wie eine Teilungserklärung ein Haus aufteilt. Der große Anteil
// trägt das Marken-Orange: die eigene Wohnung in der Gemeinschaft. Es besteht
// bewusst nur aus Rechtecken, damit es bis auf Favicon-Größe und im
// Schwarzweiß-Druck lesbar bleibt.
//
// Die Wortmarke ist Text statt Bild: skaliert scharf, ist vorlesbar und braucht
// keine zusätzliche Datei im Build. Nur für die öffentlichen Seiten der
// Hauptdomain – im Portal selbst bleibt das Logo der jeweiligen Organisation
// maßgeblich (siehe components/logo.tsx).

// `tone` steuert die Farbgebung: „dark" für helle Flächen (Kopfzeile, weiße
// Karten), „light" für die dunkelgrünen Marken-Flächen (Fußzeile).
export function Wordmark({
  className = "text-xl",
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandGlyph tone={tone} />
      <span
        className={`font-display font-extrabold tracking-tight ${
          tone === "light" ? "text-white" : "text-brand-green-dark"
        }`}
      >
        wegportal
        <span className="text-brand-orange">24</span>
      </span>
    </span>
  );
}

// Das Bildzeichen allein – für Stellen, an denen der Name schon danebensteht
// oder der Platz für die Wortmarke fehlt. Die Höhe folgt der Schriftgröße
// (1em), damit Zeichen und Wortmarke immer zusammenpassen.
export function BrandGlyph({
  tone = "dark",
  className = "",
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  // Die beiden kleinen Anteile laufen in der Textfarbe mit, der große Anteil
  // bleibt in jedem Kontext orange.
  const solid = tone === "light" ? "#ffffff" : "#00241f";
  return (
    <svg
      viewBox="0 0 36 36"
      aria-hidden="true"
      focusable="false"
      className={`h-[1em] w-[1em] shrink-0 ${className}`}
    >
      <rect x="0" y="0" width="16" height="16" rx="2.5" fill={solid} />
      <rect x="0" y="20" width="16" height="16" rx="2.5" fill={solid} />
      <rect x="20" y="0" width="16" height="36" rx="2.5" fill="#f69018" />
    </svg>
  );
}
