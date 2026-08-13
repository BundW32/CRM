"use client";

// „Öffnen"-Schaltfläche für Dateien: zeigt sie in der Vorschau (file-preview.tsx)
// statt in einem neuen Tab. Damit hat das Ansehen überall einen Rückweg — auch
// in der installierten PWA, wo ein inline geöffnetes PDF sonst in einem Vollbild
// ohne Bedienelemente endet.
//
// Der Betrachter wird erst beim ersten Klick nachgeladen; wer nie eine Datei
// öffnet, lädt pdf.js nie. Welcher Dateityp vorliegt, entscheidet die Vorschau
// selbst anhand der Antwort — die Aufrufseiten müssen ihn nicht kennen.
//
// Die Vorschau steckt in einer Fehlergrenze. Ohne sie reißt ein Fehler im
// Betrachter — oder schon ein fehlgeschlagener Nachladeversuch seines Bundles —
// die ganze Seite mit in einen weißen Bildschirm. Der Rückfall steht bewusst
// HIER und nicht in `file-preview.tsx`: Kommt dessen Bundle nicht an, ist von
// dort auch kein Rückfall zu holen.
import dynamic from "next/dynamic";
import { useState } from "react";
import { Download, X } from "lucide-react";
import { ErrorBoundary } from "./error-boundary";

const FilePreview = dynamic(() => import("./file-preview").then((m) => m.FilePreview), {
  ssr: false,
});

export function FilePreviewLink({
  src,
  title,
  className,
  children,
}: {
  /** Route, die die Datei ausliefert (ohne ?download=1). */
  src: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open ? (
        // Der Schlüssel setzt die Grenze beim erneuten Öffnen zurück — sonst
        // bliebe der Rückfall stehen, bis die Seite neu geladen wird.
        <ErrorBoundary
          key={src}
          fallback={
            <VorschauRueckfall src={src} title={title} onClose={() => setOpen(false)} />
          }
        >
          <FilePreview src={src} title={title} onClose={() => setOpen(false)} />
        </ErrorBoundary>
      ) : null}
    </>
  );
}

/** Was statt der Vorschau erscheint, wenn der Betrachter ausfällt. */
function VorschauRueckfall({
  src,
  title,
  onClose,
}: {
  src: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vorschau: ${title}`}
      className="fixed inset-0 z-50 flex flex-col bg-gray-900/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex shrink-0 items-center gap-2 bg-white px-3 py-2 shadow-sm sm:mx-auto sm:mt-6 sm:w-full sm:max-w-4xl sm:rounded-t-2xl">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Vorschau schließen"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-100 p-3 sm:mx-auto sm:mb-6 sm:w-full sm:max-w-4xl sm:rounded-b-2xl">
        <div className="mx-auto max-w-sm rounded-xl bg-white p-6 text-center">
          <p className="text-sm text-gray-700">Die Vorschau konnte nicht angezeigt werden.</p>
          <a
            href={`${src}${src.includes("?") ? "&" : "?"}download=1`}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 underline"
          >
            <Download className="h-4 w-4" />
            Stattdessen herunterladen
          </a>
        </div>
      </div>
    </div>
  );
}
