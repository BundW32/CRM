"use client";

import { useRef, useState, useTransition } from "react";
import { Combobox } from "@/components/combobox";
import { loadUnitsForProperty, type UnitOption } from "@/app/(portal)/unit-options";
import { Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createUser } from "./actions";

type Property = { id: string; name: string };

// Rollenabhängiges Anlegen: je nach Rolle erscheint nur das passende Zuordnungsfeld
// (Mieter → Objekt + Wohnung gekoppelt, Eigentümer → Objekt). Die Einheiten werden
// on demand für das gewählte Objekt nachgeladen – keine endlose Wohnungsliste.
export function NewUserForm({
  properties,
  isSuperAdmin,
  selfManaged = false,
  zurueck = "/verwaltung/nutzer",
  presetRole,
}: {
  properties: Property[];
  isSuperAdmin: boolean;
  selfManaged?: boolean;
  /** Rücksprungpfad nach dem Anlegen. */
  zurueck?: string;
  /**
   * Rolle von außen vorgegeben (Kontakte-Seite): Dort wählt man die Art des
   * Kontakts ganz oben, und daraus folgt erst, ob überhaupt ein Zugang entsteht.
   * Die eigene Rollenauswahl entfällt dann – sie stünde sonst doppelt da.
   */
  presetRole?: string;
}) {
  const [role, setRole] = useState(presetRole ?? (selfManaged ? "EIGENTUEMER" : "MIETER"));

  // Vorgabe von außen gewinnt: Wechselt die Art oben, wechselt hier die Rolle mit.
  const effectiveRole = presetRole ?? role;
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

  function handlePropertyChange(value: string) {
    setPropertyId(value);
    setUnitId("");
    setUnits([]);
    const req = ++reqRef.current;
    if (!value) return;
    startTransition(async () => {
      const loaded = await loadUnitsForProperty(value);
      if (reqRef.current === req) setUnits(loaded);
    });
  }

  return (
    <form action={createUser} className="space-y-3">
      <input type="hidden" name="zurueck" value={zurueck} />
      <Field label="Name">
        <div className="flex flex-wrap gap-2">
          <select name="salutation" className={`${inputClass} w-24`} defaultValue="">
            <option value="">Anrede</option>
            <option value="Herr">Herr</option>
            <option value="Frau">Frau</option>
          </select>
          <input type="text" name="firstName" required placeholder="Vorname" className={`${inputClass} flex-1`} />
          <input type="text" name="lastName" required placeholder="Nachname" className={`${inputClass} flex-1`} />
        </div>
      </Field>
      <Field label="Zugang per">
        <select name="method" required className={inputClass} defaultValue="email">
          <option value="email">E-Mail-Einladung (Link zum Selbst-Einrichten)</option>
          <option value="schreiben">Zugangsschreiben zum Ausdrucken</option>
        </select>
      </Field>
      <Field label="E-Mail-Adresse (bei E-Mail-Einladung erforderlich)">
        <input type="email" name="email" className={inputClass} />
      </Field>
      <Field label="Telefon (optional)">
        <input type="tel" name="phone" className={inputClass} />
      </Field>
      <Field label="Bevorzugter Kontaktweg (optional)">
        <select name="preferredContact" className={inputClass} defaultValue="">
          <option value="">– keine Angabe –</option>
          <option value="EMAIL">E-Mail</option>
          <option value="TELEFON">Telefon</option>
          <option value="MOBIL">Mobil</option>
          <option value="POST">Post</option>
        </select>
      </Field>
      {presetRole ? (
        <input type="hidden" name="role" value={presetRole} />
      ) : (
        <Field label="Rolle">
          <select
            name="role"
            required
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {/* Mieter gibt es auch in der Selbstverwaltung: Ein Eigentümer kann
                seine Einheit vermieten. Der Objekt-Weg (`objekte/neu`) legt dort
                längst Mieter an – das Dropdown hatte sie ohne fachlichen Grund
                verborgen. In der Selbstverwaltung steht nur der Eigentümer vorn. */}
            <option value="MIETER">Mieter</option>
            <option value="EIGENTUEMER">Eigentümer</option>
            {/* Handwerker bekommen bewusst kein Portalkonto – sie werden unter
                „Kontakte" gepflegt und erhalten ihre Aufträge per E-Mail-Link. */}
            {isSuperAdmin ? <option value="VERWALTER">Verwalter</option> : null}
          </select>
        </Field>
      )}

      {/* Mieter: Objekt → Wohnung gekoppelt */}
      {effectiveRole === "MIETER" ? (
        <>
          <input type="hidden" name="unitId" value={unitId} />
          <Field label="Objekt (bei Rolle Mieter)">
            <Combobox
              label="Objekt"
              placeholder="Objekt suchen …"
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
              value={propertyId || undefined}
              onSelect={handlePropertyChange}
              onClear={() => handlePropertyChange("")}
              clearOption="– Objekt wählen –"
            />
          </Field>
          <Field label="Wohnung">
            <Combobox
              label="Wohnung"
              placeholder={pending ? "Wohnungen werden geladen …" : "Wohnung suchen …"}
              options={units.map((u) => ({
                value: u.id,
                label: u.istStellplatz ? `${u.label} · Stellplatz` : u.label,
              }))}
              value={unitId || undefined}
              onSelect={setUnitId}
              onClear={() => setUnitId("")}
              clearOption="– Keine –"
              disabled={!propertyId || pending}
              disabledHint={propertyId ? "wird geladen …" : "zuerst Objekt wählen"}
            />
          </Field>
        </>
      ) : null}

      {/* Eigentümer: nur Objekt */}
      {effectiveRole === "EIGENTUEMER" ? (
        <>
          <input type="hidden" name="propertyId" value={propertyId} />
          <Field label="Objekt (bei Rolle Eigentümer)">
            <Combobox
              label="Objekt"
              placeholder="Objekt suchen …"
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
              value={propertyId || undefined}
              onSelect={setPropertyId}
              onClear={() => setPropertyId("")}
              clearOption="– Keins –"
            />
          </Field>
        </>
      ) : null}

      <SubmitButton pendingLabel="Wird angelegt…">Anlegen</SubmitButton>
      <p className="text-xs text-gray-500">
        <strong>E-Mail-Einladung:</strong> Der Nutzer erhält einen Link zum Einrichten seines
        Passworts (gültig 7 Tage). <strong>Zugangsschreiben:</strong> Es wird ein Erst-Passwort
        erzeugt und ein druckbares Schreiben geöffnet — ideal für Mieter ohne E-Mail-Adresse.
      </p>
    </form>
  );
}
