"use client";

import { useState, type ReactNode } from "react";
import { SelectField, type SelectOption } from "@/components/fields";
import { inputClass } from "@/components/ui";

/**
 * Auswahlfeld mit „Sonstiges" **und** Freitextfeld.
 *
 * Anlass: Mehrere Auswahllisten im Portal boten zu wenige Möglichkeiten und
 * keinen Ausweg — die Antragsarten kannten genau zwei Werte, die Zählerarten
 * fünf. Wer etwas anderes hatte, musste raten, welcher der angebotenen Werte am
 * wenigsten falsch ist. Ein „Sonstiges" allein hilft dabei nicht: In der Liste
 * steht danach „Sonstiges", und niemand weiß mehr, was gemeint war.
 *
 * Deshalb **einmal** als Baustein und nicht siebenmal von Hand: Sieben eigene
 * Fassungen driften auseinander — beim Zeichenlimit, beim Verhalten nach dem
 * Zurückschalten, bei der Pflichtprüfung. Genau so ist es in diesem Projekt
 * schon mit den Datums- und Auswahlfeldern passiert (siehe `fields.tsx`).
 *
 * Drei Entscheidungen, die dahinterstehen:
 *
 * 1. **Das Freitextfeld steht immer im Formular**, es wird nur aus- und
 *    eingeblendet. Ein Feld, das je nach Auswahl verschwindet, verschiebt in
 *    Zeilen-Formularen mit `getAll()` die Zuordnung aller folgenden Zeilen —
 *    dieselbe Falle wie bei `disabled` (siehe AGENTS.md). So bleibt die Zahl
 *    der gesendeten Felder konstant.
 * 2. **`required` nur, solange es sichtbar ist.** Ein ausgeblendetes
 *    Pflichtfeld blockiert das Absenden, ohne dass der Browser die Meldung
 *    zeigen kann („An invalid form control is not focusable") — der Knopf wirkt
 *    dann kaputt.
 * 3. **Der Server ignoriert den Freitext, wenn nicht „Sonstiges" gewählt ist.**
 *    Das ausgeblendete Feld sendet seinen alten Wert weiterhin mit; die
 *    Auswertung gehört deshalb in `sonstigesFreitext()` (`lib/sonstiges.ts`)
 *    und nicht in jede Aktion einzeln.
 */
export function SelectMitSonstiges({
  label,
  name,
  options,
  defaultValue,
  placeholder,
  required,
  hint,
  /** Feldname des Freitexts (z. B. `typeOther`). */
  freitextName,
  freitextLabel = "Bitte benennen",
  freitextPlaceholder,
  freitextDefaultValue = "",
  freitextMaxLength = 120,
  /** Der Wert, der das Freitextfeld einblendet. */
  sonstigesWert = "SONSTIGES",
  className = "",
}: {
  label?: ReactNode;
  name: string;
  options: readonly SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  hint?: ReactNode;
  freitextName: string;
  freitextLabel?: ReactNode;
  freitextPlaceholder?: string;
  freitextDefaultValue?: string;
  freitextMaxLength?: number;
  sonstigesWert?: string;
  className?: string;
}) {
  const [wert, setWert] = useState(defaultValue ?? (placeholder ? "" : options[0]?.value) ?? "");
  const offen = wert === sonstigesWert;

  return (
    <div className={`space-y-2 ${className}`}>
      <SelectField
        label={label}
        name={name}
        options={options}
        placeholder={placeholder}
        required={required}
        hint={hint}
        // Bewusst UNkontrolliert (`defaultValue` + `onChange`): Der Zustand hier
        // steuert allein die Sichtbarkeit des Freitextfelds. Ein kontrolliertes
        // `value` neben dem `defaultValue`, das `SelectField` für den
        // Platzhalter setzt, wäre der klassische React-Mischfall.
        defaultValue={defaultValue}
        onChange={(e) => setWert(e.target.value)}
      />
      {/* Immer im Formular, nur unsichtbar: siehe Punkt 1 oben. `hidden` statt
          Ausbau hält die Feldreihenfolge stabil. */}
      <div hidden={!offen}>
        <SonstigesFeld
          name={freitextName}
          label={freitextLabel}
          placeholder={freitextPlaceholder}
          defaultValue={freitextDefaultValue}
          maxLength={freitextMaxLength}
          required={offen}
        />
      </div>
    </div>
  );
}

// Eigene kleine Komponente für das Textfeld — dieselbe Beschriftungs-Hülle wie
// bei den übrigen Feldern, damit „Bitte benennen" nicht anders aussieht als
// „Titel" darüber.
function SonstigesFeld({
  name,
  label,
  placeholder,
  defaultValue,
  maxLength,
  required,
}: {
  name: string;
  label: ReactNode;
  placeholder?: string;
  defaultValue: string;
  maxLength: number;
  required: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className={inputClass}
      />
    </label>
  );
}
