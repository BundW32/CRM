"use client";

import { useState, useTransition } from "react";
import { buttonSecondaryClass } from "@/components/ui";
import type { VerbindungsErgebnis } from "@/lib/assistant";
import { testeAssistentVerbindung } from "./actions";

/**
 * „Verbindung testen" für den KI-Assistenten.
 *
 * Die Karte daneben sagt, ob die beiden Umgebungsvariablen gesetzt sind — mehr
 * kann sie nicht wissen. Sind sie gesetzt und der Assistent antwortet trotzdem
 * nur „Der Assistent ist momentan nicht erreichbar.", war bisher Schluss: Diese
 * eine Zeile deckt einen abgelehnten Schlüssel, ein abgeschaltetes Modell, ein
 * erschöpftes Kontingent und eine Zeitüberschreitung gleichermaßen zu.
 *
 * Der Test fragt Google direkt und gibt dessen Antwort in Klartext zurück —
 * bei unbekanntem Modell samt der Namen, die dieser Schlüssel wirklich nutzen
 * darf. Das ist der Unterschied zwischen „geht nicht" und „trage dies ein".
 */
export function AssistentTest() {
  const [ergebnis, setErgebnis] = useState<VerbindungsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button
        type="button"
        disabled={laeuft}
        onClick={() =>
          starte(async () => {
            setErgebnis(await testeAssistentVerbindung());
          })
        }
        className={`${buttonSecondaryClass} disabled:opacity-60`}
      >
        {laeuft ? "Wird geprüft…" : "Verbindung zu Google testen"}
      </button>

      {ergebnis ? (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
            ergebnis.ok
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          <p className="font-medium">{ergebnis.meldung}</p>

          {ergebnis.modelle.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs font-medium">
                Für diesen Schlüssel verfügbar — einen davon in <code>GEMINI_MODEL</code>{" "}
                eintragen:
              </p>
              <ul className="mt-1 grid gap-0.5 text-xs">
                {ergebnis.modelle.map((m) => (
                  <li key={m}>
                    <code>{m}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {ergebnis.details ? (
            <p className="mt-2 text-xs opacity-80">Antwort von Google: {ergebnis.details}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">
          Prüft Schlüssel und Modellnamen direkt bei Google. Kostet kein Kontingent und
          zeigt den Schlüssel nicht an.
        </p>
      )}
    </div>
  );
}
