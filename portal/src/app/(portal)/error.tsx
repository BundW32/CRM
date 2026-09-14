"use client";

// Was der Nutzer sieht, wenn eine Portalseite beim Rendern scheitert.
//
// ── Warum es diese Datei braucht ─────────────────────────────────────────────
//
// Ohne sie beantwortet Next.js einen Fehler in einer Server-Komponente mit
// **HTTP 200 und einer leeren Seite**: Die Navigationsleiste steht da, der
// Inhaltsbereich ist weiß, und nichts sagt, dass etwas schiefging. Für den
// Betrachter sieht das aus wie „hier gibt es nichts" — er sucht den Fehler bei
// sich, lädt neu, klickt woanders hin. Genau dieses Bild ist in einem
// Prüfbericht als „Seiteninhalt bleibt leer" gelandet, und beim Nachstellen
// hat es einen halben Prüflauf gekostet, es einem Serverfehler zuzuordnen
// statt dem Seitenaufbau.
//
// ── Abgrenzung zur `ErrorBoundary`-Komponente ────────────────────────────────
//
// `components/error-boundary.tsx` fängt EINEN Baustein ab, der einen sinnvollen
// Rückfall hat (die Dateivorschau: „Stattdessen herunterladen"). Ihr Kommentar
// hält fest, eine app-weite Grenze sei bewusst nicht gewollt, weil sie „die
// ganze Seite ersetzt". Das stimmt — und ist hier der richtige Weg: Wenn die
// Seite ohnehin leer bliebe, gibt es nichts zu erhalten. Die beiden Grenzen
// widersprechen sich also nicht, sie greifen an verschiedenen Stellen.
//
// Bewusst im `(portal)`-Segment und nicht global: Die Portal-Shell mit ihrer
// Navigation bleibt so stehen, und man kommt mit einem Klick woandershin,
// statt in einer Sackgasse zu landen.

import { useEffect } from "react";
import { Alert, Card, PageTitle, buttonClass, buttonSecondaryClass } from "@/components/ui";
import Link from "next/link";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Der Server hat den Fehler bereits protokolliert; der `digest` ist die
    // Klammer zwischen dem, was der Nutzer sieht, und dem Server-Log. Ohne ihn
    // ist eine Meldung wie „bei mir war die Seite leer" nicht auffindbar.
    console.error("Portalseite konnte nicht geladen werden", error);
  }, [error]);

  return (
    <>
      <PageTitle>Diese Seite konnte nicht geladen werden</PageTitle>
      <Card>
        <Alert variant="error">
          Beim Aufbau der Seite ist ein Fehler aufgetreten. Ihre Daten sind unverändert — es
          wurde nichts gespeichert und nichts gelöscht.
        </Alert>
        <p className="mt-4 text-sm text-gray-600">
          Häufig hilft schon ein zweiter Versuch. Bleibt es dabei, melden Sie sich bitte mit
          der Kennung unten — damit lässt sich der Vorgang im Protokoll wiederfinden.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-gray-500">Kennung: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className={buttonClass}>
            Erneut versuchen
          </button>
          <Link href="/dashboard" className={buttonSecondaryClass}>
            Zur Übersicht
          </Link>
        </div>
      </Card>
    </>
  );
}
