"use client";

// Geführte Ersteinrichtung: abgedunkelte Seite, ein ausgeleuchtetes Element,
// daneben eine Sprechblase.
//
// **Eigenbau statt Bibliothek.** driver.js und Shepherd bringen ihr eigenes
// Aussehen mit und kämpfen gegen das Design des Programms; sie anzupassen wäre
// teurer als diese Datei. Die Sprechblase benutzt deshalb dieselben Bausteine
// wie jede Karte — `cardSurfaceClass`, `buttonClass`, dieselbe Erhebung.
//
// **Was die Führung nicht ist:** ein Ersatz für eine verständliche Oberfläche.
// Wo eine Tour nötig ist, damit jemand einen Knopf findet, ist zuerst der Knopf
// falsch. Sie erklärt deshalb, *wozu* die Bereiche da sind — nicht, wo man
// klickt (siehe `lib/tour.ts`).
//
// Drei Dinge, die von Anfang an dazugehören und nicht nachgereicht werden:
//
// - **Tastatur.** Der Fokus bleibt in der Sprechblase, Escape beendet,
//   Pfeiltasten blättern. Eine Führung, die einen Tastaturnutzer einsperrt,
//   ist schlimmer als keine.
// - **Mobil.** Die Navigation liegt dort hinter einem Schubfach. Ist das Ziel
//   nicht sichtbar, gibt es keinen Lichtkegel auf die falsche Stelle, sondern
//   eine zentrierte Karte ohne Ausschnitt.
// - **Nichts blockiert.** Überspringen ist immer sichtbar, der Fortschritt wird
//   gemerkt, und ungefragt erscheint die Führung genau einmal.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buttonClass, buttonSecondaryClass, cardSurfaceClass } from "@/components/ui";
import type { TourSchritt } from "@/lib/tour";

const RAND = 8; // Luft um das ausgeleuchtete Element
const BLASE_BREITE = 340;

type Kasten = { top: number; left: number; width: number; height: number };

export function Tour({
  schritte,
  beenden,
}: {
  schritte: TourSchritt[];
  /** Wird beim Abschluss oder Überspringen aufgerufen (Server-Action). */
  beenden: (abgeschlossen: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [kasten, setKasten] = useState<Kasten | null>(null);
  const blaseRef = useRef<HTMLDivElement>(null);
  const schritt = schritte[index];
  const router = useRouter();
  const pathname = usePathname();

  // Zur Seite wechseln, auf der das Ziel steht. Ohne diesen Schritt zeigte die
  // Führung ins Leere, sobald ein Ziel nicht zufällig auf der aktuellen Seite
  // lag — beim ersten Prüflauf traf genau einer von sechs Schritten.
  useEffect(() => {
    if (schritt?.pfad && pathname !== schritt.pfad) router.push(schritt.pfad);
  }, [schritt, pathname, router]);

  const schliessen = useCallback(
    (abgeschlossen: boolean) => {
      beenden(abgeschlossen);
    },
    [beenden],
  );

  // Ziel suchen und ausmessen. Neu bei jedem Schritt und bei Größenänderung —
  // ein Lichtkegel, der nach dem Drehen des Geräts danebenliegt, verwirrt mehr,
  // als er hilft.
  useEffect(() => {
    if (!schritt) return;
    const messen = () => {
      if (!schritt.ziel) return setKasten(null);
      const el = document.querySelector<HTMLElement>(`[data-tour="${schritt.ziel}"]`);
      if (!el) return setKasten(null);
      let r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return setKasten(null);

      // Zwei Arten von „nicht zu sehen", die verschieden behandelt werden
      // müssen — beim ersten Anlauf hatte ich sie vermischt, und der Prüflauf
      // bei 390 px Breite leuchtete dreimal ins Nichts:
      //
      // 1. **Seitlich draußen** — auf dem Handy liegt die Navigation in einem
      //    geschlossenen Schubfach, das nicht versteckt, sondern aus dem Bild
      //    geschoben ist. Dorthin führt kein Scrollen. Also kein Lichtkegel,
      //    sondern die zentrierte Karte.
      if (r.right <= 0 || r.left >= window.innerWidth) return setKasten(null);

      // 2. **Unter dem Falz** — erreichbar, nur gerade nicht im Bild. Hier wird
      //    hingescrollt und danach neu gemessen; `instant`, damit die Messung
      //    unmittelbar danach schon stimmt.
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ block: "center", behavior: "instant" });
        r = el.getBoundingClientRect();
      }
      setKasten({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    messen();
    // Nach einem Seitenwechsel ist das Ziel erst da, wenn die neue Seite steht.
    // Deshalb kurz nachfassen statt einmal zu messen und aufzugeben.
    const bis = performance.now() + 2500;
    let timer: ReturnType<typeof setTimeout>;
    const nachfassen = () => {
      if (performance.now() > bis) return;
      if (!document.querySelector(`[data-tour="${schritt.ziel}"]`)) {
        timer = setTimeout(nachfassen, 100);
        return;
      }
      messen();
    };
    if (schritt.ziel) nachfassen();
    window.addEventListener("resize", messen);
    window.addEventListener("scroll", messen, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", messen);
      window.removeEventListener("scroll", messen, true);
    };
  }, [schritt, pathname]);

  // Fokus in die Sprechblase — sonst tabbt man in die abgedunkelte Seite.
  useEffect(() => {
    blaseRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") schliessen(false);
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, schritte.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === "Tab") {
        // Fokusfalle: Innerhalb der Sprechblase gibt es genug Ziele; nach
        // draußen darf der Fokus nicht, solange die Seite abgedunkelt ist.
        const felder = blaseRef.current?.querySelectorAll<HTMLElement>("button");
        if (!felder || felder.length === 0) return;
        const erstes = felder[0];
        const letztes = felder[felder.length - 1];
        if (!e.shiftKey && document.activeElement === letztes) {
          e.preventDefault();
          erstes.focus();
        } else if (e.shiftKey && document.activeElement === erstes) {
          e.preventDefault();
          letztes.focus();
        }
      }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [schritte.length, schliessen]);

  if (!schritt) return null;

  const letzter = index === schritte.length - 1;
  // Blase unter dem Ziel, außer es steht so weit unten, dass sie hinausliefe.
  const platzUnten = kasten ? window.innerHeight - (kasten.top + kasten.height) : 0;
  const untenAnsetzen = kasten !== null && platzUnten > 220;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Geführte Einrichtung"
      className="fixed inset-0 z-[100]"
    >
      {/* Abdunkelung. Vier Flächen statt einer mit Loch: So bleibt das Ziel
          nicht nur sichtbar, sondern auch anklickbar — und ein Klick daneben
          beendet nichts versehentlich. */}
      {kasten ? (
        <>
          <div className="fixed inset-x-0 top-0 bg-gray-900/50" style={{ height: Math.max(kasten.top - RAND, 0) }} />
          <div
            className="fixed inset-x-0 bottom-0 bg-gray-900/50"
            style={{ top: kasten.top + kasten.height + RAND }}
          />
          <div
            className="fixed left-0 bg-gray-900/50"
            style={{ top: kasten.top - RAND, height: kasten.height + 2 * RAND, width: Math.max(kasten.left - RAND, 0) }}
          />
          <div
            className="fixed right-0 bg-gray-900/50"
            style={{ top: kasten.top - RAND, height: kasten.height + 2 * RAND, left: kasten.left + kasten.width + RAND }}
          />
          <div
            aria-hidden
            // Eindeutig auffindbar für die Prüfung: Ein Test, der nach
            // „irgendeinem orangen Ring" sucht, findet auch den pulsierenden
            // Hinweis zur Startbildschirm-Installation — und meldet dann einen
            // Lichtkegel, wo keiner ist. Genau das ist passiert.
            data-tour-ring=""
            className="pointer-events-none fixed rounded-xl ring-2 ring-brand-orange"
            style={{
              top: kasten.top - RAND,
              left: kasten.left - RAND,
              width: kasten.width + 2 * RAND,
              height: kasten.height + 2 * RAND,
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-gray-900/50" />
      )}

      <div
        ref={blaseRef}
        tabIndex={-1}
        className={`${cardSurfaceClass} fixed p-4 shadow-e3 outline-none`}
        style={
          kasten
            ? {
                width: Math.min(BLASE_BREITE, window.innerWidth - 24),
                left: Math.max(12, Math.min(kasten.left, window.innerWidth - BLASE_BREITE - 12)),
                ...(untenAnsetzen
                  ? { top: kasten.top + kasten.height + RAND + 12 }
                  : { bottom: window.innerHeight - kasten.top + RAND + 12 }),
              }
            : {
                width: Math.min(BLASE_BREITE + 40, window.innerWidth - 24),
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }
        }
      >
        <p className="text-xs font-medium text-gray-400">
          Schritt {index + 1} von {schritte.length}
        </p>
        <h2 className="mt-1 text-base font-semibold text-gray-900">{schritt.titel}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">{schritt.text}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => schliessen(false)}
            className="text-xs text-gray-500 underline"
          >
            Überspringen
          </button>
          <div className="flex gap-2">
            {index > 0 ? (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className={buttonSecondaryClass}
              >
                Zurück
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (letzter ? schliessen(true) : setIndex((i) => i + 1))}
              className={buttonClass}
            >
              {letzter ? "Fertig" : "Weiter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
