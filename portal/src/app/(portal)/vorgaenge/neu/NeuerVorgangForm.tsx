"use client";

import { useMemo, useState } from "react";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { requestableDocuments, ticketTypeLabels, tradeLabels } from "@/lib/labels";
import type { TicketTarget } from "@/lib/access";
import { createTicket } from "../actions";

export function NeuerVorgangForm({ targets }: { targets: TicketTarget[] }) {
  const [type, setType] = useState("SCHADEN");
  const isDoc = type === "DOKUMENT_ANFRAGE";

  // Objekte dedupliziert, sortiert
  const properties = useMemo(() => {
    const seen = new Set<string>();
    const list: { propertyId: string; propertyName: string }[] = [];
    for (const t of targets) {
      if (!seen.has(t.propertyId)) {
        seen.add(t.propertyId);
        list.push({ propertyId: t.propertyId, propertyName: t.propertyName });
      }
    }
    return list;
  }, [targets]);

  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.propertyId ?? "");

  // Einheiten des gewählten Objekts
  const unitsForProperty = useMemo(
    () => targets.filter((t) => t.propertyId === selectedPropertyId),
    [targets, selectedPropertyId]
  );

  // Initialer target-Wert
  const initialTarget = useMemo(() => {
    const first = unitsForProperty[0];
    return first ? `${first.propertyId}|${first.unitId ?? ""}` : "";
  }, [unitsForProperty]);

  const [selectedTarget, setSelectedTarget] = useState(initialTarget);

  function handlePropertyChange(pid: string) {
    setSelectedPropertyId(pid);
    const first = targets.find((t) => t.propertyId === pid);
    setSelectedTarget(first ? `${first.propertyId}|${first.unitId ?? ""}` : "");
  }

  const showPropertyStep = properties.length > 1;
  // Einheiten-Dropdown nur zeigen wenn es mehrere Optionen gibt
  const showUnitStep = unitsForProperty.length > 1;

  return (
    <form action={createTicket} className="max-w-2xl space-y-4">
      <Field label="Art des Vorgangs">
        <select
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={inputClass}
        >
          {Object.entries(ticketTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      {/* Schritt 1: Objekt wählen */}
      {showPropertyStep ? (
        <Field label="Objekt">
          <select
            value={selectedPropertyId}
            onChange={(e) => handlePropertyChange(e.target.value)}
            className={inputClass}
          >
            {properties.map((p) => (
              <option key={p.propertyId} value={p.propertyId}>
                {p.propertyName}
              </option>
            ))}
          </select>
        </Field>
      ) : properties.length === 1 ? (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-medium">Objekt:</span> {properties[0].propertyName}
        </p>
      ) : null}

      {/* Schritt 2: Einheit wählen */}
      {showUnitStep ? (
        <Field label="Einheit / Wohnung">
          <select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            className={inputClass}
          >
            {unitsForProperty.map((t) => {
              const value = `${t.propertyId}|${t.unitId ?? ""}`;
              const label =
                t.unitId === null
                  ? "— gesamtes Objekt —"
                  : t.tenantNames.length > 0
                    ? `${t.unitLabel}  ·  ${t.tenantNames.join(", ")}`
                    : t.unitLabel;
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
        </Field>
      ) : null}

      {/* Versteckter Wert für den Server */}
      <input type="hidden" name="target" value={selectedTarget} />

      {isDoc ? (
        <>
          <Field label="Benötigtes Dokument">
            <select name="title" required className={inputClass} defaultValue={requestableDocuments[0]}>
              {requestableDocuments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Anmerkung (optional)">
            <textarea
              name="description"
              maxLength={5000}
              rows={4}
              placeholder="z. B. wofür Sie das Dokument benötigen oder bis wann"
              className={inputClass}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Kategorie / Gewerk (hilft bei der Handwerker-Zuordnung)">
            <select name="trade" className={inputClass} defaultValue="">
              <option value="">– Keine Angabe / weiß ich nicht –</option>
              {Object.entries(tradeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Betreff">
            <input
              type="text"
              name="title"
              required
              minLength={3}
              maxLength={200}
              placeholder="z. B. Wasserfleck an der Badezimmerdecke"
              className={inputClass}
            />
          </Field>

          <Field label="Ort im Objekt (optional)">
            <input
              type="text"
              name="location"
              maxLength={200}
              placeholder="z. B. Bad, Decke über der Dusche"
              className={inputClass}
            />
          </Field>

          <Field label="Beschreibung">
            <textarea
              name="description"
              required
              minLength={3}
              maxLength={5000}
              rows={6}
              placeholder="Beschreiben Sie das Problem so genau wie möglich: Seit wann besteht es? Wie groß ist der Schaden? …"
              className={inputClass}
            />
          </Field>

          <Field label="Fotos / Videos (optional, max. 10 Dateien à 100 MB)">
            <input
              type="file"
              name="photos"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-orange-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-orange-dark hover:file:bg-orange-100"
            />
          </Field>
        </>
      )}

      <button type="submit" className={buttonClass}>
        {isDoc ? "Dokument anfordern" : "Vorgang absenden"}
      </button>
    </form>
  );
}
