"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchPersonsForNewObjekt } from "./actions";

export type GewaehltePerson = { id: string; name: string; hint: string };

/**
 * Schlägt beim Anlegen eines Objekts vorhandene Personen vor, statt einen
 * zweiten Zugang anzulegen.
 *
 * Ohne E-Mail-Adresse legt der Zugangsschreiben-Weg immer ein neues Konto an –
 * so bekam ein Mieter mit fünf Einheiten fünf getrennte Zugänge. Sobald zwei
 * Zeichen des Nachnamens getippt sind, erscheinen passende Personen zur
 * Auswahl.
 *
 * Bewusst kein automatisches Zusammenführen anhand des Namens: Zwei
 * verschiedene Menschen können gleich heißen – deshalb entscheidet der
 * Verwalter, und der Hinweis nennt Objekt und Einheit zur Unterscheidung.
 *
 * Das versteckte Feld wird IMMER gerendert, auch leer. Die Server-Action liest
 * die Zeilen über `getAll()` indexgleich ein; ein fehlendes Feld würde die
 * Zuordnung aller folgenden Zeilen verschieben.
 */
export function PersonVorschlag({
  fieldName,
  role,
  lastName,
  gewaehlt,
  onPick,
  onClear,
}: {
  fieldName: string;
  role: "MIETER" | "EIGENTUEMER";
  lastName: string;
  gewaehlt: GewaehltePerson | null;
  onPick: (person: GewaehltePerson) => void;
  onClear: () => void;
}) {
  const [treffer, setTreffer] = useState<GewaehltePerson[]>([]);
  const [, startTransition] = useTransition();
  const reqRef = useRef(0);

  useEffect(() => {
    if (gewaehlt) return;
    const term = lastName.trim();
    // Auch das Leeren läuft über den verzögerten Aufruf – ein direktes
    // setState im Effekt-Rumpf löst eine überflüssige zweite Renderrunde aus
    // und wird vom Linter abgewiesen.
    const handle = setTimeout(() => {
      const req = ++reqRef.current;
      startTransition(async () => {
        const gefunden = term.length < 2 ? [] : await searchPersonsForNewObjekt(term, role);
        if (reqRef.current === req) setTreffer(gefunden);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [lastName, role, gewaehlt]);

  if (gewaehlt) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-brand-orange/30 bg-brand-orange-light px-3 py-2">
        <input type="hidden" name={fieldName} value={gewaehlt.id} />
        <span className="text-sm font-medium text-brand-orange-dark">
          Bestehende Person wird verknüpft
        </span>
        <span className="text-xs text-brand-orange-dark/80">
          {gewaehlt.name}
          {gewaehlt.hint ? ` · ${gewaehlt.hint}` : ""}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-xs text-gray-600 hover:underline"
        >
          Stattdessen neu anlegen
        </button>
      </div>
    );
  }

  return (
    <>
      <input type="hidden" name={fieldName} value="" />
      {treffer.length > 0 ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
          <p className="mb-1 text-xs font-medium text-amber-800">
            Diese Person gibt es bereits – erneutes Anlegen erzeugt einen zweiten Zugang:
          </p>
          <ul className="space-y-1">
            {treffer.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onPick(t)}
                  className="w-full rounded-md px-2 py-1 text-left text-xs hover:bg-amber-100"
                >
                  <span className="font-medium text-gray-900">{t.name}</span>
                  <span className="ml-2 text-gray-600">{t.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
