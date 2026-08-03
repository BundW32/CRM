"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { DateField } from "@/components/fields";
import { PendingButton } from "@/components/pending-button";
import { inputClass } from "@/components/ui";
import { searchPersonsForUnit } from "./actions";

type Treffer = { id: string; name: string; hint: string };

const knopfClass =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-brand-green hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Person einer Einheit zuordnen – entweder neu anlegen oder eine **bestehende**
 * verwenden.
 *
 * Der zweite Weg ist der Grund für diese Komponente: Ohne E-Mail-Adresse legte
 * das Anlegen bisher immer ein neues Konto an, sodass ein Mieter mit fünf
 * Einheiten fünf getrennte Zugänge bekam. Sobald ein Name getippt wird,
 * erscheinen passende vorhandene Personen zur Auswahl.
 *
 * Bewusst kein automatisches Zusammenführen anhand des Namens: Zwei
 * verschiedene Menschen können gleich heißen – deshalb entscheidet der
 * Verwalter, und der Hinweis nennt Objekt und Einheit zur Unterscheidung.
 *
 * **Der Vorschlag ist keine Empfehlung mehr, sondern eine Weiche.** Solange
 * Treffer dastehen, ist das Anlegen gesperrt: Bisher blieb der Knopf daneben
 * aktiv, und wer die Liste für einen Hinweis hielt, legte genau die Dublette
 * an, vor der sie warnt. Wer die Person trotzdem neu braucht, sagt das einmal
 * ausdrücklich — dieselbe Entscheidung wie vorher, nur bewusst getroffen.
 */
export function AddPersonForm({
  action,
  idName,
  idValue,
  label,
  role,
  anteil = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  idName: string;
  idValue: string;
  label: string;
  role: "MIETER" | "EIGENTUEMER";
  /**
   * Miteigentumsanteil und Stichtag miterfassen. Nur bei Eigentümern **einer
   * Einheit** sinnvoll: In der Mietverwaltung hängt der Eigentümer am Objekt,
   * und dort gibt es keinen Anteil an einer Einheit.
   */
  anteil?: boolean;
}) {
  const [lastName, setLastName] = useState("");
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Treffer | null>(null);
  const [trotzdemNeu, setTrotzdemNeu] = useState(false);
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
        if (reqRef.current === req) {
          setTreffer(gefunden);
          // Neue Trefferlage, neue Entscheidung: Ein einmal gegebenes
          // „trotzdem neu" darf nicht für einen anderen Namen weitergelten.
          if (gefunden.length > 0) setTrotzdemNeu(false);
        }
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [lastName, role, gewaehlt]);

  // Anteil und Stichtag begleiten beide Wege — die vorhandene Person bekommt
  // ihren halben Anteil genauso wie die neu angelegte.
  const anteilFelder = anteil ? (
    <>
      <label className="flex items-center gap-1.5 text-xs text-gray-600">
        Anteil
        <input
          name="sharePercent"
          inputMode="decimal"
          defaultValue="100"
          aria-label="Miteigentumsanteil an dieser Einheit in Prozent"
          className={`${inputClass} max-w-[5rem]`}
        />
        %
      </label>
      <DateField
        name="validFrom"
        aria-label="Eigentum ab"
        title="Eigentum ab – bei einem Eigentümerwechsel der Tag des Übergangs"
        className="max-w-[9.5rem]"
      />
    </>
  ) : null;

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
        {anteilFelder}
        <PendingButton className={knopfClass} pendingLabel="Wird zugeordnet…">
          {label}
        </PendingButton>
      </form>
    );
  }

  // Solange Treffer dastehen, ist das Anlegen gesperrt — außer der Verwalter
  // hat ausdrücklich widersprochen.
  const gesperrt = treffer.length > 0 && !trotzdemNeu;

  return (
    <div className="mt-2">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name={idName} value={idValue} />
        <input name="firstName" placeholder="Vorname" className={`${inputClass} max-w-[8rem]`} />
        {/* Gesucht wird über den vollen Namen, nicht nur über den Nachnamen –
            die Beschriftung sagt das jetzt auch. */}
        <input
          name="lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Nachname"
          aria-label="Nachname – hier wird nach vorhandenen Personen gesucht"
          className={`${inputClass} max-w-[9rem]`}
        />
        <input
          name="email"
          type="email"
          placeholder="E-Mail (optional)"
          className={`${inputClass} max-w-[13rem]`}
        />
        {anteilFelder}
        <PendingButton
          className={knopfClass}
          disabled={gesperrt}
          pendingLabel="Wird angelegt…"
          title={gesperrt ? "Es gibt bereits Personen dieses Namens – bitte zuerst auswählen" : undefined}
        >
          {label}
        </PendingButton>
      </form>

      {treffer.length > 0 ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
          <p className="mb-1 text-xs font-medium text-amber-800">
            {trotzdemNeu
              ? "Es gibt bereits Personen dieses Namens. Sie legen bewusst eine weitere an:"
              : "Diese Person gibt es bereits – erneutes Anlegen erzeugt einen zweiten Zugang:"}
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
          {!trotzdemNeu ? (
            <button
              type="button"
              onClick={() => setTrotzdemNeu(true)}
              className="mt-1 px-2 text-xs text-amber-800 underline hover:text-amber-900"
            >
              Keine davon – trotzdem neu anlegen
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
