"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, HelpCircle, Lightbulb } from "lucide-react";
import { SERVICE_EMAIL, wpButtonClass } from "@/components/marketing/brand";
import { SelectField } from "@/components/fields";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass } from "@/components/ui";
import { sendeKontaktanfrage } from "./actions";

/**
 * Dreistufiger Kontakt-Funnel: Anliegen → Nachricht → Kontaktdaten.
 *
 * ALLE Schritte liegen im SELBEN <form> und bleiben eingehängt — versteckt wird
 * nur per `hidden`. So tragen die Felder früherer Schritte ihre Werte bis zum
 * Absenden, ohne dass etwas in versteckte Duplikat-Felder kopiert werden muss.
 *
 * Vor jedem „Weiter" werden die Felder des AKTUELLEN Schritts geprüft
 * (`reportValidity`). Das ist nicht nur Komfort: Ein `required`-Feld in einem
 * per `display:none` versteckten Bereich kann der Browser beim Absenden nicht
 * anspringen und bricht mit stummem Konsolenfehler ab. Weil jeder Schritt nur
 * gültig verlassen werden kann, sind die versteckten Felder beim Absenden
 * immer gültig.
 */

const ANLIEGEN_KARTEN = [
  {
    wert: "frage",
    titel: "Ich habe eine Frage",
    text: "Zu Preisen, Funktionen oder dem Einstieg in die Selbstverwaltung.",
    icon: HelpCircle,
  },
  {
    wert: "anregung",
    titel: "Ich habe eine Anregung",
    text: "Ein Vorschlag, was das Portal besser machen kann.",
    icon: Lightbulb,
  },
] as const;

const THEMEN = [
  "Preise & Tarife",
  "Registrierung & Einstieg",
  "Funktionen im Portal",
  "Vertrag & Abrechnung",
  "Sonstiges",
] as const;

const SCHRITTE = ["Anliegen", "Nachricht", "Kontakt"] as const;

export function KontaktFunnel() {
  const [schritt, setSchritt] = useState(0);
  const [anliegen, setAnliegen] = useState<"frage" | "anregung" | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const erstesRendern = useRef(true);

  // Beim Schrittwechsel den Fokus in den neuen Schritt setzen — für Tastatur-
  // und Screenreader-Nutzer wäre er sonst noch im (jetzt versteckten) alten.
  useEffect(() => {
    if (erstesRendern.current) {
      erstesRendern.current = false;
      return;
    }
    formRef.current
      ?.querySelector<HTMLElement>(
        `[data-schritt="${schritt}"] input:not([type="hidden"]), [data-schritt="${schritt}"] textarea, [data-schritt="${schritt}"] select`
      )
      ?.focus();
  }, [schritt]);

  function weiter() {
    const bereich = formRef.current?.querySelector(`[data-schritt="${schritt}"]`);
    const felder =
      bereich?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input, textarea, select"
      ) ?? [];
    for (const feld of felder) {
      if (!feld.checkValidity()) {
        feld.reportValidity();
        return;
      }
    }
    setSchritt((s) => Math.min(s + 1, SCHRITTE.length - 1));
  }

  return (
    <div className="rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e2 sm:p-8">
      {/* Schrittanzeige */}
      <ol className="mb-8 flex items-center gap-2" aria-label="Schritte">
        {SCHRITTE.map((name, i) => (
          <li key={name} className="flex flex-1 flex-col gap-1.5">
            <span
              aria-hidden
              className={`h-1.5 rounded-full ${i <= schritt ? "bg-wp-accent" : "bg-wp-ink/10"}`}
            />
            <span
              className={`text-xs font-semibold ${
                i === schritt ? "text-wp-ink" : "text-wp-ink/45"
              }`}
              aria-current={i === schritt ? "step" : undefined}
            >
              {i + 1}. {name}
            </span>
          </li>
        ))}
      </ol>

      <form ref={formRef} action={sendeKontaktanfrage}>
        {/* Honeypot gegen Bots – für Menschen unsichtbar, nicht ausfüllen. */}
        <div aria-hidden="true" className="hidden">
          <label>
            Website
            <input type="text" name="hp_url" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {/* Schritt 1: Anliegen wählen — die Wahl führt direkt weiter. */}
        <fieldset data-schritt="0" hidden={schritt !== 0}>
          <legend className="mb-4 text-lg font-bold text-wp-ink">
            Worum geht es?
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {ANLIEGEN_KARTEN.map((karte) => {
              const gewaehlt = anliegen === karte.wert;
              return (
                <label
                  key={karte.wert}
                  className={`relative flex min-h-11 cursor-pointer flex-col gap-2 rounded-xl border p-5 transition-colors ${
                    gewaehlt
                      ? "border-wp-accent-ink bg-wp-accent-light/50"
                      : "border-wp-ink/15 bg-white hover:border-wp-ink/35"
                  }`}
                >
                  {/* onChange hält den Zustand, onClick führt weiter: Ein Klick
                      auf die BEREITS gewählte Karte feuert kein change mehr —
                      wer zurückgeht und bei seiner Wahl bleibt, käme sonst
                      nicht wieder vorwärts. Pfeiltasten (nur change) wechseln
                      dagegen die Auswahl, ohne den Schritt zu verlassen. */}
                  <input
                    type="radio"
                    name="anliegen"
                    value={karte.wert}
                    required
                    checked={gewaehlt}
                    onChange={() => setAnliegen(karte.wert)}
                    onClick={() => setSchritt(1)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:ring-2 peer-focus-visible:ring-wp-accent"
                  />
                  <karte.icon className="h-6 w-6 text-wp-accent-ink" aria-hidden />
                  <span className="font-semibold text-wp-ink">{karte.titel}</span>
                  <span className="text-sm leading-relaxed text-gray-600">{karte.text}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Schritt 2: Nachricht */}
        <fieldset data-schritt="1" hidden={schritt !== 1}>
          <legend className="mb-4 text-lg font-bold text-wp-ink">
            {anliegen === "anregung" ? "Ihre Anregung" : "Ihre Frage"}
          </legend>
          <div className="grid gap-4">
            <SelectField label="Thema (optional)" name="thema" defaultValue="">
              <option value="">Bitte wählen</option>
              {THEMEN.map((thema) => (
                <option key={thema} value={thema}>
                  {thema}
                </option>
              ))}
            </SelectField>
            <Field label="Ihre Nachricht">
              <textarea
                name="nachricht"
                rows={6}
                required
                minLength={10}
                maxLength={5000}
                className={inputClass}
                placeholder={
                  anliegen === "anregung"
                    ? "Was sollte das Portal besser können?"
                    : "Was möchten Sie wissen?"
                }
              />
            </Field>
          </div>
        </fieldset>

        {/* Schritt 3: Kontaktdaten — nur, was für die Antwort nötig ist. */}
        <fieldset data-schritt="2" hidden={schritt !== 2}>
          <legend className="mb-4 text-lg font-bold text-wp-ink">
            Wohin dürfen wir antworten?
          </legend>
          <div className="grid gap-4">
            <Field label="Ihr Name">
              <input
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={200}
                autoComplete="name"
                className={inputClass}
              />
            </Field>
            <Field label="Ihre E-Mail-Adresse">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-500">
                An diese Adresse geht die Eingangsbestätigung und unsere Antwort.
              </p>
            </Field>
            <p className="text-xs leading-relaxed text-gray-500">
              Ihre Angaben verwenden wir nur, um Ihr Anliegen zu beantworten.
              Einzelheiten in der{" "}
              <Link href="/datenschutz" className="text-wp-primary underline hover:no-underline">
                Datenschutzerklärung
              </Link>
              .
            </p>
          </div>
        </fieldset>

        {/* Navigation unter den Schritten */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          {schritt > 0 ? (
            <button
              type="button"
              onClick={() => setSchritt((s) => Math.max(s - 1, 0))}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-wp-ink/70 transition-colors hover:text-wp-ink"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Zurück
            </button>
          ) : (
            <span />
          )}
          {schritt < 2 ? (
            <button
              type="button"
              onClick={weiter}
              className={`${wpButtonClass} min-h-11 px-5`}
            >
              Weiter
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          {schritt === 2 ? (
            <SubmitButton
              className={`${wpButtonClass} min-h-11 px-5`}
              pendingLabel="Wird gesendet…"
            >
              Nachricht senden
            </SubmitButton>
          ) : null}
        </div>
      </form>

      <noscript>
        <p className="mt-6 text-sm text-gray-600">
          Dieses Formular braucht JavaScript. Sie erreichen uns genauso gut per
          E-Mail an{" "}
          <a href={`mailto:${SERVICE_EMAIL}`} className="text-wp-primary underline">
            {SERVICE_EMAIL}
          </a>
          .
        </p>
      </noscript>
    </div>
  );
}
