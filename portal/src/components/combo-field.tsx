"use client";

import { useState } from "react";
import { Combobox, type ComboOption } from "@/components/combobox";
import { Field } from "@/components/ui";

/**
 * Formulargebundenes, **tippbares** Einzel-Auswahlfeld — der Ersatz für ein
 * `<select>`, dessen Liste mit dem Bestand wächst.
 *
 * Anlass: Die Objekt→Einheit-Kaskade wurde tippbar gemacht, die reinen
 * Objektlisten daneben blieben aber Aufklappmenüs. Ein Verwalter mit achtzig
 * Objekten scrollt dort durch achtzig Zeilen, ohne „Kiefer" tippen zu können.
 * Dasselbe Problem, nur eine Ebene höher.
 *
 * Zwei Dinge, die `Combobox` allein nicht mitbringt:
 *
 * 1. **Es schickt seinen Wert mit.** `Combobox` ist rein gesteuert; hier trägt
 *    ein eigenes Feld den Wert ins Formular.
 * 2. **Pflicht wird geprüft.** Und zwar nicht über `<input type="hidden"
 *    required>` — versteckte Felder sind von der HTML-Prüfung *ausgenommen*,
 *    das `required` dort wäre wirkungslos. Stattdessen ein Textfeld ohne
 *    Ausdehnung an derselben Stelle: unsichtbar, aber prüf- und anspringbar,
 *    wie in `FileInput`. Nebeneffekt, der so gewollt ist: Das Sternchen aus
 *    `globals.css` greift, weil ein echtes `[required]` im Label steckt.
 *
 * Die sichtbare Beschriftung liefert `Field` — die `label`-Angabe von
 * `Combobox` ist nur für Screenreader.
 */
export function ComboField({
  name,
  label,
  options,
  defaultValue = "",
  required = false,
  placeholder = "suchen …",
  clearOption,
  hideLabel = false,
  className = "",
}: {
  name: string;
  label: string;
  options: ComboOption[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  /** Beschriftung der „nichts gewählt"-Zeile. Ohne Angabe: keine solche Zeile. */
  clearOption?: string;
  /**
   * Für Felder in einer Zeile (z. B. „+ Objekt hinzufügen"), wo die Beschriftung
   * aus dem Zusammenhang kommt. Sie bleibt für Screenreader erhalten.
   */
  hideLabel?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  const feld = (
    <>
      {/* Die Combobox steht **vor** dem Prüffeld, und das ist kein Zufall: `Field`
          rendert ein `<label>`, und ein Klick darauf fokussiert das *erste*
          Formularfeld darin. Stand das Prüffeld vorn, landete der Fokus in einem
          unsichtbaren Feld — man klickte auf „Objekt", tippte, und nichts geschah. */}
      <Combobox
        label={label}
        placeholder={placeholder}
        options={options}
        value={value || undefined}
        onSelect={setValue}
        onClear={() => setValue("")}
        clearOption={clearOption}
        className={className}
        tone="inForm"
      />
      {required ? (
        <input
          type="text"
          name={name}
          value={value}
          required
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden
          className="absolute h-0 w-0 opacity-0"
        />
      ) : (
        <input type="hidden" name={name} value={value} />
      )}
    </>
  );

  return hideLabel ? feld : <Field label={label}>{feld}</Field>;
}
