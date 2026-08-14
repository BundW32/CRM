"use client";

// Fehlergrenze für einzelne Bausteine.
//
// React reißt bei einem Fehler im Rendern standardmäßig den GANZEN Baum ab —
// aus einem kaputten Betrachter wird eine weiße Seite. Für Bausteine mit einem
// brauchbaren Rückfall (die Dateivorschau: „Stattdessen herunterladen") ist das
// die schlechtere Antwort.
//
// Bewusst KEINE app-weite `error.tsx`: Die fängt zwar dasselbe ab, ersetzt aber
// die ganze Seite. Hier soll nur der eine Baustein weichen.
//
// Grenze der Sache: Ein abgeschossener Renderer-Prozess (Speicher) kommt hier
// nie an — dagegen helfen nur die Grenzen in `lib/pdf-vorschau.ts`.
import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Was statt der Kinder erscheint. Als Funktion, wenn der Fehler gebraucht wird. */
  fallback: ReactNode | ((fehler: unknown) => ReactNode);
  /** Zum Melden/Protokollieren; die Grenze selbst schreibt nur in die Konsole. */
  onError?: (fehler: unknown) => void;
};

type State = { fehler: unknown };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { fehler: null };

  static getDerivedStateFromError(fehler: unknown): State {
    return { fehler };
  }

  componentDidCatch(fehler: unknown) {
    console.error("Baustein abgefangen", fehler);
    this.props.onError?.(fehler);
  }

  render() {
    if (this.state.fehler === null) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === "function" ? fallback(this.state.fehler) : fallback;
  }
}
