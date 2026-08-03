// Wortmarke „wegportal.24" der öffentlichen Landing Page.
// Bewusst als Text statt als Bild-Asset: skaliert scharf in jeder Größe, ist
// vorlesbar für Screenreader und braucht keine zusätzliche Datei im Build.
// Nur für die Marketing-Seiten der Hauptdomain – im Portal selbst bleibt das
// Logo der jeweiligen Organisation (siehe components/logo.tsx) maßgeblich.

// `tone` steuert die Farbgebung: „dark" für helle Flächen (Kopfzeile),
// „light" für die dunkelgrünen Marken-Flächen (Fußzeile).
export function Wordmark({
  className = "text-xl",
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span
      className={`font-display font-extrabold tracking-tight ${
        tone === "light" ? "text-white" : "text-brand-green-dark"
      } ${className}`}
    >
      wegportal
      <span className="text-brand-orange">.24</span>
    </span>
  );
}
