"use client";

// Datei-Auswahl mit lesbarer Rückmeldung.
//
// Das native `<input type="file">` zeichnet der Browser selbst, und zwar in seiner
// Sprache: Auf einem deutschen Portal steht dann „Choose File — No file chosen".
// Auf dem Telefon ist es zusätzlich zu breit; der Dateiname wird abgeschnitten, und
// man sieht nach dem Auswählen nicht, ob das Richtige erwischt wurde. Genau das
// passiert im Alltag beim Hochladen eines Mietvertrags oder Schadensfotos.
//
// Deshalb: Das native Feld bleibt erhalten (es ist der einzige Weg zum
// Dateidialog, und es trägt `name`, `accept`, `capture` und die Pflichtprüfung),
// wird aber unsichtbar gemacht und von einem eigenen Knopf ausgelöst. Darunter
// stehen die gewählten Dateien mit Name und Größe.

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { buttonSecondaryClass } from "@/components/ui";

/** Dateigröße menschenlesbar – dieselbe Staffelung wie `formatBytes` in lib/labels. */
function groesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileInput({
  name,
  accept,
  required,
  multiple,
  capture,
  label = "Datei wählen",
  hint,
  id,
}: {
  name: string;
  accept?: string;
  required?: boolean;
  multiple?: boolean;
  /** „environment" öffnet auf dem Telefon direkt die Kamera (Zählerstände, Räume). */
  capture?: "user" | "environment";
  /** Beschriftung des Knopfes – z. B. „Foto aufnehmen" statt „Datei wählen". */
  label?: string;
  hint?: string;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dateien, setDateien] = useState<{ name: string; size: number }[]>([]);

  function leeren() {
    if (ref.current) ref.current.value = "";
    setDateien([]);
  }

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        id={id}
        type="file"
        name={name}
        accept={accept}
        required={required}
        multiple={multiple}
        capture={capture}
        onChange={(e) =>
          setDateien(Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: f.size })))
        }
        // Nicht `hidden` und nicht `display:none`: Ein so verstecktes Pflichtfeld
        // kann der Browser bei „Bitte Datei auswählen" nicht anspringen und meldet
        // in der Konsole einen nicht fokussierbaren Fehler. Ein Feld ohne Größe an
        // derselben Stelle bleibt dagegen ansprechbar.
        className="absolute h-0 w-0 opacity-0"
        tabIndex={-1}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => ref.current?.click()} className={buttonSecondaryClass}>
          <Paperclip className="h-4 w-4 shrink-0" />
          {label}
        </button>
        {dateien.length > 0 ? (
          <button
            type="button"
            onClick={leeren}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-green"
          >
            <X className="h-3.5 w-3.5" />
            {multiple ? "Auswahl aufheben" : "entfernen"}
          </button>
        ) : null}
      </div>

      {dateien.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-gray-600">
          {dateien.map((d) => (
            <li key={d.name} className="flex min-w-0 items-baseline gap-2">
              <span className="truncate">{d.name}</span>
              <span className="shrink-0 text-gray-400">{groesse(d.size)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400">Keine Datei gewählt.</p>
      )}

      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
