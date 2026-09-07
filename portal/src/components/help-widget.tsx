"use client";

import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, ImageOff, LifeBuoy, X } from "lucide-react";
import { toJpeg } from "html-to-image";
import { sendeHilfeanfrage, type HilfeState } from "@/app/(portal)/hilfe/actions";
import { SelectField } from "@/components/fields";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { HILFE_ARTEN } from "@/lib/hilfe-arten";

/**
 * Schwebender Hilfe-Knopf (unten rechts) für den angemeldeten Bereich.
 *
 * Öffnet ein kleines Formular: Art des Anliegens + Schilderung. Alles Weitere
 * (Name, E-Mail, Rolle, Organisation) kennt der Server aus der Sitzung; Seite
 * und Browser reicht das Widget als versteckte Felder mit, damit die erste
 * Rückfrage („auf welcher Seite, mit welchem Browser?") entfällt.
 *
 * Beim Öffnen nimmt das Widget den sichtbaren Ausschnitt der Seite auf
 * (html-to-image, im Browser — nichts verlässt das Gerät, bevor die Person
 * absendet). Das Bild wird als Vorschau gezeigt und geht als Anhang mit,
 * solange das Häkchen gesetzt bleibt. Das Widget selbst ist über
 * `data-hilfe-widget` vom Foto ausgenommen.
 *
 * `versetzt`: Ist der KI-Assistent eingeblendet, sitzt der an derselben Ecke —
 * dann rückt der Hilfe-Knopf eine Stufe nach oben, statt ihn zu verdecken.
 */
export function HelpWidget({ versetzt = false }: { versetzt?: boolean }) {
  const [open, setOpen] = useState(false);
  // Schlüssel zum Zurücksetzen des Formulars nach „Weitere Meldung".
  const [runde, setRunde] = useState(0);
  const [foto, setFoto] = useState<Foto>({ status: "laedt" });
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  function oeffnen() {
    setOpen(true);
    setFoto({ status: "laedt" });
    // Nach dem Rendern des Panels aufnehmen — es ist per Filter ausgenommen,
    // die Seite darunter zeigt genau das, was die Person gerade sah.
    requestAnimationFrame(() => {
      bildschirmfoto().then(
        (dataUrl) => setFoto({ status: "ok", dataUrl }),
        () => setFoto({ status: "fehler" }),
      );
    });
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("select, textarea")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        data-hilfe-widget=""
        onClick={() => (open ? setOpen(false) : oeffnen())}
        aria-label={open ? "Hilfe schließen" : "Hilfe: Problem melden"}
        aria-expanded={open}
        className={`fixed right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-brand-green px-4 text-sm font-semibold text-white shadow-xl shadow-black/25 transition-all hover:bg-brand-green-dark hover:shadow-2xl active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange ${
          versetzt ? "bottom-[5.5rem]" : "bottom-4"
        }`}
      >
        {open ? <X className="h-5 w-5" /> : <LifeBuoy className="h-5 w-5" />}
        <span>Hilfe</span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          data-hilfe-widget=""
          role="dialog"
          aria-label="Problem melden"
          className={`fixed inset-x-3 top-16 z-40 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/30 motion-safe:animate-slide-down sm:inset-x-auto sm:top-auto sm:right-4 sm:w-[380px] ${
            versetzt ? "bottom-40" : "bottom-20"
          }`}
        >
          <div className="flex items-center gap-2.5 border-b border-gray-100 bg-brand-green px-4 py-3 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <LifeBuoy className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Problem melden</p>
              <p className="truncate text-[11px] text-white/70">Wir melden uns per E-Mail</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Schließen"
              className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <HilfeFormular
              key={runde}
              seite={pathname}
              // Das Formular entsteht erst nach einem Klick, also nur im Browser —
              // der User-Agent kann deshalb direkt gelesen werden.
              browser={typeof navigator === "undefined" ? "" : navigator.userAgent}
              foto={foto}
              onNochEine={() => setRunde((r) => r + 1)}
              onSchliessen={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

type Foto = { status: "laedt" } | { status: "ok"; dataUrl: string } | { status: "fehler" };

// Ab dieser Größe (Zeichen der Daten-URL, ≈ Bytes) wird kleiner aufgenommen.
const FOTO_ZIEL = 1_500_000;

/**
 * Sichtbarer Ausschnitt der Seite als JPEG-Daten-URL.
 *
 * Aufgenommen wird das ganze Dokument, aber nur in Fenstergröße und um den
 * Scroll-Stand verschoben — das ergibt den Ausschnitt, den die Person gerade
 * vor sich hat, statt einer ellenlangen Gesamtseite. Verschoben wird über
 * negative Außenabstände, nicht über `transform`: Ein Transform macht die
 * Wurzel zum Bezug für `position: fixed`, und die fixierte Navigation rutschte
 * mit aus dem Bild — mit Außenabstand bleibt sie, wo sie auf dem Bildschirm
 * ist (im Chromium gegen den echten Screenshot geprüft). Auf Retina-Bildschirmen
 * genügt die einfache Auflösung; wird es trotzdem zu groß, noch einmal kleiner.
 */
async function bildschirmfoto(): Promise<string> {
  const wurzel = document.documentElement;
  const optionen = {
    quality: 0.7,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#ffffff",
    style: {
      marginTop: `${-window.scrollY}px`,
      marginLeft: `${-window.scrollX}px`,
    },
    filter: (knoten: Node) =>
      !(knoten instanceof HTMLElement && knoten.dataset.hilfeWidget !== undefined),
  };
  let dataUrl = await toJpeg(wurzel, { ...optionen, pixelRatio: 1 });
  if (dataUrl.length > FOTO_ZIEL) {
    dataUrl = await toJpeg(wurzel, { ...optionen, pixelRatio: 0.6 });
  }
  return dataUrl;
}

const ANFANG: HilfeState = { status: "idle" };

function HilfeFormular({
  seite,
  browser,
  foto,
  onNochEine,
  onSchliessen,
}: {
  seite: string;
  browser: string;
  foto: Foto;
  onNochEine: () => void;
  onSchliessen: () => void;
}) {
  const [state, formAction] = useActionState(sendeHilfeanfrage, ANFANG);
  const [mitFoto, setMitFoto] = useState(true);

  if (state.status === "ok") {
    return (
      <div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange-light text-brand-orange-dark">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold text-gray-900">Vielen Dank für Ihre Meldung.</p>
        <p className="text-sm text-gray-500">
          Sie ist bei uns eingegangen. Eine Kopie geht an Ihre E-Mail-Adresse, wir melden uns
          so schnell wie möglich.
        </p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onNochEine} className={buttonSecondaryClass}>
            Weitere Meldung
          </button>
          <button type="button" onClick={onSchliessen} className={buttonSecondaryClass}>
            Schließen
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "fehler" ? (
        <Alert variant="error">
          {state.grund === "eingabe"
            ? "Bitte wählen Sie eine Art und schildern Sie das Problem in mindestens zehn Zeichen."
            : state.grund === "limit"
              ? `Es sind gerade viele Meldungen von Ihnen eingegangen. Bitte versuchen Sie es später erneut oder schreiben Sie direkt an ${state.empfaenger}.`
              : `Der Versand ist derzeit nicht möglich. Bitte schreiben Sie direkt an ${state.empfaenger}.`}
        </Alert>
      ) : null}

      <SelectField
        label="Worum geht es?"
        name="art"
        required
        placeholder="– bitte wählen –"
        options={Object.entries(HILFE_ARTEN).map(([value, label]) => ({ value, label }))}
      />

      <Field label="Was ist passiert?">
        <textarea
          name="nachricht"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          placeholder="Was wollten Sie tun, was ist stattdessen passiert? Je genauer, desto schneller können wir helfen."
          className={`${inputClass} resize-y`}
        />
      </Field>

      <FotoAuswahl foto={foto} mitFoto={mitFoto} onChange={setMitFoto} />

      <input type="hidden" name="seite" value={seite} />
      <input type="hidden" name="browser" value={browser} />
      {mitFoto && foto.status === "ok" ? (
        <input type="hidden" name="foto" value={foto.dataUrl} />
      ) : null}

      <p className="text-xs text-gray-500">
        Mit der Meldung übermitteln wir Ihren Namen, Ihre E-Mail-Adresse, die aktuelle Seite
        und Ihren Browser, damit wir das Problem nachvollziehen können.
      </p>

      <SubmitButton className={`${buttonClass} w-full`} pendingLabel="Wird gesendet…">
        Meldung senden
      </SubmitButton>
    </form>
  );
}

/** Vorschau des Bildschirmfotos mit Häkchen „mitsenden". */
function FotoAuswahl({
  foto,
  mitFoto,
  onChange,
}: {
  foto: Foto;
  mitFoto: boolean;
  onChange: (v: boolean) => void;
}) {
  if (foto.status === "fehler") {
    return (
      <p className="flex items-center gap-2 text-xs text-gray-500">
        <ImageOff className="h-4 w-4 shrink-0" />
        Ein Bildschirmfoto konnte in diesem Browser nicht erstellt werden — die Meldung geht
        ohne Bild raus.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={mitFoto}
          onChange={(e) => onChange(e.target.checked)}
          disabled={foto.status !== "ok"}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-orange/30"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-700">
            Bildschirmfoto dieser Seite mitsenden
          </span>
          <span className="block text-xs text-gray-500">
            Zeigt uns, was Sie gerade sehen — samt aller Angaben auf der Seite.
          </span>
        </span>
      </label>
      <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {foto.status === "ok" ? (
          // Daten-URL, kein Remote-Bild: next/image brächte hier nichts.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto.dataUrl}
            alt="Vorschau des Bildschirmfotos"
            className={`block max-h-32 w-full object-cover object-top transition ${mitFoto ? "" : "opacity-40 grayscale"}`}
          />
        ) : (
          <div className="flex h-20 items-center justify-center text-xs text-gray-400">
            Bildschirmfoto wird erstellt …
          </div>
        )}
      </div>
    </div>
  );
}
