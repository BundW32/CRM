"use client";

// Einwilligungs-Banner für Statistik (GA4) und Marketing (Google Ads).
// Erscheint nur, wenn Google-IDs konfiguriert sind UND keine gültige
// Einwilligung der aktuellen Version gespeichert ist. Wiederöffnen über den
// Footer-Link „Cookie-Einstellungen" (CONSENT_OPEN_EVENT).
//
// Bewusste Eigenschaften (Anforderungen des Auftrags vom 24.08.2026):
// - „Alle akzeptieren" und „Nur notwendige" sind exakt gleich gestaltet —
//   kein Dark Pattern, keine farbliche Hervorhebung einer Richtung.
// - Escape schließt NICHT ohne Auswahl; Tab läuft im Dialog im Kreis.
// - fixed am unteren Rand → kein Layout-Shift, Seite bleibt lesbar.
// - Die Entscheidung landet mit Version + Zeitpunkt in localStorage;
//   der Google-Tag (components/analytics/google-tag.tsx) hört auf das
//   CONSENT_CHANGED_EVENT und lädt bzw. aktualisiert den Consent Mode.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_OPEN_EVENT,
  CONSENT_STORAGE_KEY,
  type ConsentAuswahl,
  consentNoetig,
  neuerConsent,
  parseConsent,
} from "@/lib/analytics/consent";

const gleichwertigerButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-400 " +
  "bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700";

export function ConsentBanner() {
  const [offen, setOffen] = useState(false);
  const [einstellungen, setEinstellungen] = useState(false);
  const [statistik, setStatistik] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!consentNoetig()) return;
    let gespeichert: ReturnType<typeof parseConsent> = null;
    try {
      gespeichert = parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
    } catch {
      // localStorage gesperrt (z. B. strikte Browser-Einstellung): Dann kann
      // keine Entscheidung gespeichert werden — Banner zeigen, Speichern
      // scheitert leise, Google lädt in dieser Sitzung nicht.
    }
    // Öffnen über einen Timeout statt direkt im Effekt: vermeidet den
    // Hydration-Konflikt (Server rendert das Banner nie) und genügt der
    // Lint-Regel gegen synchrones setState in Effekten.
    const timer = gespeichert ? undefined : setTimeout(() => setOffen(true), 0);

    const oeffnen = () => {
      try {
        const c = parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
        if (c) {
          setStatistik(c.statistik);
          setMarketing(c.marketing);
        }
      } catch {
        /* siehe oben */
      }
      setEinstellungen(true);
      setOffen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, oeffnen);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(CONSENT_OPEN_EVENT, oeffnen);
    };
  }, []);

  // Tastatur: Fokus-Falle im Dialog, Escape schließt nicht ohne Auswahl.
  useEffect(() => {
    if (!offen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const vorher = document.activeElement as HTMLElement | null;
    const fokussierbare = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>("button, a[href], input:not([disabled])"),
      );
    fokussierbare()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Keine stille Vorgabe: Wer schließt, hat sich entschieden — Escape
        // ohne Auswahl bleibt deshalb wirkungslos.
        e.preventDefault();
        return;
      }
      if (e.key !== "Tab") return;
      const f = fokussierbare();
      if (f.length === 0) return;
      const erste = f[0];
      const letzte = f[f.length - 1];
      if (e.shiftKey && document.activeElement === erste) {
        e.preventDefault();
        letzte.focus();
      } else if (!e.shiftKey && document.activeElement === letzte) {
        e.preventDefault();
        erste.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      vorher?.focus?.();
    };
  }, [offen, einstellungen]);

  const speichern = (auswahl: ConsentAuswahl) => {
    const consent = neuerConsent(auswahl);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    } catch {
      /* nicht speicherbar → gilt nur für diese Ansicht */
    }
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
    setOffen(false);
    setEinstellungen(false);
  };

  if (!offen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-titel"
        className="mx-auto max-w-3xl rounded-2xl border border-gray-300 bg-white p-5 text-gray-800 shadow-2xl"
      >
        <h2 id="consent-titel" className="text-base font-bold text-gray-900">
          Cookies für Statistik und Werbung?
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          Wir möchten mit Google Analytics verstehen, wie diese Seiten genutzt
          werden, und mit Google Ads messen, ob unsere Anzeigen etwas bringen.
          Beides setzt Cookies und läuft nur mit Ihrer Einwilligung — die Seite
          funktioniert auch ohne vollständig. Details in der{" "}
          <Link href="/datenschutz" className="underline">
            Datenschutzerklärung
          </Link>
          .
        </p>

        {einstellungen ? (
          <fieldset className="mt-4 space-y-2 rounded-xl border border-gray-200 p-4">
            <legend className="px-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Kategorien
            </legend>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked disabled className="mt-0.5" />
              <span>
                <span className="font-semibold">Notwendig</span> — Anmeldung,
                Sicherheit, das Merken dieser Auswahl. Immer aktiv.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={statistik}
                onChange={(e) => setStatistik(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold">Statistik</span> — Google
                Analytics 4: Reichweite und Nutzung der Seiten.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold">Marketing</span> — Google Ads
                Conversion-Messung: ob ein Anzeigenklick zu einer Registrierung
                führt.
              </span>
            </label>
          </fieldset>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Beide Wege gleichwertig — identische Gestaltung ist Absicht. */}
          <button
            type="button"
            className={gleichwertigerButton}
            onClick={() => speichern({ statistik: true, marketing: true })}
          >
            Alle akzeptieren
          </button>
          {einstellungen ? (
            <button
              type="button"
              className={gleichwertigerButton}
              onClick={() => speichern({ statistik, marketing })}
            >
              Auswahl speichern
            </button>
          ) : (
            <button
              type="button"
              className={gleichwertigerButton}
              onClick={() => speichern({ statistik: false, marketing: false })}
            >
              Nur notwendige
            </button>
          )}
          {einstellungen ? null : (
            <button
              type="button"
              className="min-h-11 rounded-lg px-2 text-sm text-gray-600 underline underline-offset-2 transition hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700"
              onClick={() => setEinstellungen(true)}
            >
              Einstellungen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
