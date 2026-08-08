"use client";

// Ein aufklappbarer Formularblock, der beim Öffnen den Fokus mitnimmt.
//
// **Das Problem.** Ein `<details>`-Block klappt auf, der Inhalt darunter rutscht
// nach unten — und die Aufklapp-Bewegung läuft 260 ms (siehe
// `[data-collapsible]::details-content` in globals.css). Wer in dieser Zeit auf
// die Stelle klickt, an der er das gewünschte Feld gesehen hat, trifft ein
// anderes. In einem Testdurchlauf landete so „12500" im Feld *Kontoname* statt
// im Anfangsbestand („Girokonto WEG Lindenhof 1212500") und „15012026" im
// Lohnanteil § 35a statt im Buchungstag.
//
// **Die Lösung, zweiteilig.** Erstens setzt dieser Block den Fokus nach dem
// Aufklappen selbst in sein erstes Feld — dann muss niemand dorthin klicken.
// Zweitens hält `scroll-anchoring` den sichtbaren Inhalt an Ort und Stelle,
// während oberhalb Platz entsteht.
//
// Der Fokus wird bewusst **erst nach der Bewegung** gesetzt: Fokussiert man
// sofort, scrollt der Browser zu einem Feld, das noch unterwegs ist, und die
// Seite ruckelt ein zweites Mal.

import { useRef, type ReactNode } from "react";

/** Dauer der Aufklapp-Bewegung aus globals.css. */
const AUFKLAPP_MS = 260;

export function AufklappFormular({
  titel,
  children,
}: {
  titel: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement | null>(null);

  return (
    <details
      ref={ref}
      data-collapsible
      // `overflow-anchor` ist die Vorgabe des Browsers, steht hier aber
      // ausdrücklich: Der Block ist genau der Fall, für den es gedacht ist.
      style={{ overflowAnchor: "auto" }}
      onToggle={(e) => {
        if (!e.currentTarget.open) return;
        const block = e.currentTarget;
        window.setTimeout(() => {
          const feld = block.querySelector<HTMLElement>(
            "input:not([type=hidden]):not([readonly]), select, textarea",
          );
          // `preventScroll`: Der Block ist nach dem Aufklappen ohnehin sichtbar.
          // Ohne diese Angabe scrollt der Browser ihn ein zweites Mal ins Bild.
          feld?.focus({ preventScroll: true });
        }, AUFKLAPP_MS);
      }}
    >
      <summary className="cursor-pointer text-sm font-medium text-gray-700">{titel}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
