"use client";

import { useState } from "react";
import { Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createObjekt } from "./actions";

type UnitRow = { label: string; floor: string };
type TenantRow = { name: string; email: string; phone: string; unit: string };

let rowKey = 0;
const nextKey = () => `r${rowKey++}`;

export function ObjektForm() {
  const [units, setUnits] = useState<Array<UnitRow & { key: string }>>([
    { key: nextKey(), label: "", floor: "" },
  ]);
  const [tenants, setTenants] = useState<Array<TenantRow & { key: string }>>([]);

  const unitOptions = units
    .map((u) => u.label.trim())
    .filter((l) => l.length > 0);

  return (
    <form action={createObjekt} className="space-y-6">
      {/* 1. Objektdaten */}
      <Card title="1. Objektdaten">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bezeichnung *">
            <input
              type="text"
              name="name"
              required
              minLength={2}
              placeholder="z. B. Goethestraße 42"
              className={inputClass}
            />
          </Field>
          <Field label="Verwaltungsart *">
            <select name="managementType" required defaultValue="MIETVERWALTUNG" className={inputClass}>
              <option value="MIETVERWALTUNG">Mietverwaltung (Miethaus)</option>
              <option value="WEG">WEG (Eigentümergemeinschaft)</option>
            </select>
          </Field>
          <Field label="Straße und Hausnummer *">
            <input type="text" name="street" required minLength={2} className={inputClass} />
          </Field>
          <Field label="PLZ *">
            <input type="text" name="zip" required minLength={4} maxLength={10} className={inputClass} />
          </Field>
          <Field label="Ort *">
            <input type="text" name="city" required minLength={2} className={inputClass} />
          </Field>
        </div>

        <p className="mb-3 mt-5 text-xs font-medium uppercase tracking-wide text-gray-400">
          Optionale Angaben
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Baujahr">
            <input type="number" name="buildYear" min={1800} max={2100} className={inputClass} placeholder="z. B. 1998" />
          </Field>
          <Field label="Gesamtwohnfläche (m²)">
            <input type="number" name="livingArea" min={0} step="0.01" className={inputClass} placeholder="z. B. 420" />
          </Field>
          <Field label="Anzahl Etagen">
            <input type="number" name="floors" min={0} max={200} className={inputClass} placeholder="z. B. 3" />
          </Field>
          <Field label="Bauart">
            <input type="text" name="buildingType" className={inputClass} placeholder="z. B. Mehrfamilienhaus" />
          </Field>
          <Field label="Heizungsart">
            <input type="text" name="heatingType" className={inputClass} placeholder="z. B. Gas-Zentralheizung" />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Notizen">
            <textarea name="notes" rows={2} className={inputClass} placeholder="Sonstige Hinweise zum Objekt" />
          </Field>
        </div>
      </Card>

      {/* 2. Einheiten */}
      <Card title="2. Einheiten">
        <p className="mb-3 text-xs text-gray-500">
          Legen Sie die Wohn- bzw. Gewerbeeinheiten an. Diese stehen anschließend für die
          Mieter-Zuordnung zur Verfügung.
        </p>
        <div className="space-y-2">
          {units.map((u, i) => (
            <div key={u.key} className="flex items-end gap-2">
              <div className="flex-1">
                <Field label={i === 0 ? "Bezeichnung" : ""}>
                  <input
                    type="text"
                    name="unitLabel"
                    value={u.label}
                    onChange={(e) =>
                      setUnits((rows) =>
                        rows.map((r) => (r.key === u.key ? { ...r, label: e.target.value } : r))
                      )
                    }
                    placeholder="z. B. WE 01, EG links"
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="w-40">
                <Field label={i === 0 ? "Etage (optional)" : ""}>
                  <input
                    type="text"
                    name="unitFloor"
                    value={u.floor}
                    onChange={(e) =>
                      setUnits((rows) =>
                        rows.map((r) => (r.key === u.key ? { ...r, floor: e.target.value } : r))
                      )
                    }
                    placeholder="z. B. EG"
                    className={inputClass}
                  />
                </Field>
              </div>
              <button
                type="button"
                onClick={() => setUnits((rows) => rows.filter((r) => r.key !== u.key))}
                className="mb-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                aria-label="Einheit entfernen"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setUnits((rows) => [...rows, { key: nextKey(), label: "", floor: "" }])}
          className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + Einheit hinzufügen
        </button>
      </Card>

      {/* 3. Eigentümer */}
      <Card title="3. Eigentümer (optional)">
        <p className="mb-3 text-xs text-gray-500">
          Mit E-Mail → Einladungslink per Mail. Ohne E-Mail → druckbares Zugangsschreiben.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name">
            <input type="text" name="eigName" minLength={2} className={inputClass} />
          </Field>
          <Field label="E-Mail (optional)">
            <input type="email" name="eigEmail" className={inputClass} />
          </Field>
          <Field label="Telefon (optional)">
            <input type="tel" name="eigPhone" className={inputClass} />
          </Field>
        </div>
      </Card>

      {/* 4. Mieter */}
      <Card title="4. Mieter (optional)">
        <p className="mb-3 text-xs text-gray-500">
          Jeder Mieter erhält eine eigene Karte. Mit E-Mail wird ein Einladungslink versendet,
          ohne E-Mail wird ein Zugangsschreiben zum Drucken erstellt.
        </p>
        {tenants.length === 0 ? (
          <p className="mb-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            Noch keine Mieter hinzugefügt.
          </p>
        ) : (
          <div className="space-y-3">
            {tenants.map((t, i) => (
              <div key={t.key} className="rounded-xl border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Mieter {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setTenants((rows) => rows.filter((r) => r.key !== t.key))}
                    className="text-sm text-gray-400 hover:text-red-600"
                    aria-label="Mieter entfernen"
                  >
                    Entfernen
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name *">
                    <input
                      type="text"
                      name="tenantName"
                      value={t.name}
                      onChange={(e) =>
                        setTenants((rows) =>
                          rows.map((r) => (r.key === t.key ? { ...r, name: e.target.value } : r))
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Einheit">
                    <select
                      name="tenantUnit"
                      value={t.unit}
                      onChange={(e) =>
                        setTenants((rows) =>
                          rows.map((r) => (r.key === t.key ? { ...r, unit: e.target.value } : r))
                        )
                      }
                      className={inputClass}
                    >
                      <option value="">— keine —</option>
                      {unitOptions.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="E-Mail (optional)">
                    <input
                      type="email"
                      name="tenantEmail"
                      value={t.email}
                      onChange={(e) =>
                        setTenants((rows) =>
                          rows.map((r) => (r.key === t.key ? { ...r, email: e.target.value } : r))
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Telefon (optional)">
                    <input
                      type="tel"
                      name="tenantPhone"
                      value={t.phone}
                      onChange={(e) =>
                        setTenants((rows) =>
                          rows.map((r) => (r.key === t.key ? { ...r, phone: e.target.value } : r))
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() =>
            setTenants((rows) => [
              ...rows,
              { key: nextKey(), name: "", email: "", phone: "", unit: "" },
            ])
          }
          className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + Mieter hinzufügen
        </button>
      </Card>

      <div className="flex items-center gap-4">
        <SubmitButton pendingLabel="Wird angelegt…">Objekt anlegen</SubmitButton>
        <a href="/verwaltung/objekte" className="text-sm text-gray-500 hover:underline">
          Abbrechen
        </a>
      </div>
    </form>
  );
}
