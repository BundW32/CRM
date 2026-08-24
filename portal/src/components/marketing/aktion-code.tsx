"use client";

// Der Aktionscode als anklickbares Feld: ein Tipp darauf legt ihn in die
// Zwischenablage. Grund: Der Code muss in das Formularfeld der Registrierung —
// wer über den Werbeknopf geht, bekommt ihn automatisch, wer von der Leiste aus
// selbst zur Registrierung findet, tippte ihn bisher ab (und „PORTAL24" wird auf
// dem Handy leicht zu „Portal 24").
//
// Client-Komponente, weil `navigator.clipboard` nur im Browser existiert. Ohne
// JavaScript oder in einem Browser ohne Zwischenablage-Zugriff bleibt der Code
// **lesbarer Text** — er verschwindet nie, das Kopieren ist die Zugabe.
import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Kopiert Text in die Zwischenablage. Zwei Wege, weil der erste an Bedingungen
 * hängt: `navigator.clipboard` gibt es nur in sicheren Kontexten, und Safari
 * verweigert ihn außerhalb einer Nutzergeste gelegentlich. Der zweite Weg
 * (unsichtbares Textfeld + `execCommand`) ist veraltet, funktioniert aber
 * überall — hier ist er die Rückfallebene, nicht der Normalfall.
 */
async function inZwischenablage(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // weiter zur Rückfallebene
  }
  try {
    const feld = document.createElement("textarea");
    feld.value = text;
    feld.setAttribute("readonly", "");
    feld.style.position = "fixed";
    feld.style.opacity = "0";
    document.body.appendChild(feld);
    feld.select();
    const geklappt = document.execCommand("copy");
    document.body.removeChild(feld);
    return geklappt;
  } catch {
    return false;
  }
}

export function AktionsCode({
  code,
  tone,
  className = "",
}: {
  code: string;
  /** `dunkel` = auf der Aktionsleiste, `hell` = auf hellem Grund. */
  tone: "dunkel" | "hell";
  className?: string;
}) {
  const [zustand, setZustand] = useState<"bereit" | "kopiert" | "fehler">("bereit");
  // Der Rücksetz-Zeitgeber wird beim Verlassen abgeräumt: Ein Zustandswechsel
  // auf einer ausgehängten Komponente ist sonst eine Warnung in der Konsole.
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (uhr.current) clearTimeout(uhr.current);
  }, []);

  const farben =
    tone === "dunkel"
      ? "border-white/35 bg-white/10 text-white hover:bg-white/20"
      : "border-wp-accent-ink/30 bg-white text-wp-ink hover:border-wp-accent-ink/60";

  return (
    <button
      type="button"
      onClick={async (e) => {
        // Die Leiste trägt daneben einen Link zur Registrierung; ein Klick auf
        // „kopieren" soll nicht zusätzlich irgendwohin führen.
        e.preventDefault();
        e.stopPropagation();
        const geklappt = await inZwischenablage(code);
        setZustand(geklappt ? "kopiert" : "fehler");
        if (uhr.current) clearTimeout(uhr.current);
        uhr.current = setTimeout(() => setZustand("bereit"), 2500);
      }}
      // Der sichtbare Text ist „Code PORTAL24" — was ein Klick TUT, steht nur
      // hier; ohne diesen Namen wäre der Knopf für Screenreader ein Rätsel.
      aria-label={`Aktionscode ${code} kopieren`}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-0.5 font-semibold tracking-wider transition-colors ${farben} ${className}`}
    >
      <span>Code {code}</span>
      {zustand === "kopiert" ? (
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
      )}
      {/* Rückmeldung für alle: sichtbar knapp, für Screenreader angekündigt.
          `aria-live` steht IMMER im Markup — ein erst beim Klick eingefügter
          Bereich wird von vielen Screenreadern nicht vorgelesen. */}
      <span aria-live="polite" className="text-xs font-normal tracking-normal">
        {zustand === "kopiert" ? "kopiert" : zustand === "fehler" ? "bitte manuell kopieren" : ""}
      </span>
    </button>
  );
}
