// Ein fehlgeschlagener Upload nennt seinen Grund — überall gleich.
//
// Vorher tat das nur der Wirtschaftsplan-Weg. Die normalen Formulare fingen
// stumm (`catch {}`) und leiteten mit `?fehler=datei` zurück; auf der Seite
// stand dann „Nur PDF oder Bilder bis 10 MB sind erlaubt" — auch dann, wenn die
// Datei tadellos war und in Wahrheit die Ablage fehlte. Wer daraufhin seine
// Datei verkleinert, sucht am falschen Ende, und zwar beliebig lange.
//
// Der Grund kommt als Query-Parameter `grund` von der Server-Action
// (`ablageFehlerText`, siehe lib/weg/ablage-fehler.ts). Er ist bereits für Laien
// formuliert und nennt selbst, welcher der drei Fälle vorliegt: System, Datei
// oder Verbindung.
//
// Banner, kein Toast — so verlangt es AGENTS.md („Fehler bleiben Banner"): Die
// Meldung muss stehen bleiben, bis der Fehler behoben ist.

import type { ReactNode } from "react";
import { Alert } from "@/components/ui";

export function AblageAlert({
  grund,
  titel = "Die Datei konnte nicht abgelegt werden.",
  variant = "error",
  className = "mb-4",
  children,
}: {
  /** Klartext aus `ablageFehlerText`. Fehlt er (alte Links), greift der Ersatztext. */
  grund?: string;
  titel?: ReactNode;
  /** `warning`, wenn der übrige Vorgang trotzdem gespeichert wurde. */
  variant?: "error" | "warning";
  className?: string;
  /** Zusatz, etwa was trotz des Fehlschlags gespeichert wurde. */
  children?: ReactNode;
}) {
  return (
    <Alert variant={variant} title={titel} className={className}>
      {grund?.trim()
        ? grund
        : "Der Grund wurde nicht übermittelt. Bitte erneut versuchen — bleibt es dabei, " +
          "liegt es vermutlich an der Dateiablage und nicht an Ihrer Datei."}
      {children ? <> {children}</> : null}
    </Alert>
  );
}
