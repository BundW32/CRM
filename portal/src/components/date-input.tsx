"use client";

// Der native Datums-Eingabeteil von `DateField` — ausgelagert, weil er als
// einziger Teil der Formularfelder Client-JS braucht.
//
// **Das Problem.** Ein `<input type="date">` besteht aus drei Segmenten
// (tt.mm.jjjj). Der Browser fokussiert beim Klick das Segment *unter dem
// Mauszeiger*. Wer in die rechte Hälfte eines leeren Feldes klickt, landet im
// Monat oder im Jahr — und eine durchgetippte Ziffernfolge wie „15072026"
// verteilt sich dann falsch: Aus dem gewünschten 15.07.2026 wurde
// „tt.12.72026", aus dem 01.03.2015 „tt.mm.32015".
//
// Warum das mehr ist als eine Unbequemlichkeit: Betroffen sind Stichtage,
// Beschlussdaten und Buchungstage — Felder, an denen rechtlich etwas hängt. Ein
// falsches Datum sieht dabei nicht falsch aus, es sieht nur *anders* aus, und
// niemand kontrolliert jedes Feld nach dem Tippen. In einem Testdurchlauf ist
// das viermal passiert, obwohl die testende Person den Effekt kannte und
// gegensteuerte.
//
// **Die Lösung.** Bei einem *leeren* Feld wird der Fokus auf das erste Segment
// gesetzt, egal wo geklickt wurde. Damit landet die erste getippte Ziffer immer
// im Tag, und der Browser springt von selbst weiter zu Monat und Jahr.
//
// Bewusst **nur bei leerem Feld**: Steht schon ein Datum drin, will man gezielt
// ein Segment korrigieren — „nur den Monat ändern" ist dann der Normalfall, und
// ein erzwungener Sprung auf den Tag nähme genau das weg.
//
// Umgesetzt über `setSelectionRange(0, 0)` mit Rückfallebene: Bei
// `type="date"` wirft der Aufruf in einigen Browsern (die Auswahl-API gilt dort
// als nicht anwendbar), deshalb steht er in einem `try`. Schlägt er fehl,
// verhält sich das Feld wie bisher — der Klick geht nicht verloren.

export function DateInput({
  className,
  onMouseDown,
  onFocus,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const aufAnfangSetzen = (el: HTMLInputElement | null) => {
    if (!el || el.value) return; // Gefülltes Feld: gezielte Korrektur zulassen.
    try {
      el.setSelectionRange(0, 0);
    } catch {
      // Browser ohne Auswahl-API auf Datumsfeldern — dann bleibt es beim
      // Standardverhalten. Kein Grund, die Eingabe zu stören.
    }
  };

  return (
    <input
      {...rest}
      type="date"
      className={className}
      // `mousedown` kommt vor der Fokusvergabe des Browsers. Erst danach steht
      // fest, welches Segment er gewählt hat — deshalb wird die Korrektur in
      // den nächsten Tick gelegt, sonst überschreibt der Browser sie wieder.
      onMouseDown={(e) => {
        onMouseDown?.(e);
        const el = e.currentTarget;
        if (!el.value) setTimeout(() => aufAnfangSetzen(el), 0);
      }}
      // Tastatur-Fokus (Tab) trifft ohnehin das erste Segment; der Aufruf hier
      // deckt die Fälle ab, in denen der Fokus programmatisch gesetzt wird.
      onFocus={(e) => {
        onFocus?.(e);
        const el = e.currentTarget;
        if (!el.value) setTimeout(() => aufAnfangSetzen(el), 0);
      }}
    />
  );
}
