"use client";

// „Öffnen"-Schaltfläche für Dateien: zeigt sie in der Vorschau (file-preview.tsx)
// statt in einem neuen Tab. Damit hat das Ansehen überall einen Rückweg — auch
// in der installierten PWA, wo ein inline geöffnetes PDF sonst in einem Vollbild
// ohne Bedienelemente endet.
//
// Der Betrachter wird erst beim ersten Klick nachgeladen; wer nie eine Datei
// öffnet, lädt pdf.js nie. Welcher Dateityp vorliegt, entscheidet die Vorschau
// selbst anhand der Antwort — die Aufrufseiten müssen ihn nicht kennen.
import dynamic from "next/dynamic";
import { useState } from "react";

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
      {open ? <FilePreview src={src} title={title} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
