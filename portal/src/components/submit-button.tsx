"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui";

export function SubmitButton({
  children = "Speichern",
  pendingLabel,
  className = buttonClass,
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (
        <>
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
          </svg>
          {pendingLabel ?? "Wird gespeichert…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
