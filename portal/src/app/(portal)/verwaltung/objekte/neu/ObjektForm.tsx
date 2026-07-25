"use client";

import { useRef, useState } from "react";
import { Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createObjekt } from "./actions";
import { extractObjektFields } from "./import-actions";
import { splitName } from "@/lib/person-name";
import { type GewaehltePerson, PersonVorschlag } from "./PersonVorschlag";

type UnitRow = { label: string; external: string; floor: string; area: string; mea: string; persons: string };
// `person` ist gesetzt, sobald eine bestehende Person aus dem Vorschlag gewählt
// wurde – dann wird verknüpft statt ein zweiter Zugang angelegt.
type PersonRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  unit: string;
  person: GewaehltePerson | null;
};
type TenantRow = PersonRow;
type OwnerRow = PersonRow;
type ExistingProperty = { name: string; street: string; zip: string; city: string };

let rowKey = 0;
const nextKey = () => `r${rowKey++}`;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// Felder einer verknüpften Person sind nicht änderbar – geändert wird die
// Person an ihrer eigenen Karteikarte, nicht nebenbei beim Objektanlegen.
const lockedClass = `${inputClass} bg-gray-50 text-gray-500`;

const leereZeile = () => ({
  key: nextKey(),
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  unit: "",
  person: null,
});

export function ObjektForm({
  defaultManagementType = "MIETVERWALTUNG",
  lockWeg = false,
  aiImportEnabled = false,
  defaultName = "",
  existing = [],
}: {
  defaultManagementType?: "MIETVERWALTUNG" | "WEG";
  // Selbstverwalter: Verwaltungsart ist fest WEG – keine Auswahl (kein Mietshaus).
  lockWeg?: boolean;
  // KI-PDF-Import aktiv (Server: AI_OBJEKT_IMPORT_ENABLED + GEMINI_API_KEY).
  aiImportEnabled?: boolean;
  // Vorbelegung der Bezeichnung (z. B. WEG-Name aus der Registrierung).
  defaultName?: string;
  existing?: ExistingProperty[];
}) {
  const [managementType, setManagementType] = useState(defaultManagementType);
  const isWeg = managementType === "WEG";
  const [units, setUnits] = useState<Array<UnitRow & { key: string }>>([
    { key: nextKey(), label: "", external: "", floor: "", area: "", mea: "", persons: "" },
  ]);
  const [tenants, setTenants] = useState<Array<TenantRow & { key: string }>>([]);
  const [owners, setOwners] = useState<Array<OwnerRow & { key: string }>>([]);
  const [name, setName] = useState(defaultName);
  const [street, setStreet] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [buildYear, setBuildYear] = useState("");
  const [livingArea, setLivingArea] = useState("");
  const [floors, setFloors] = useState("");
  const [buildingType, setBuildingType] = useState("");
  const [heatingType, setHeatingType] = useState("");
  const [notes, setNotes] = useState("");

  // Objekt-Eigentümer (nur Mietverwaltung): kontrolliert, damit der Vorschlag
  // vorhandener Personen daran andocken kann.
  const [eig, setEig] = useState<{
    firstName: string;
    lastName: string;
    person: GewaehltePerson | null;
  }>({ firstName: "", lastName: "", person: null });

  // KI-PDF-Import
  const pdfRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handlePdfImport() {
    const file = pdfRef.current?.files?.[0];
    if (!file) {
      setImportMsg({ ok: false, text: "Bitte zuerst eine PDF-Datei auswählen." });
      return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await extractObjektFields(fd);
      if (!res.ok) {
        setImportMsg({ ok: false, text: res.error });
        return;
      }
      const d = res.data;
      if (d.name) setName(d.name);
      if (d.street) setStreet(d.street);
      if (d.zip) setZip(d.zip);
      if (d.city) setCity(d.city);
      if (d.buildYear != null) setBuildYear(String(d.buildYear));
      if (d.livingArea != null) setLivingArea(String(d.livingArea));
      if (d.floors != null) setFloors(String(d.floors));
      if (d.buildingType) setBuildingType(d.buildingType);
      if (d.heatingType) setHeatingType(d.heatingType);
      if (d.notes) setNotes(d.notes);
      if (d.units && d.units.length > 0) {
        setUnits(
          d.units.map((u) => ({
            key: nextKey(),
            label: u.label,
            external: "",
            floor: u.floor ?? "",
            area: "",
            mea: "",
            persons: "",
          })),
        );
      }
      const n = d.units?.length ?? 0;
      setImportMsg({
        ok: true,
        text: `Daten übernommen${n ? ` (inkl. ${n} Einheit${n === 1 ? "" : "en"})` : ""}. Bitte prüfen und ergänzen.`,
      });
    } catch {
      setImportMsg({ ok: false, text: "Der Import ist fehlgeschlagen. Bitte manuell ausfüllen." });
    } finally {
      setImporting(false);
    }
  }

  const unitOptions = units
    .map((u) => u.label.trim())
    .filter((l) => l.length > 0);

  // Mögliche Dublette: gleiche Adresse (Straße + PLZ) oder identischer Name.
  const duplicates = existing.filter((p) => {
    const sameAddress =
      street.trim() !== "" && norm(p.street) === norm(street) && norm(p.zip) === norm(zip);
    const sameName = name.trim() !== "" && norm(p.name) === norm(name);
    return sameAddress || sameName;
  });

  return (
    <form action={createObjekt} className="space-y-6">
      {aiImportEnabled ? (
        <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange-light/50 p-4">
          <p className="text-sm font-semibold text-brand-green">Objektdaten aus PDF übernehmen</p>
          <p className="mt-0.5 text-xs text-gray-600">
            Objektdatenblatt, Exposé oder ERP-Export hochladen – die KI füllt die Felder
            als Vorschlag aus. Bitte anschließend prüfen und ergänzen.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf"
              className="block max-w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-green hover:file:bg-gray-50"
            />
            <button
              type="button"
              onClick={handlePdfImport}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-orange-dark disabled:opacity-60"
            >
              {importing ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
                  </svg>
                  Wird gelesen…
                </>
              ) : (
                "Aus PDF übernehmen"
              )}
            </button>
          </div>
          {importMsg ? (
            <p className={`mt-2 text-xs ${importMsg.ok ? "text-brand-green" : "text-red-600"}`}>
              {importMsg.text}
            </p>
          ) : null}
        </div>
      ) : null}
      {duplicates.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Mögliche Dublette</p>
          <p className="mt-0.5">
            Es gibt bereits {duplicates.length === 1 ? "ein Objekt" : `${duplicates.length} Objekte`}{" "}
            mit ähnlichen Angaben:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {duplicates.slice(0, 5).map((p, i) => (
              <li key={i}>
                {p.name} · {p.street}, {p.zip} {p.city}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">
            Sie können das Objekt trotzdem anlegen – bitte prüfen Sie aber, ob es nicht bereits
            erfasst ist.
          </p>
        </div>
      ) : null}
      {/* 1. Objektdaten */}
      <Card title="1. Objektdaten">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bezeichnung *">
            <input
              type="text"
              name="name"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Goethestraße 42"
              className={inputClass}
            />
          </Field>
          {lockWeg ? (
            // Selbstverwalter: fest WEG, keine Auswahl (Mietshaus nicht erlaubt).
            <input type="hidden" name="managementType" value="WEG" />
          ) : (
            <Field label="Verwaltungsart *">
              <select
                name="managementType"
                required
                value={managementType}
                onChange={(e) => setManagementType(e.target.value as "MIETVERWALTUNG" | "WEG")}
                className={inputClass}
              >
                <option value="MIETVERWALTUNG">Mietverwaltung (Miethaus)</option>
                <option value="WEG">WEG (Eigentümergemeinschaft)</option>
              </select>
            </Field>
          )}
          {isWeg ? (
            <Field label="Stimmprinzip (nur WEG)">
              <select name="votingPrinciple" defaultValue="KOPF" className={inputClass}>
                <option value="KOPF">Kopfprinzip – eine Stimme je Eigentümer</option>
                <option value="MEA">Wertprinzip – Stimmgewicht nach Miteigentumsanteilen</option>
                <option value="OBJEKT">Objektprinzip – eine Stimme je Einheit</option>
              </select>
            </Field>
          ) : null}
          <Field label="Straße und Hausnummer *">
            <input
              type="text"
              name="street"
              required
              minLength={2}
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="PLZ *">
            <input
              type="text"
              name="zip"
              required
              minLength={4}
              maxLength={10}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Ort *">
            <input
              type="text"
              name="city"
              required
              minLength={2}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <p className="mb-3 mt-5 text-xs font-medium uppercase tracking-wide text-gray-400">
          Optionale Angaben
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Baujahr">
            <input type="number" name="buildYear" min={1800} max={2100} value={buildYear} onChange={(e) => setBuildYear(e.target.value)} className={inputClass} placeholder="z. B. 1998" />
          </Field>
          <Field label="Gesamtwohnfläche (m²)">
            <input type="number" name="livingArea" min={0} step="0.01" value={livingArea} onChange={(e) => setLivingArea(e.target.value)} className={inputClass} placeholder="z. B. 420" />
          </Field>
          <Field label="Anzahl Etagen">
            <input type="number" name="floors" min={0} max={200} value={floors} onChange={(e) => setFloors(e.target.value)} className={inputClass} placeholder="z. B. 3" />
          </Field>
          <Field label="Bauart">
            <input type="text" name="buildingType" value={buildingType} onChange={(e) => setBuildingType(e.target.value)} className={inputClass} placeholder="z. B. Mehrfamilienhaus" />
          </Field>
          <Field label="Heizungsart">
            <input type="text" name="heatingType" value={heatingType} onChange={(e) => setHeatingType(e.target.value)} className={inputClass} placeholder="z. B. Gas-Zentralheizung" />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Notizen">
            <textarea name="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Sonstige Hinweise zum Objekt" />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Titelbild (optional)">
            <input
              type="file"
              name="titleImage"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-orange-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-orange-dark hover:file:bg-orange-100"
            />
          </Field>
        </div>
      </Card>

      {/* 2. Einheiten */}
      <Card title="2. Einheiten">
        <p className="mb-3 text-xs text-gray-500">
          Legen Sie die Wohn- bzw. Gewerbeeinheiten an. Diese stehen anschließend für die
          {isWeg ? " Eigentümer-Zuordnung" : " Mieter-Zuordnung"} zur Verfügung.
        </p>
        {isWeg ? (
          <p className="mb-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            <strong>MEA</strong> (Miteigentumsanteil) stammt aus der Teilungserklärung und ist
            Grundlage des Wertprinzips – er lässt sich nicht aus der Fläche ableiten. Die
            Wohnfläche dient flächenbasierten Umlageschlüsseln. Beides ist optional und später
            unter „Eigentümer &amp; MEA&ldquo; bzw. den WEG-Stammdaten änderbar.
          </p>
        ) : null}
        <div className="space-y-3">
          {units.map((u, i) => (
            <div key={u.key} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Field label={i === 0 ? "Bezeichnung (intern)" : ""}>
                    <input
                      type="text"
                      name="unitLabel"
                      value={u.label}
                      onChange={(e) =>
                        setUnits((rows) =>
                          rows.map((r) => (r.key === u.key ? { ...r, label: e.target.value } : r))
                        )
                      }
                      placeholder="z. B. WE 01"
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
              <div className="mt-2">
                <Field label={i === 0 ? "Externe Bezeichnung / Lage (optional)" : ""}>
                  <input
                    type="text"
                    name="unitExternalLabel"
                    value={u.external}
                    onChange={(e) =>
                      setUnits((rows) => rows.map((r) => (r.key === u.key ? { ...r, external: e.target.value } : r)))
                    }
                    placeholder="erscheint in Dokumenten & für Mieter/Eigentümer, z. B. 1. OG links"
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className={`mt-2 grid gap-2 ${isWeg ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
                <Field label="Etage (optional)">
                  <input
                    type="text"
                    name="unitFloor"
                    value={u.floor}
                    onChange={(e) =>
                      setUnits((rows) => rows.map((r) => (r.key === u.key ? { ...r, floor: e.target.value } : r)))
                    }
                    placeholder="z. B. EG"
                    className={inputClass}
                  />
                </Field>
                <Field label="Fläche (m²)">
                  <input
                    type="text"
                    inputMode="decimal"
                    name="unitArea"
                    value={u.area}
                    onChange={(e) =>
                      setUnits((rows) => rows.map((r) => (r.key === u.key ? { ...r, area: e.target.value } : r)))
                    }
                    placeholder="z. B. 72,5"
                    className={inputClass}
                  />
                </Field>
                {isWeg ? (
                  <Field label="MEA">
                    <input
                      type="number"
                      min={0}
                      name="unitMea"
                      value={u.mea}
                      onChange={(e) =>
                        setUnits((rows) => rows.map((r) => (r.key === u.key ? { ...r, mea: e.target.value } : r)))
                      }
                      placeholder="z. B. 250"
                      className={inputClass}
                    />
                  </Field>
                ) : null}
                <Field label="Personen">
                  <input
                    type="number"
                    min={0}
                    name="unitPersons"
                    value={u.persons}
                    onChange={(e) =>
                      setUnits((rows) => rows.map((r) => (r.key === u.key ? { ...r, persons: e.target.value } : r)))
                    }
                    placeholder="z. B. 2"
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setUnits((rows) => [...rows, { key: nextKey(), label: "", external: "", floor: "", area: "", mea: "", persons: "" }])}
          className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + Einheit hinzufügen
        </button>
      </Card>

      {/* 3. Eigentümer — WEG: je Einheit; Mietverwaltung: ein Objekt-Eigentümer */}
      {isWeg ? (
        <Card title="3. Eigentümer je Einheit">
          <p className="mb-3 text-xs text-gray-500">
            In einer WEG gehört jede Einheit einem eigenen Eigentümer. Ordnen Sie jeder Einheit
            ihre(n) Eigentümer zu (Miteigentum: mehrere Zeilen mit derselben Einheit). Mit E-Mail →
            Einladungslink, ohne E-Mail → druckbares Zugangsschreiben.
          </p>
          {owners.length === 0 ? (
            <p className="mb-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              Noch keine Eigentümer hinzugefügt.
            </p>
          ) : (
            <div className="space-y-3">
              {owners.map((o, i) => (
                <div key={o.key} className="rounded-xl border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Eigentümer {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => setOwners((rows) => rows.filter((r) => r.key !== o.key))}
                      className="text-sm text-gray-400 hover:text-red-600"
                      aria-label="Eigentümer entfernen"
                    >
                      Entfernen
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Vorname *">
                      <input
                        type="text"
                        name="wegOwnerFirstName"
                        value={o.firstName}
                        readOnly={o.person !== null}
                        onChange={(e) =>
                          setOwners((rows) =>
                            rows.map((r) => (r.key === o.key ? { ...r, firstName: e.target.value } : r))
                          )
                        }
                        className={o.person ? lockedClass : inputClass}
                      />
                    </Field>
                    <Field label="Nachname *">
                      <input
                        type="text"
                        name="wegOwnerLastName"
                        value={o.lastName}
                        readOnly={o.person !== null}
                        onChange={(e) =>
                          setOwners((rows) =>
                            rows.map((r) => (r.key === o.key ? { ...r, lastName: e.target.value } : r))
                          )
                        }
                        className={o.person ? lockedClass : inputClass}
                      />
                    </Field>
                    <Field label="Einheit *">
                      <select
                        name="wegOwnerUnit"
                        value={o.unit}
                        onChange={(e) =>
                          setOwners((rows) =>
                            rows.map((r) => (r.key === o.key ? { ...r, unit: e.target.value } : r))
                          )
                        }
                        className={inputClass}
                      >
                        <option value="">— wählen —</option>
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
                        name="wegOwnerEmail"
                        value={o.email}
                        readOnly={o.person !== null}
                        onChange={(e) =>
                          setOwners((rows) =>
                            rows.map((r) => (r.key === o.key ? { ...r, email: e.target.value } : r))
                          )
                        }
                        className={o.person ? lockedClass : inputClass}
                      />
                    </Field>
                    <Field label="Telefon (optional)">
                      <input
                        type="tel"
                        name="wegOwnerPhone"
                        value={o.phone}
                        readOnly={o.person !== null}
                        onChange={(e) =>
                          setOwners((rows) =>
                            rows.map((r) => (r.key === o.key ? { ...r, phone: e.target.value } : r))
                          )
                        }
                        className={o.person ? lockedClass : inputClass}
                      />
                    </Field>
                  </div>
                  <PersonVorschlag
                    fieldName="wegOwnerUserId"
                    role="EIGENTUEMER"
                    lastName={o.lastName}
                    gewaehlt={o.person}
                    onPick={(person) =>
                      setOwners((rows) =>
                        rows.map((r) =>
                          r.key === o.key
                            ? { ...r, ...splitName(person.name), email: "", phone: "", person }
                            : r,
                        ),
                      )
                    }
                    onClear={() =>
                      setOwners((rows) =>
                        rows.map((r) => (r.key === o.key ? { ...r, person: null } : r)),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOwners((rows) => [...rows, leereZeile()])}
            className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            + Eigentümer hinzufügen
          </button>
        </Card>
      ) : (
        <Card title="3. Eigentümer (optional)">
          <p className="mb-3 text-xs text-gray-500">
            Mit E-Mail → Einladungslink per Mail. Ohne E-Mail → druckbares Zugangsschreiben.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vorname">
              <input
                type="text"
                name="eigFirstName"
                minLength={2}
                value={eig.firstName}
                readOnly={eig.person !== null}
                onChange={(e) => setEig((v) => ({ ...v, firstName: e.target.value }))}
                className={eig.person ? lockedClass : inputClass}
              />
            </Field>
            <Field label="Nachname">
              <input
                type="text"
                name="eigLastName"
                minLength={2}
                value={eig.lastName}
                readOnly={eig.person !== null}
                onChange={(e) => setEig((v) => ({ ...v, lastName: e.target.value }))}
                className={eig.person ? lockedClass : inputClass}
              />
            </Field>
            <Field label="E-Mail (optional)">
              <input
                type="email"
                name="eigEmail"
                readOnly={eig.person !== null}
                className={eig.person ? lockedClass : inputClass}
              />
            </Field>
            <Field label="Telefon (optional)">
              <input
                type="tel"
                name="eigPhone"
                readOnly={eig.person !== null}
                className={eig.person ? lockedClass : inputClass}
              />
            </Field>
          </div>
          <PersonVorschlag
            fieldName="eigUserId"
            role="EIGENTUEMER"
            lastName={eig.lastName}
            gewaehlt={eig.person}
            onPick={(person) => setEig({ ...splitName(person.name), person })}
            onClear={() => setEig((v) => ({ ...v, person: null }))}
          />
        </Card>
      )}

      {/* 4. Mieter (optional) — bei WEG nur, wenn ein Eigentümer seine Einheit vermietet */}
      <Card title="4. Mieter (optional)">
        <p className="mb-3 text-xs text-gray-500">
          {isWeg
            ? "Nur nötig, wenn eine Einheit vermietet ist. Jeder Mieter erhält eine eigene Karte; "
            : "Jeder Mieter erhält eine eigene Karte. "}
          Mit E-Mail wird ein Einladungslink versendet, ohne E-Mail wird ein Zugangsschreiben zum
          Drucken erstellt.
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
                  <Field label="Vorname *">
                    <input
                      type="text"
                      name="tenantFirstName"
                      value={t.firstName}
                      readOnly={t.person !== null}
                      onChange={(e) =>
                        setTenants((rows) =>
                          rows.map((r) => (r.key === t.key ? { ...r, firstName: e.target.value } : r))
                        )
                      }
                      className={t.person ? lockedClass : inputClass}
                    />
                  </Field>
                  <Field label="Nachname *">
                    <input
                      type="text"
                      name="tenantLastName"
                      value={t.lastName}
                      readOnly={t.person !== null}
                      onChange={(e) =>
                        setTenants((rows) =>
                          rows.map((r) => (r.key === t.key ? { ...r, lastName: e.target.value } : r))
                        )
                      }
                      className={t.person ? lockedClass : inputClass}
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
                      readOnly={t.person !== null}
                      onChange={(e) =>
                        setTenants((rows) =>
                          rows.map((r) => (r.key === t.key ? { ...r, email: e.target.value } : r))
                        )
                      }
                      className={t.person ? lockedClass : inputClass}
                    />
                  </Field>
                  <Field label="Telefon (optional)">
                    <input
                      type="tel"
                      name="tenantPhone"
                      value={t.phone}
                      readOnly={t.person !== null}
                      onChange={(e) =>
                        setTenants((rows) =>
                          rows.map((r) => (r.key === t.key ? { ...r, phone: e.target.value } : r))
                        )
                      }
                      className={t.person ? lockedClass : inputClass}
                    />
                  </Field>
                </div>
                <PersonVorschlag
                  fieldName="tenantUserId"
                  role="MIETER"
                  lastName={t.lastName}
                  gewaehlt={t.person}
                  onPick={(person) =>
                    setTenants((rows) =>
                      rows.map((r) =>
                        r.key === t.key
                          ? { ...r, ...splitName(person.name), email: "", phone: "", person }
                          : r,
                      ),
                    )
                  }
                  onClear={() =>
                    setTenants((rows) =>
                      rows.map((r) => (r.key === t.key ? { ...r, person: null } : r)),
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setTenants((rows) => [...rows, leereZeile()])}
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
