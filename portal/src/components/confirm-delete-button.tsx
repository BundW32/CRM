"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { buttonDangerClass, buttonGhostClass, iconButtonDangerClass } from "@/components/ui";

// Zweistufiger Lösch-Button für Server-Action-Formulare: erst ein dezentes
// Papierkorb-Icon, nach dem Klick eine Inline-Rückfrage („Löschen? · Abbrechen").
// Verhindert versehentliches Löschen ohne störenden Browser-Dialog. Muss innerhalb
// des <form action={…}> stehen; der Submit löst die Server-Action aus.
export function ConfirmDeleteButton({
  title = "Löschen",
  confirmLabel = "Löschen?",
  pendingLabel = "Wird gelöscht…",
}: {
  title?: string;
  confirmLabel?: string;
  pendingLabel?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={title}
        title={title}
        className={iconButtonDangerClass}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <DeleteSubmit confirmLabel={confirmLabel} pendingLabel={pendingLabel} />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className={`${buttonGhostClass} px-2.5 py-1 text-xs`}
      >
        Abbrechen
      </button>
    </span>
  );
}

function DeleteSubmit({
  confirmLabel,
  pendingLabel,
}: {
  confirmLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonDangerClass} px-3 py-1 text-xs`}>
      {pending ? pendingLabel : confirmLabel}
    </button>
  );
}
