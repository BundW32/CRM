// Formularfelder mit einheitlicher Optik.
//
// Anlass: Im Portal standen 26 rohe `<input type="date">`, sieben davon ohne
// `inputClass` – dort sah der Kalender sichtbar anders aus als zwei Seiten weiter.
// Dasselbe Bild bei den Auswahlfeldern. Die Felder bleiben **nativ**: Auf
// Mobilgeräten ist das Auswahlrad bzw. der System-Kalender die bessere Bedienung
// als jeder Nachbau. Vereinheitlicht wird nur das Aussehen.
//
// Beide Felder rendern serverseitig und brauchen kein Client-JS.

import type { ReactNode } from "react";
import { inputClass } from "@/components/ui";

/** Gemeinsame Hülle: Beschriftung, Pflicht-Markierung, Hilfetext. */
function FieldShell({
  label,
  required,
  hint,
  htmlFor,
  children,
}: {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  // Ohne Beschriftung (z. B. in einer Filterleiste oder Tabellenzeile) entfällt die
  // Hülle ganz – ein leeres <label> würde Screenreadern ein Ziel ohne Text anbieten.
  if (!label) return <>{children}</>;
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required ? <span className="ml-0.5 text-brand-orange-ink">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

/**
 * Datumsfeld – überall gleich.
 *
 * `defaultValue` erwartet `YYYY-MM-DD`; für Werte aus der Datenbank gibt es
 * `toDateInputValue`, damit nicht jede Seite ihr eigenes `toISOString().slice(0, 10)`
 * schreibt (das rechnet in UTC und verschiebt in unserer Zeitzone abends den Tag).
 */
export function DateField({
  label,
  name,
  defaultValue,
  required,
  min,
  max,
  hint,
  id,
  className = "",
  ...rest
}: {
  label?: ReactNode;
  name: string;
  defaultValue?: string;
  required?: boolean;
  min?: string;
  max?: string;
  hint?: ReactNode;
  id?: string;
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "name" | "defaultValue" | "required" | "min" | "max" | "id" | "className"
>) {
  return (
    <FieldShell label={label} required={required} hint={hint} htmlFor={id}>
      <input
        type="date"
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        className={`${inputClass} ${className}`}
        {...rest}
      />
    </FieldShell>
  );
}

/**
 * Wandelt ein `Date` in den Wert, den `<input type="date">` erwartet.
 *
 * Bewusst über die lokalen Getter statt `toISOString()`: Letzteres rechnet nach UTC
 * und macht in deutscher Sommerzeit aus dem 1. März abends den 28. Februar.
 * `null` ergibt `undefined` – ein leeres Feld statt eines falschen Datums.
 */
export function toDateInputValue(value: Date | null | undefined): string | undefined {
  if (!value) return undefined;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}`;
}

export type SelectOption = { value: string; label: string; disabled?: boolean };

/**
 * Auswahlfeld – natives `<select>`, einheitlich gerahmt.
 *
 * Den Pfeil ersetzt bereits `globals.css` global; hier kommt der gleiche Rahmen und
 * dieselbe Höhe wie bei den Texteingaben dazu. `placeholder` erzeugt einen leeren
 * ersten Eintrag („– bitte wählen –"), der bei `required` nicht absendbar ist.
 */
export function SelectField({
  label,
  name,
  options,
  defaultValue,
  placeholder,
  required,
  hint,
  id,
  className = "",
  children,
  ...rest
}: {
  label?: ReactNode;
  name: string;
  /** Alternativ lassen sich die `<option>` als `children` übergeben. */
  options?: readonly SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  hint?: ReactNode;
  id?: string;
  className?: string;
  children?: ReactNode;
} & Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "name" | "defaultValue" | "required" | "id" | "className" | "children"
>) {
  return (
    <FieldShell label={label} required={required} hint={hint} htmlFor={id}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? (placeholder ? "" : undefined)}
        required={required}
        className={`${inputClass} ${className}`}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        ) : null}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
    </FieldShell>
  );
}
