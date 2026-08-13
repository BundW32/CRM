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
//
// ── Speicher ──────────────────────────────────────────────────────────────
// Eine gerenderte Seite ist eine Bitmap: Breite × Höhe × 4 Byte. Eine A4-Seite
// in Gerätepixeln sind schnell 14 MB, bei 3× Zoom das Neunfache. Diese Vorschau
// hat deshalb einmal ganze Tabs abgeschossen (150 Seiten, 3× Zoom → 8,6 GB).
// Was das verhindert, steht in `lib/pdf-vorschau.ts` und hängt hier an drei
// Stellen:
//  - `imFenster` — nur Seiten in Sichtweite behalten ihre Leinwand,
//  - `renderAufloesung` — Gerätepixel und Zoom bleiben im Pixelbudget,
//  - `anstellen` + `task.cancel()` — höchstens zwei Aufträge, alte weichen.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Minus, Plus, X } from "lucide-react";
import {
  FENSTER_SEITEN,
  imFenster,
  pixelBudget,
  renderAufloesung,
  renderSchlange,
  rueckfrageNoetig,
  seiteBeiHoehe,
} from "@/lib/pdf-vorschau";

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
  }) => { promise: Promise<void>; cancel: (verzoegerung?: number) => void };
  cleanup?: () => void;
};

const ZOOM_STEPS = [0.75, 1, 1.5, 2, 3];

// Eine Schlange für die ganze Vorschau, nicht je Seite: Die Seiten teilen sich
// einen Worker, gleichzeitig gestartete Aufträge werden dadurch nicht schneller
// fertig — sie halten nur alle zugleich ihre Puffer.
const anstellen = renderSchlange(2);

/** pdf.js meldet einen abgebrochenen Auftrag als Fehler; das ist keiner. */
function istAbbruch(err: unknown): boolean {
  return err instanceof Error && err.name === "RenderingCancelledException";
}

function downloadHref(src: string): string {
  return `${src}${src.includes("?") ? "&" : "?"}download=1`;
}

export function FilePreview({ src, title, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(1); // 1 = Breite füllen
  const [visiblePage, setVisiblePage] = useState(1);
  // Erst zu beantworten, bevor ein großes Dokument gerendert wird.
  const [rueckfrage, setRueckfrage] = useState<{ seiten: number; bytes: number } | null>(null);
  // Seitenverhältnis der ersten Seite. Gilt als Vorgabe für alle Platzhalter —
  // ohne sie stünde jede ungerenderte Seite auf geratenem A4 und der Inhalt
  // ruckte beim Scrollen, weil die Höhen nachträglich springen.
  const [seitenRatio, setSeitenRatio] = useState(1.414);

  // Das Budget hängt am Gerät, nicht am Dokument: auf dem Telefon strenger.
  const [budget, setBudget] = useState(() =>
    typeof window === "undefined" ? pixelBudget(1024) : pixelBudget(window.innerWidth),
  );
  useEffect(() => {
    const messen = () => setBudget(pixelBudget(window.innerWidth));
    messen();
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, []);

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

        // Bewusst der LEGACY-Build: der Standard-Build von pdf.js 6 setzt sehr
        // junge JS-Methoden voraus (u. a. Map.prototype.getOrInsertComputed) und
        // scheitert auf älteren Browsern beim Rendern — genau auf den Geräten,
        // für die wir die Vorschau bauen. Der Legacy-Build bringt die nötigen
        // Polyfills mit (core-js, im Bundle nachgeprüft).
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        // Der Worker liegt als eigenes Bundle-Asset neben der Anwendung; ohne
        // ihn würde das Rendern den Hauptthread blockieren (auf dem Handy
        // sichtbar als eingefrorene Oberfläche).
        //
        // Turbopack löst diesen `new URL(...)`-Ausdruck zur Bauzeit auf und legt
        // die Datei unter /_next/static/media ab — am 13.08.2026 im gebauten
        // Portal nachgemessen: es entsteht ein echter `new Worker(...)`, kein
        // Rückfall auf den „fake worker" im Hauptthread.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const result = (await pdfjs.getDocument({ data: bytes }).promise) as unknown as PdfDoc;
        if (cancelled) {
          result.destroy();
          return;
        }

        // Das Seitenverhältnis einmal an der ersten Seite abnehmen, statt es
        // für jede Seite zu erfragen.
        try {
          const erste = await result.getPage(1);
          const sicht = erste.getViewport({ scale: 1 });
          if (sicht.width > 0) setSeitenRatio(sicht.height / sicht.width);
          erste.cleanup?.();
        } catch {
          // Kein Beinbruch: dann bleibt A4 hoch die Vorgabe.
        }
        if (cancelled) {
          result.destroy();
          return;
        }

        if (rueckfrageNoetig({ seiten: result.numPages, bytes: bytes.byteLength })) {
          setRueckfrage({ seiten: result.numPages, bytes: bytes.byteLength });
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

  const seiten = useMemo(
    () => (doc ? Array.from({ length: doc.numPages }, (_, i) => i + 1) : []),
    [doc],
  );

  // Welche Seite steht gerade in der Mitte des Ausschnitts? Diese eine Zahl
  // entscheidet über die Seitenanzeige UND darüber, welche Seiten ihre Leinwand
  // behalten dürfen. Sie kommt aus der Scrollposition, nicht aus einem
  // Beobachter — die Begründung steht bei `seiteBeiHoehe`.
  const zeigtSeiten = Boolean(doc) && !rueckfrage && !imageUrl && !error;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !zeigtSeiten) return;

    let angefordert = 0;
    const messen = () => {
      angefordert = 0;
      const platzhalter = el.children;
      setVisiblePage(
        seiteBeiHoehe(
          platzhalter.length,
          (i: number) => (platzhalter[i] as HTMLElement).offsetTop - el.offsetTop,
          el.scrollTop + el.clientHeight / 2,
        ),
      );
    };
    // Immer über einen Bildaufbau messen: das hält das Lesen der Maße aus dem
    // Effektkörper heraus und bündelt schnelles Scrollen auf eine Messung.
    const anstoßen = () => {
      if (!angefordert) angefordert = requestAnimationFrame(messen);
    };

    anstoßen();
    el.addEventListener("scroll", anstoßen, { passive: true });
    const groesse = new ResizeObserver(anstoßen);
    groesse.observe(el);
    return () => {
      el.removeEventListener("scroll", anstoßen);
      groesse.disconnect();
      if (angefordert) cancelAnimationFrame(angefordert);
    };
    // `zoomIndex` gehört dazu: Nach einer Zoomstufe stehen alle Seiten an
    // anderer Höhe, die alte Messung wäre falsch.
  }, [zeigtSeiten, zoomIndex]);

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
          href={downloadHref(src)}
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
              href={downloadHref(src)}
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
        ) : rueckfrage ? (
          <GrossesDokument
            seiten={rueckfrage.seiten}
            bytes={rueckfrage.bytes}
            src={src}
            onAnzeigen={() => setRueckfrage(null)}
          />
        ) : (
          seiten.map((nummer) => (
            <PdfPageCanvas
              key={nummer}
              doc={doc}
              pageNumber={nummer}
              zoom={ZOOM_STEPS[zoomIndex]}
              budget={budget}
              vorgabeRatio={seitenRatio}
              sichtbar={imFenster(nummer, visiblePage)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Rückfrage vor dem Rendern großer Dokumente. Ein Einzelwirtschaftsplan „alle
// Einheiten" hat eine Seite je Einheit; auf dem Telefon ist das Herunterladen
// dort oft das Bessere — ungefragt loszurendern ist die schlechtere der beiden
// Antworten, und bis Anfang August 2026 die einzige.
function GrossesDokument({
  seiten,
  bytes,
  src,
  onAnzeigen,
}: {
  seiten: number;
  bytes: number;
  src: string;
  onAnzeigen: () => void;
}) {
  const mb = bytes / 1024 / 1024;
  return (
    <div className="mx-auto max-w-sm rounded-xl bg-white p-6 text-center">
      <p className="text-sm font-semibold text-gray-900">
        {seiten} {seiten === 1 ? "Seite" : "Seiten"}
        {mb >= 1 ? ` · ${mb.toFixed(1)} MB` : ""}
      </p>
      <p className="mt-2 text-sm text-gray-600">
        Anzeigen oder herunterladen? Auf dem Telefon kann das Anzeigen eines so großen
        Dokuments dauern.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onAnzeigen}
          className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white"
        >
          Anzeigen
        </button>
        <a
          href={downloadHref(src)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
        >
          <Download className="h-4 w-4" />
          Herunterladen
        </a>
      </div>
    </div>
  );
}

// Eine Seite. Gerendert wird nur, solange sie im Fenster um die gerade
// sichtbare Seite liegt — verlässt sie es, wird die Leinwand auf 0×0 gesetzt
// und gibt ihre Bitmap frei. Der Platzhalter behält seine Maße über die
// CSS-Größe der (dann leeren) Leinwand, damit die Scrollposition nicht springt.
//
// Vorher hieß das „gerendert wird, wenn sie in Sichtweite kommt" — nur wurde
// dieser Zustand nie zurückgenommen. Nach einmaligem Durchscrollen lag das
// ganze Dokument gleichzeitig als Bitmap im Speicher.
function PdfPageCanvas({
  doc,
  pageNumber,
  zoom,
  budget,
  vorgabeRatio,
  sichtbar,
}: {
  doc: PdfDoc;
  pageNumber: number;
  zoom: number;
  budget: number;
  vorgabeRatio: number;
  sichtbar: boolean;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Die Vorgabe aus der ersten Seite gilt, bis diese Seite selbst gerendert
  // wurde und ihr echtes Verhältnis kennt.
  const [eigenesRatio, setEigenesRatio] = useState<number | null>(null);
  const ratio = eigenesRatio ?? vorgabeRatio;
  // Breite des Platzes, den die Seite hat. Über einen ResizeObserver statt
  // `clientWidth` beim Rendern: so kennt React die Maße, und der Platzhalter
  // hat sie auch dann, wenn nie gerendert wurde.
  const [platzBreite, setPlatzBreite] = useState(0);

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    // Das Beobachten meldet die aktuelle Größe von sich aus einmal — deshalb
    // hier kein zusätzliches Setzen aus dem Effektkörper heraus.
    const beobachter = new ResizeObserver(() => setPlatzBreite(el.clientWidth));
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  const cssBreite = platzBreite * zoom;
  const cssHoehe = cssBreite * ratio;

  const rendern = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || cssBreite <= 0) return null;

    const page = await doc.getPage(pageNumber);
    const basis = page.getViewport({ scale: 1 });
    if (basis.width > 0) setEigenesRatio(basis.height / basis.width);

    // Auf Gerätepixel rendern, sonst ist die Schrift auf dem Handy matschig —
    // aber nur so weit, wie das Budget es hergibt. Der Zoom steckt bereits in
    // `cssBreite`; dieselbe Rechnung bremst damit auch das Vergrößern.
    const hoehe = cssBreite * (basis.height / basis.width);
    const aufloesung = renderAufloesung({
      cssBreite,
      cssHoehe: hoehe,
      geraeteRatio: window.devicePixelRatio || 1,
      budget,
      seitenImFenster: FENSTER_SEITEN,
    });
    const viewport = page.getViewport({ scale: (cssBreite / basis.width) * aufloesung });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return { page, task: page.render({ canvasContext: ctx, viewport, canvas }) };
  }, [doc, pageNumber, cssBreite, budget]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!sichtbar) {
      // Die Bitmap freigeben. Die CSS-Größe bleibt stehen, deshalb behält die
      // leere Leinwand ihren Platz und nichts springt.
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    let abgebrochen = false;
    let laufend: { promise: Promise<void>; cancel: (v?: number) => void } | null = null;

    const arbeit = anstellen(async () => {
      if (abgebrochen) return;
      const gestartet = await rendern();
      if (!gestartet) return;
      if (abgebrochen) {
        gestartet.task.cancel();
        gestartet.page.cleanup?.();
        return;
      }
      laufend = gestartet.task;
      try {
        await gestartet.task.promise;
      } finally {
        laufend = null;
        gestartet.page.cleanup?.();
      }
    });

    arbeit.catch((err) => {
      if (istAbbruch(err) || abgebrochen) return;
      console.error("Seite konnte nicht gerendert werden", err);
    });

    return () => {
      abgebrochen = true;
      // Den laufenden Auftrag beenden, statt einen zweiten daneben zu starten.
      // Ohne das rendert jede Zoomänderung alle sichtbaren Seiten ein weiteres
      // Mal, während die alten Aufträge weiterlaufen.
      laufend?.cancel();
    };
  }, [sichtbar, rendern]);

  return (
    <div ref={holderRef} className="mx-auto mb-3 max-w-full overflow-auto">
      <canvas
        ref={canvasRef}
        className="mx-auto block bg-white shadow-sm"
        // Die CSS-Größe hängt NICHT an der Bitmap: eine freigegebene Leinwand
        // (0×0 Bitmap) behält so ihren Platz im Fluss.
        style={
          cssBreite > 0
            ? { width: `${cssBreite}px`, height: `${cssHoehe}px` }
            : { width: "100%", aspectRatio: `1 / ${ratio}` }
        }
      />
    </div>
  );
}
