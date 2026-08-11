"use client";

// Das Banner, das nach der Einwilligung in Werbe-Cookies fragt — und der
// Knopf, mit dem sie sich widerrufen lässt (Art. 7 Abs. 3 DSGVO: „so einfach
// wie die Erteilung").
//
// Drei Festlegungen, die nicht Geschmack sind:
//
//   1. **Beide Knöpfe sind gleich groß, gleich schwer, gleich weit vorn.**
//      Ein grauer Verzichts-Link neben einem fetten Zustimmungs-Knopf ist keine
//      freiwillige Entscheidung im Sinne von Art. 4 Nr. 11 DSGVO. Sie
//      unterscheiden sich in der Farbe, nicht im Gewicht.
//   2. **Kein Schließkreuz.** Ein Wegklicken ohne Entscheidung wäre eine
//      Zustimmung durch Schweigen — genau das, was nicht geht. Wer nichts
//      wählt, bekommt kein Tag.
//   3. **Das Banner blockiert die Seite nicht.** Es liegt unten auf; alles
//      dahinter bleibt lesbar und bedienbar. Eine Wand, die zum Klicken zwingt,
//      erzeugt Zustimmung durch Genervtheit.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  abonniereEinwilligung,
  EINWILLIGUNG_OEFFNEN,
  istWerbeseite,
  ladeEinwilligung,
  oeffneEinwilligung,
  speichereEinwilligung,
  type Werbeeinwilligung,
} from "@/lib/einwilligung";

// Gleiche Grundform für beide Knöpfe — nur die Fläche unterscheidet sie.
// `min-h-11` sind 44 px: das kleinste Tap-Ziel, das die Marken-Seiten zulassen.
const knopfBasis =
  "inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors";

export function EinwilligungBanner() {
  const pfad = usePathname() ?? "/";
  const [offen, setOffen] = useState(false);
  const kasten = useRef<HTMLDivElement>(null);
  const fokussieren = useRef(false);

  useEffect(() => {
    const pruefe = () => setOffen(ladeEinwilligung() === null);
    pruefe();
    const abbestellen = abonniereEinwilligung(pruefe);

    // Widerruf: Das Banner kommt zurück, diesmal mit dem Fokus darin — es
    // wurde ja ausdrücklich angefordert.
    const beiOeffnen = () => {
      fokussieren.current = true;
      setOffen(true);
    };
    window.addEventListener(EINWILLIGUNG_OEFFNEN, beiOeffnen);
    return () => {
      abbestellen();
      window.removeEventListener(EINWILLIGUNG_OEFFNEN, beiOeffnen);
    };
  }, []);

  useEffect(() => {
    if (offen && fokussieren.current) {
      fokussieren.current = false;
      kasten.current?.focus();
    }
  }, [offen]);

  const entscheide = useCallback((werbung: Werbeeinwilligung) => {
    speichereEinwilligung(werbung);
    setOffen(false);
  }, []);

  // Serverseitig ist `offen` immer `false` — der gespeicherte Stand steht erst
  // im Browser fest. Das Banner erscheint deshalb nach der Hydratation, nicht
  // im ersten HTML; ein Unterschied zwischen beiden wäre ein Hydratationsfehler.
  if (!offen || !istWerbeseite(pfad)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] font-mk">
      <div className="mx-auto w-full max-w-2xl p-3 sm:p-4">
        <div
          ref={kasten}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-labelledby="einwilligung-titel"
          className="rounded-2xl border border-wp-ink/15 bg-white p-4 shadow-e3 outline-none sm:p-5"
          style={{ animation: "mkPopIn 0.35s var(--ease-mk-out) both" }}
        >
          <h2 id="einwilligung-titel" className="text-sm font-semibold text-wp-ink">
            Dürfen wir messen, ob unsere Werbung ankommt?
          </h2>
          {/* Kurz gehalten, und zwar aus einem messbaren Grund: Auf einem
              375 px breiten Bildschirm nahm die ausführliche Fassung 59 % des
              Bildes ein. Was hier steht, ist die erste Ebene — Zweck,
              Empfänger, Cookie, Drittland, Widerruf; alles Weitere trägt die
              verlinkte Erklärung. */}
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            Wir schalten Anzeigen bei Google. Mit Ihrer Einwilligung laden wir dafür das
            Werbe-Tag von Google Ads: Es setzt ein Cookie und übermittelt Ihren Besuch an
            Google, auch in die USA. Ohne Zustimmung passiert davon nichts. Einzelheiten
            und Widerruf:{" "}
            <Link href="/datenschutz" className="font-medium text-wp-accent-ink underline">
              Datenschutzerklärung
            </Link>
            .
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => entscheide("abgelehnt")}
              className={`${knopfBasis} border border-wp-ink/40 bg-white text-wp-ink hover:bg-wp-primary-light`}
            >
              Ablehnen
            </button>
            <button
              type="button"
              onClick={() => entscheide("erteilt")}
              className={`${knopfBasis} bg-wp-accent text-wp-on-accent hover:bg-wp-accent-dark`}
            >
              Einverstanden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * „Einwilligung ändern" — gehört auf die Datenschutzerklärung. Ohne diesen Weg
 * wäre die Einwilligung erteilbar, aber nicht widerrufbar.
 */
export function EinwilligungAendernButton() {
  const [stand, setStand] = useState<string | null>(null);

  useEffect(() => {
    const pruefe = () => {
      const gespeichert = ladeEinwilligung();
      setStand(
        gespeichert === null
          ? "Noch nicht entschieden."
          : gespeichert.werbung === "erteilt"
            ? "Aktuell erteilt."
            : "Aktuell abgelehnt.",
      );
    };
    pruefe();
    return abonniereEinwilligung(pruefe);
  }, []);

  return (
    <p>
      {stand ? <span className="text-gray-500">{stand} </span> : null}
      <button
        type="button"
        onClick={oeffneEinwilligung}
        className="cursor-pointer font-medium text-brand-green underline hover:no-underline"
      >
        Einwilligung ändern
      </button>
    </p>
  );
}
