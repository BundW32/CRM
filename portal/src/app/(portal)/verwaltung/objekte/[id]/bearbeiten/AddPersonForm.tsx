"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/ui";
import { searchPersonsForUnit } from "./actions";

type Treffer = { id: string; name: string; hint: string };

/**
 * Person einer Einheit zuordnen – entweder neu anlegen oder eine **bestehende**
 * verwenden.
 *
 * Der zweite Weg ist der Grund für diese Komponente: Ohne E-Mail-Adresse legte
 * das Anlegen bisher immer ein neues Konto an, sodass ein Mieter mit fünf
 * Einheiten fünf getrennte Zugänge bekam. Sobald ein Nachname getippt wird,
 * erscheinen passende vorhandene Personen zur Auswahl.
 *
 * Bewusst kein automatisches Zusammenführen anhand des Namens: Zwei
 * verschiedene Menschen können gleich heißen – deshalb entscheidet der
 * Verwalter, und der Hinweis nennt Objekt und Einheit zur Unterscheidung.
 */
export function AddPersonForm({
  action,
  idName,
  idValue,
  label,
  role,
}: {
  action: (formData: FormData) => void | Promise<void>;
  idName: string;
  idValue: string;
  label: string;
  role: "MIETER" | "EIGENTUEMER";
}) {
  const [lastName, setLastName] = useState("");
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Treffer | null>(null);
  const [, startTransition] = useTransition();
  const reqRef = useRef(0);

  useEffect(() => {
    if (gewaehlt) return;
    const term = lastName.trim();
    // Auch das Leeren läuft über den verzögerten Aufruf – ein direktes
    // setState im Effekt-Rumpf löst eine überflüssige zweite Renderrunde aus.
    const handle = setTimeout(() => {
      const req = ++reqRef.current;
      startTransition(async () => {
        const gefunden = term.length < 2 ? [] : await searchPersonsForUnit(term, role);
        if (reqRef.current === req) setTreffer(gefunden);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [lastName, role, gewaehlt]);

  if (gewaehlt) {
    return (
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name={idName} value={idValue} />
        <input type="hidden" name="userId" value={gewaehlt.id} />
        <span className="inline-flex items-center gap-2 rounded-lg bg-brand-orange-light px-3 py-2 text-sm text-brand-orange-dark">
          <span className="font-medium">{gewaehlt.name}</span>
          <span className="text-xs opacity-80">{gewaehlt.hint}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setGewaehlt(null);
            setLastName("");
          }}
          className="text-xs text-gray-500 hover:underline"
        >
          andere Person
        </button>
        <button
          type="submit"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-brand-green hover:bg-gray-50"
        >
          {label}
        </button>
      </form>
    );
  }

  return (
    <div className="mt-2">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name={idName} value={idValue} />
        <input name="firstName" placeholder="Vorname" className={`${inputClass} max-w-[8rem]`} />
        <input
          name="lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Nachname"
          className={`${inputClass} max-w-[9rem]`}
        />
        <input
          name="email"
          type="email"
          placeholder="E-Mail (optional)"
          className={`${inputClass} max-w-[13rem]`}
        />
        <button
          type="submit"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-brand-green hover:bg-gray-50"
        >
          {label}
        </button>
      </form>

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
                  onClick={() => setGewaehlt(t)}
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
    </div>
  );
}
