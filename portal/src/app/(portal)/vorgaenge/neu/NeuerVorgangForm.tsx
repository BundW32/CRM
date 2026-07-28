"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Combobox } from "@/components/combobox";
import { FileInput } from "@/components/file-input";
import { loadUnitsForProperty, type UnitOption } from "@/app/(portal)/unit-options";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass } from "@/components/ui";
import { requestableDocuments, ticketTypeLabels, tradeLabels } from "@/lib/labels";
import type { TicketTarget } from "@/lib/access";
import { createTicket } from "../actions";

type VerwalterProperty = { id: string; name: string };

// Was die vier Arten unterscheidet – in der Sprache des Melders, nicht der Verwaltung.
const TYP_ERKLAERUNG: Record<string, string> = {
  SCHADEN: "Etwas ist kaputt oder funktioniert nicht — es soll repariert werden.",
  ANFRAGE: "Eine Frage oder Bitte um Erlaubnis, ohne dass etwas defekt ist.",
  DOKUMENT_ANFRAGE: "Sie brauchen eine Bescheinigung oder ein Schreiben von der Verwaltung.",
  SONSTIGES: "Alles, was in keine der anderen Arten passt.",
};

const TYP_BETREFF_BEISPIEL: Record<string, string> = {
  SCHADEN: "z. B. Wasserfleck an der Badezimmerdecke",
  ANFRAGE: "z. B. Darf ich eine Wallbox in der Tiefgarage anbringen?",
  SONSTIGES: "Worum geht es?",
};

// Nach dem Schadensumfang zu fragen, wenn jemand um Erlaubnis bittet, ist nicht
// nur unpassend – es liest sich, als sei die Frage im falschen Formular gelandet.
const TYP_BESCHREIBUNG_BEISPIEL: Record<string, string> = {
  SCHADEN:
    "Beschreiben Sie das Problem so genau wie möglich: Seit wann besteht es? Wie groß ist der Schaden? …",
  ANFRAGE: "Beschreiben Sie Ihr Anliegen — je genauer, desto schneller die Antwort.",
  SONSTIGES: "Worum geht es?",
};

export function NeuerVorgangForm({
  targets,
  verwalterProperties,
}: {
  targets?: TicketTarget[];
  verwalterProperties?: VerwalterProperty[];
}) {
  const [type, setType] = useState("SCHADEN");
  const isDoc = type === "DOKUMENT_ANFRAGE";
  // Gewerk und Ort im Objekt gehören zur Reparatur, nicht zum Vorgang an sich.
  // Bei einer Anfrage („Darf ich eine Wallbox anbringen?") sind beide Felder
  // sinnlos und stiften den Eindruck, man müsse etwas eintragen, das man nicht hat.
  const istSchaden = type === "SCHADEN";

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

      {/* Eine Zeile je Art – die Begriffe sind nicht selbsterklärend, und wer sich
          vergreift, landet in der falschen Bearbeitung. */}
      <p className="-mt-2 text-xs text-gray-500">{TYP_ERKLAERUNG[type]}</p>

      {verwalterProperties ? (
        <VerwalterTargetFields properties={verwalterProperties} />
      ) : (
        <RoleTargetFields targets={targets ?? []} />
      )}

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
          {istSchaden ? (
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
          ) : null}

          <Field label="Betreff">
            <input
              type="text"
              name="title"
              required
              minLength={3}
              maxLength={200}
              placeholder={TYP_BETREFF_BEISPIEL[type]}
              className={inputClass}
            />
          </Field>

          {istSchaden ? (
            <Field label="Ort im Objekt (optional)">
              <input
                type="text"
                name="location"
                maxLength={200}
                placeholder="z. B. Bad, Decke über der Dusche"
                className={inputClass}
              />
            </Field>
          ) : null}

          <Field label="Beschreibung">
            <textarea
              name="description"
              required
              minLength={3}
              maxLength={5000}
              rows={6}
              placeholder={TYP_BESCHREIBUNG_BEISPIEL[type]}
              className={inputClass}
            />
          </Field>

          <Field label="Fotos / Videos (optional, max. 10 Dateien à 100 MB)">
            <FileInput
              name="photos"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
            />
          </Field>
        </>
      )}

      <SubmitButton>{isDoc ? "Dokument anfordern" : "Vorgang absenden"}</SubmitButton>
    </form>
  );
}

/**
 * Ziel-Auswahl für Mieter/Eigentümer: die Zielliste ist klein (eigene
 * Objekte/Einheiten) und wird komplett mitgeliefert.
 */
function RoleTargetFields({ targets }: { targets: TicketTarget[] }) {
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

  const unitsForProperty = useMemo(
    () => targets.filter((t) => t.propertyId === selectedPropertyId),
    [targets, selectedPropertyId]
  );

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
  const showUnitStep = unitsForProperty.length > 1;

  return (
    <>
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

      <input type="hidden" name="target" value={selectedTarget} />
    </>
  );
}

/**
 * Ziel-Auswahl für Verwalter: der Bestand kann sehr groß sein, daher wird nur die
 * Objektliste mitgeliefert und die Einheiten des gewählten Objekts **on demand**
 * nachgeladen (statt alle Einheiten ins HTML zu serialisieren).
 */
function VerwalterTargetFields({ properties }: { properties: VerwalterProperty[] }) {
  const [propertyId, setPropertyId] = useState("");
  const [target, setTarget] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

  function handlePropertyChange(value: string) {
    setPropertyId(value);
    // Ohne gewählte Einheit meint der Vorgang das gesamte Objekt – der Normalfall
    // bei Treppenhaus, Dach oder Heizungsanlage.
    setTarget(value ? `${value}|` : "");
    setUnits([]);
    const req = ++reqRef.current;
    if (!value) return;
    startTransition(async () => {
      const loaded = await loadUnitsForProperty(value);
      if (reqRef.current === req) setUnits(loaded);
    });
  }

  return (
    <>
      <Field label="Objekt">
        <Combobox
          label="Objekt"
          placeholder="Objekt suchen …"
          options={properties.map((p) => ({ value: p.id, label: p.name }))}
          value={propertyId || undefined}
          onSelect={handlePropertyChange}
          onClear={() => handlePropertyChange("")}
          tone="inForm"
        />
      </Field>

      {/* Tippbar statt Aufklappliste: Ein Objekt kann hundert Einheiten haben, und
          durch eine solche Liste zu scrollen ist im Alltag unbrauchbar. Der
          Mietername steht als Zusatz dabei – gesucht wird öfter nach „Gür" als
          nach „WE 14". */}
      <Field label="Einheit / Wohnung">
        <Combobox
          label="Einheit / Wohnung"
          placeholder={pending ? "Einheiten werden geladen …" : "Einheit suchen …"}
          options={units.map((u) => ({
            value: `${propertyId}|${u.id}`,
            label: u.label,
            sublabel: u.tenantNames.length > 0 ? u.tenantNames.join(", ") : undefined,
          }))}
          value={target && target !== `${propertyId}|` ? target : undefined}
          onSelect={setTarget}
          onClear={() => setTarget(`${propertyId}|`)}
          clearOption="— gesamtes Objekt —"
          disabled={!propertyId || pending}
          disabledHint={propertyId ? "wird geladen …" : "zuerst Objekt wählen"}
          tone="inForm"
        />
      </Field>

      <input type="hidden" name="target" value={target} />
    </>
  );
}
