"use client";

import { useFormStatus } from "react-dom";

// Kleiner Submit-Button mit Pending-Zustand für Inline-Formulare.
// Übernimmt beliebige Styles, zeigt während der Server-Action ein Spinner-Label.
export function PendingButton({
  children,
  pendingLabel,
  className,
  disabled,
  name,
  value,
  title,
  spinnerClassName = "h-3.5 w-3.5",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  /**
   * `name`/`value` sind bei einem Submit-Button nicht Zierde, sondern Funktion:
   * Sie sagen der Server-Action, welcher von mehreren Buttons gedrückt wurde
   * (z. B. „Entwurf" vs. „Abschließen"). Wer sie hier verschluckt, bricht das
   * Formular auf eine Weise, die erst zur Laufzeit auffällt.
   */
  name?: string;
  value?: string;
  title?: string;
  /** Optik des Spinners – `SubmitButton` nutzt einen etwas größeren. */
  spinnerClassName?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={className}
      name={name}
      value={value}
      title={title}
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <svg className={`${spinnerClassName} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
          </svg>
          {/* Ohne eigene Wartebeschriftung bleibt die normale stehen – nur mit
              Spinner davor. Ein pauschales „Wird gespeichert…" wäre auf einem
              „Entfernen"- oder „Versenden"-Button schlicht gelogen, und diese
              Komponente sitzt inzwischen unter Buttons aller Art. */}
          {pendingLabel ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
