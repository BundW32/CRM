"use client";

import { PendingButton } from "@/components/pending-button";
import { buttonClass } from "@/components/ui";

/**
 * Primärer Speichern-Button eines Formulars.
 *
 * Nur noch eine Vorkonfiguration von `PendingButton`: gleiche Optik wie bisher
 * (Primärstil, etwas größerer Spinner, Vorgaben „Speichern" und „Wird
 * gespeichert…"), aber ohne eigene Pending-Logik.
 *
 * Beide Komponenten trugen dieselbe Mechanik doppelt – mit der Folge, dass
 * Verbesserungen immer nur eine Hälfte erreichten: Als `PendingButton` gelernt
 * hat, `name`/`value` durchzureichen (nötig bei Formularen mit mehreren
 * Submit-Buttons), fehlte das hier weiterhin.
 *
 * Für alles außerhalb der Primäraktion – Inline-Links, sekundäre Knöpfe –
 * ist `PendingButton` direkt die richtige Wahl.
 */
export function SubmitButton({
  children = "Speichern",
  className = buttonClass,
  pendingLabel = "Wird gespeichert…",
  ...rest
}: React.ComponentProps<typeof PendingButton>) {
  return (
    <PendingButton
      className={className}
      pendingLabel={pendingLabel}
      spinnerClassName="mr-2 h-4 w-4"
      {...rest}
    >
      {children}
    </PendingButton>
  );
}
