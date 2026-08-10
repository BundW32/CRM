"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

// Zweistufiger Text-Button für Server-Action-Formulare: erst die normale
// Beschriftung, nach dem Klick eine Inline-Rückfrage („Wirklich? · Abbrechen"),
// danach der Pending-Zustand.
//
// Abgrenzung zu `ConfirmDeleteButton`: der ist ein Papierkorb-Icon für
// Listenzeilen. Diese Variante ist für benannte Aktionen in Textform, bei denen
// das Icon die Tragweite verschweigen würde – etwa die DSGVO-Löschung, die
// unwiderruflich ist und bis eben ein nackter `<button>` ohne jede Rückfrage war.
export function ConfirmActionButton({
  children,
  confirmLabel = "Wirklich?",
  pendingLabel = "Wird ausgeführt…",
  className = "",
  confirmClassName,
  formAction,
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  /** Optik im Ruhezustand (z. B. `text-xs text-red-600 hover:underline`). */
  className?: string;
  /** Optik der Rückfrage; ohne Angabe wie `className`, nur fett. */
  confirmClassName?: string;
  /**
   * Andere Server-Action als die des umgebenden Formulars. Für Formulare mit
   * ZWEI Ausgängen aus denselben Feldern (z. B. Konto → Zwei-Faktor: derselbe
   * App-Code erneuert die Wiederherstellungscodes ODER schaltet ab) — ein
   * zweites Formular hieße, denselben Code zweimal einzutippen.
   */
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`cursor-pointer ${className}`}
      >
        {children}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <ConfirmSubmit
        confirmLabel={confirmLabel}
        pendingLabel={pendingLabel}
        className={confirmClassName ?? `font-semibold ${className}`}
        formAction={formAction}
      />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 hover:underline"
      >
        Abbrechen
      </button>
    </span>
  );
}

function ConfirmSubmit({
  confirmLabel,
  pendingLabel,
  className,
  formAction,
}: {
  confirmLabel: string;
  pendingLabel: string;
  className: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      // Bewusst kein `disabled:cursor-wait`: Windows zeichnet dafür seinen
      // Wartekringel neben den Zeiger, was wie ein hängendes Fenster aussieht.
      // Dass die Aktion läuft, sagt der Knopf schon selbst („Wird gelöscht…").
      className={`cursor-pointer disabled:opacity-60 ${className}`}
    >
      {pending ? pendingLabel : confirmLabel}
    </button>
  );
}
