"use client";

import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, LifeBuoy, X } from "lucide-react";
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
 * `versetzt`: Ist der KI-Assistent eingeblendet, sitzt der an derselben Ecke —
 * dann rückt der Hilfe-Knopf eine Stufe nach oben, statt ihn zu verdecken.
 */
export function HelpWidget({ versetzt = false }: { versetzt?: boolean }) {
  const [open, setOpen] = useState(false);
  // Schlüssel zum Zurücksetzen des Formulars nach „Weitere Meldung".
  const [runde, setRunde] = useState(0);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

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
        onClick={() => setOpen((v) => !v)}
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
              onNochEine={() => setRunde((r) => r + 1)}
              onSchliessen={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

const ANFANG: HilfeState = { status: "idle" };

function HilfeFormular({
  seite,
  browser,
  onNochEine,
  onSchliessen,
}: {
  seite: string;
  browser: string;
  onNochEine: () => void;
  onSchliessen: () => void;
}) {
  const [state, formAction] = useActionState(sendeHilfeanfrage, ANFANG);

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
          rows={6}
          placeholder="Was wollten Sie tun, was ist stattdessen passiert? Je genauer, desto schneller können wir helfen."
          className={`${inputClass} resize-y`}
        />
      </Field>

      <input type="hidden" name="seite" value={seite} />
      <input type="hidden" name="browser" value={browser} />

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
