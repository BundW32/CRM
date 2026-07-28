"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Springt zum Anker in der Adresse — auch dann, wenn der Browser es verpasst hat.
 *
 * Fehlermeldungen verlinken auf die Stelle, an der etwas fehlt
 * („#zeile-abc123"). Beim ersten Laden scheitert dieser Sprung jedoch häufig,
 * und zwar aus einem Grund, der beim Nachmessen erst sichtbar wurde:
 *
 * Das Ziel ist zu diesem Zeitpunkt bereits im Dokument — aber **die Seite ist
 * noch nicht hoch genug**. Next liefert den Inhalt gestreamt aus; solange der
 * Teil unterhalb fehlt, gibt es nichts zu scrollen. `scrollIntoView` läuft
 * dann folgenlos durch, und weder Browser noch ein einmaliger Nachschlag
 * versuchen es später erneut. Gemessen: In zwei von drei Aufrufen blieb die
 * Seite oben stehen. Für den Nutzer sieht das aus, als führte der Link ins
 * Nichts — er landet auf einer langen Tabelle und sucht die Zeile doch selbst.
 *
 * Deshalb wird der Sprung wiederholt, bis er sitzt: Bild für Bild, längstens
 * anderthalb Sekunden. Ein `scrollIntoView` auf ein bereits richtig stehendes
 * Element tut nichts, die Wiederholung kostet also nichts.
 *
 * Sobald der Nutzer selbst scrollt, hört das auf — gegen jemanden zu scrollen,
 * der gerade liest, wäre schlimmer als ein verpasster Sprung.
 *
 * `scroll-margin` (Tailwind `scroll-mt-…`) am Ziel bestimmt den Abstand nach
 * oben; das bleibt Sache der Seite, nicht dieser Komponente.
 */
export function HashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;

    let abgebrochen = false;
    const ende = performance.now() + 1500;

    const versuch = () => {
      if (abgebrochen || performance.now() > ende) return;
      document.getElementById(id)?.scrollIntoView({ block: "start" });
      requestAnimationFrame(versuch);
    };
    requestAnimationFrame(versuch);

    // Scrollt der Nutzer selbst, hat er das Warten aufgegeben — dann wir auch.
    const aufgeben = () => {
      abgebrochen = true;
    };
    const optionen = { once: true, passive: true } as const;
    window.addEventListener("wheel", aufgeben, optionen);
    window.addEventListener("touchstart", aufgeben, optionen);
    window.addEventListener("keydown", aufgeben, optionen);
    return () => {
      abgebrochen = true;
      window.removeEventListener("wheel", aufgeben);
      window.removeEventListener("touchstart", aufgeben);
      window.removeEventListener("keydown", aufgeben);
    };
  }, [pathname]);

  return null;
}
