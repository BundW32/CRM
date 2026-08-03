"use client";

import { useEffect } from "react";

// Markiert den Inhalt von Zahlenfeldern beim Fokussieren, damit ein Klick +
// Tippen den vorausgefüllten Wert ERSETZT statt ihn zu ergänzen (sonst wird
// z. B. "3600" vor ein vorbelegtes "0,00" gesetzt → "36000,00"). Betrifft
// Beträge (inputmode="decimal") und Zahlenfelder (type="number").
//
// Zuverlässig auch bei Mausklick: focusin (Tastatur) markiert direkt; beim
// Klick platziert der Browser danach den Cursor per mouseup – deshalb wird
// dort erneut markiert, aber nur bei einem einfachen Klick (keine manuelle
// Bereichsauswahl per Ziehen).
function isNumericField(el: EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false;
  return el.type === "number" || el.getAttribute("inputmode") === "decimal";
}

function selectSafely(el: HTMLInputElement) {
  try {
    el.select();
  } catch {
    /* type=number erlaubt select(); selectionStart ist dort null – ignorieren */
  }
}

export function NumericAutoselect() {
  useEffect(() => {
    let pending = false;

    const onFocusIn = (e: FocusEvent) => {
      if (!isNumericField(e.target)) return;
      selectSafely(e.target); // Tastatur-Fokus: sofort markieren
      pending = true; // Maus-Fokus: der folgende mouseup übernimmt
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!pending) return;
      pending = false;
      const el = e.target;
      if (!isNumericField(el)) return;
      // Bei manueller Bereichsauswahl (Ziehen) nicht überschreiben. Für
      // type=number ist selectionStart null → dann immer markieren.
      const collapsed = el.type === "number" || el.selectionStart === el.selectionEnd;
      if (collapsed) selectSafely(el);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("mouseup", onMouseUp, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("mouseup", onMouseUp, true);
    };
  }, []);

  return null;
}
