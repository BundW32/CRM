"use client";

import { useMemo, useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createUser } from "./actions";

type Unit = { id: string; label: string };
type Property = { id: string; name: string; units: Unit[] };

// Rollenabhängiges Anlegen: je nach Rolle erscheint nur das passende Zuordnungsfeld
// (Mieter → Objekt + Wohnung gekoppelt, Eigentümer → Objekt). So keine endlose,
// ungefilterte Wohnungsliste mehr.
export function NewUserForm({
  properties,
  isSuperAdmin,
}: {
  properties: Property[];
  isSuperAdmin: boolean;
}) {
  const [role, setRole] = useState("MIETER");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");

  const selected = useMemo(
    () => properties.find((p) => p.id === propertyId) ?? null,
    [properties, propertyId]
  );

  function handlePropertyChange(value: string) {
    setPropertyId(value);
    setUnitId((prev) =>
      prev && properties.find((p) => p.id === value)?.units.some((u) => u.id === prev) ? prev : ""
    );
  }

  return (
    <form action={createUser} className="space-y-3">
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
      <Field label="Rolle">
        <select
          name="role"
          required
          className={inputClass}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="MIETER">Mieter</option>
          <option value="EIGENTUEMER">Eigentümer</option>
          {isSuperAdmin ? (
            <>
              <option value="VERWALTER">Verwalter</option>
              <option value="HANDWERKER">Handwerker</option>
            </>
          ) : null}
        </select>
      </Field>

      {/* Mieter: Objekt → Wohnung gekoppelt */}
      {role === "MIETER" ? (
        <>
          <Field label="Objekt (bei Rolle Mieter)">
            <select
              value={propertyId}
              onChange={(e) => handlePropertyChange(e.target.value)}
              className={inputClass}
            >
              <option value="">– Objekt wählen –</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Wohnung">
            <select
              name="unitId"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={!propertyId}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <option value="">– Keine –</option>
              {selected?.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : null}

      {/* Eigentümer: nur Objekt */}
      {role === "EIGENTUEMER" ? (
        <Field label="Objekt (bei Rolle Eigentümer)">
          <select name="propertyId" className={inputClass} defaultValue="">
            <option value="">– Keins –</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
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
