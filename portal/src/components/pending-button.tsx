"use client";

import { useFormStatus } from "react-dom";

// Kleiner Submit-Button mit Pending-Zustand für Inline-Formulare.
// Übernimmt beliebige Styles, zeigt während der Server-Action ein Spinner-Label.
export function PendingButton({
  children,
  pendingLabel,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
          </svg>
          {pendingLabel ?? "Wird gespeichert…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
