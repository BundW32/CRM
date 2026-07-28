"use client";

// „Öffnen"-Schaltfläche für Dateien. PDFs erscheinen in der Vorschau (siehe
// pdf-preview.tsx), alles andere wird wie bisher im neuen Tab geöffnet.
//
// Der Betrachter wird erst beim ersten Klick nachgeladen — wer nie ein PDF
// öffnet, lädt pdf.js nie.
import dynamic from "next/dynamic";
import { useState } from "react";

const PdfPreview = dynamic(() => import("./pdf-preview").then((m) => m.PdfPreview), {
  ssr: false,
});

export function PdfPreviewLink({
  src,
  title,
  mimeType,
  className,
  children,
}: {
  src: string;
  title: string;
  mimeType: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isPdf = (mimeType ?? "").includes("pdf");

  if (!isPdf) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open ? <PdfPreview src={src} title={title} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
