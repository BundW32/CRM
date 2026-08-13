"use client";

// Dateivorschau im Portal. PDFs werden mit pdf.js auf Canvas gerendert, Bilder
// direkt angezeigt.
//
// Der Inhaltstyp wird NICHT vom Aufrufer erfragt, sondern beim Laden aus der
// Antwort gelesen: die Aufrufseiten (Belege, Anhänge, Nachweise, Mietverträge)
// wissen ihn oft selbst nicht, ohne dass ihre Datenbankabfrage erweitert wird.
// Die Datei wird dabei genau einmal geladen und an pdf.js weitergereicht.
//
// PDF bewusst mit pdf.js auf Canvas, nicht per <iframe>.
//
// Zwei Gründe, warum der naheliegende iframe-Weg hier nicht trägt:
//  - Auf dem Handy überlässt ein iframe das Rendern dem Betriebssystem. iOS
//    Safari zeigt darin nur die erste Seite, Android-Chrome oft gar nichts.
//  - Unsere eigenen Sicherheits-Header (X-Frame-Options: DENY) verbieten es
//    ohnehin, eine Portal-Route in einen Rahmen zu setzen.
//
// pdf.js wird erst beim Öffnen der Vorschau nachgeladen (dynamic import), damit
// die ~1 MB nicht in jedem Seitenaufruf stecken.
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Minus, Plus, X } from "lucide-react";

type Props = {
  /** Route, die das PDF ausliefert (ohne ?download=1). */
  src: string;
  title: string;
  onClose: () => void;
};

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => void;
};
type PdfPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    canvas: HTMLCanvasElement;
  }) => { promise: Promise<void>; cancel: () => void };
};

const ZOOM_STEPS = [0.75, 1, 1.5, 2, 3];

export function FilePreview({ src, title, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(1); // 1 = Breite füllen
  const [visiblePage, setVisiblePage] = useState(1);

  // Escape schließt, und solange die Vorschau offen ist, scrollt die Seite
  // dahinter nicht mit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const response = await fetch(src, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;

        if (contentType.startsWith("image/")) {
          objectUrl = URL.createObjectURL(new Blob([bytes], { type: contentType }));
          setImageUrl(objectUrl);
          return;
        }
        if (!contentType.includes("pdf")) {
          setError("Für diesen Dateityp gibt es keine Vorschau.");
          return;
        }

        // Bewusst der LEGACY-Build: der Standard-Build von pdf.js 5 setzt sehr
        // junge JS-Methoden voraus (u. a. Map.prototype.getOrInsertComputed) und
        // scheitert auf älteren Browsern beim Rendern — genau auf den Geräten,
        // für die wir die Vorschau bauen. Der Legacy-Build bringt die nötigen
        // Polyfills mit.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        // Der Worker liegt als eigenes Bundle-Asset neben der Anwendung; ohne
        // ihn würde das Rendern den Hauptthread blockieren (auf dem Handy
        // sichtbar als eingefrorene Oberfläche).
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const result = (await pdfjs.getDocument({ data: bytes }).promise) as unknown as PdfDoc;
        if (cancelled) {
          result.destroy();
          return;
        }
        loaded = result;
        setDoc(result);
      } catch (err) {
        console.error("Vorschau fehlgeschlagen", err);
        if (!cancelled) setError("Die Vorschau konnte nicht geladen werden.");
      }
    })();

    return () => {
      cancelled = true;
      loaded?.destroy();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

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
      {/* Kopfzeile: auf dem Handy die einzige Bedienung, deshalb große Ziele */}
      <div className="flex shrink-0 items-center gap-2 bg-white px-3 py-2 shadow-sm sm:mx-auto sm:mt-6 sm:w-full sm:max-w-4xl sm:rounded-t-2xl">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{title}</p>
        {doc && doc.numPages > 1 ? (
          <span className="hidden shrink-0 text-xs text-gray-500 sm:inline">
            Seite {visiblePage} von {doc.numPages}
          </span>
        ) : null}
        {/* Zoom betrifft nur die gerenderten PDF-Seiten; bei Bildern ohne Wirkung. */}
        {imageUrl ? null : (
          <>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="Verkleinern"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            aria-label="Vergrößern"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
          </>
        )}
        <a
          href={`${src}${src.includes("?") ? "&" : "?"}download=1`}
          aria-label="Herunterladen"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        >
          <Download className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Vorschau schließen"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto overscroll-contain bg-gray-100 p-3 sm:mx-auto sm:mb-6 sm:w-full sm:max-w-4xl sm:rounded-b-2xl"
      >
        {error ? (
          <div className="mx-auto max-w-sm rounded-xl bg-white p-6 text-center">
            <p className="text-sm text-gray-700">{error}</p>
            <a
              href={`${src}${src.includes("?") ? "&" : "?"}download=1`}
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 underline"
            >
              <Download className="h-4 w-4" />
              Stattdessen herunterladen
            </a>
          </div>
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Blob-URL, keine Optimierung möglich
          <img src={imageUrl} alt={title} className="mx-auto block max-w-full bg-white shadow-sm" />
        ) : !doc ? (
          <p className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Vorschau wird geladen …
          </p>
        ) : (
          Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPageCanvas
              key={i + 1}
              doc={doc}
              pageNumber={i + 1}
              zoom={ZOOM_STEPS[zoomIndex]}
              scrollRoot={scrollRef}
              onVisible={setVisiblePage}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Eine Seite. Gerendert wird erst, wenn sie in Sichtweite kommt – bei einer
// 40-seitigen Jahresabrechnung sonst 40 Canvas-Renderings auf einmal.
function PdfPageCanvas({
  doc,
  pageNumber,
  zoom,
  scrollRoot,
  onVisible,
}: {
  doc: PdfDoc;
  pageNumber: number;
  zoom: number;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  onVisible: (page: number) => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const taskRef = useRef<{ cancel: () => void } | null>(null);
  const [near, setNear] = useState(pageNumber === 1);
  const [ratio, setRatio] = useState(1.414); // A4 hoch, bis die echte Größe da ist

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    // Zwei Beobachter mit verschiedenen Aufgaben. Einer mit Vorlauf, damit die
    // Seite fertig gerendert ist, bevor man sie erreicht; einer ohne Vorlauf für
    // die Seitenanzeige — sonst meldet die noch nicht sichtbare Folgeseite, sie
    // sei die aktuelle.
    const preload = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { root: scrollRoot.current, rootMargin: "300px" },
    );
    const current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) onVisible(pageNumber);
        }
      },
      { root: scrollRoot.current, threshold: [0.5] },
    );
    preload.observe(el);
    current.observe(el);
    return () => {
      preload.disconnect();
      current.disconnect();
    };
  }, [pageNumber, scrollRoot, onVisible]);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    const holder = holderRef.current;
    if (!canvas || !holder || !near) return;

    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    setRatio(base.height / base.width);

    // Auf Gerätepixel rendern, sonst ist die Schrift auf dem Handy matschig.
    const cssWidth = holder.clientWidth * zoom;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssWidth * (base.height / base.width)}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const task = page.render({ canvasContext: ctx, viewport, canvas });
    taskRef.current = task;
    try {
      await task.promise;
    } finally {
      if (taskRef.current === task) taskRef.current = null;
    }
  }, [doc, pageNumber, zoom, near]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (active) await render();
      } catch (err) {
        // Eine abgebrochene Render-Aufgabe wirft absichtlich (Cancel-Fehler) –
        // kein echter Fehler, wenn wir sie unten selbst abgebrochen haben.
        if (active) console.error("Seite konnte nicht gerendert werden", err);
      }
    })();
    return () => {
      active = false;
      // Laufende Render-Aufgabe SOFORT abbrechen, bevor React den Canvas entfernt
      // oder das übergeordnete PDF-Dokument zerstört wird (FilePreview-Cleanup
      // ruft doc.destroy() auf, sobald die Vorschau schließt). Ohne den Abbruch
      // rendert pdf.js mitten im Vorgang in einen bereits abgebauten Worker/Canvas
      // hinein – das hat beim schnellen Schließen der Vorschau die Seite/App
      // abstürzen lassen ("This page couldn't load").
      taskRef.current?.cancel();
      taskRef.current = null;
    };
  }, [render]);

  return (
    <div
      ref={holderRef}
      className="mx-auto mb-3 max-w-full overflow-auto"
      style={{ aspectRatio: near ? undefined : `1 / ${ratio}` }}
    >
      <canvas ref={canvasRef} className="mx-auto block bg-white shadow-sm" />
    </div>
  );
}
