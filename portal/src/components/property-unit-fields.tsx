"use client";

import { useRef, useState, useTransition } from "react";
import { loadUnitsForProperty, type UnitOption } from "@/app/(portal)/unit-options";
import { Combobox } from "@/components/combobox";
import { Field } from "@/components/ui";

type Property = { id: string; name: string };

/**
 * Gekoppeltes Objekt/Einheit-Auswahlpaar.
 *
 * Zwei Dinge machen es alltagstauglich, und eines davon fehlte hier lange:
 *
 * 1. Die Einheiten werden **on demand** für das gewählte Objekt nachgeladen, statt
 *    den ganzen Bestand ins HTML zu schreiben. Die Einheit bleibt gesperrt, bis ein
 *    Objekt steht — vorher gäbe es nichts Sinnvolles zu wählen.
 * 2. **Beide Listen sind tippbar.** Ein Auswahlfeld ohne Suche ist bei einem Objekt
 *    mit hundert Einheiten unbenutzbar: Man scrollt durch eine endlose Liste, statt
 *    „42" zu tippen. Die Objektliste hatte deshalb schon ein Suchfeld, die
 *    Einheitenliste nicht — jetzt beide über `Combobox`, der zusätzlich
 *    umlautunabhängig sucht („strasse" findet „Straße").
 *
 * Die Werte gehen über versteckte Felder ins Formular (`propertyId`, `unitId`);
 * `Combobox` ist rein gesteuert und schickt von sich aus nichts mit. Seine eigene
 * `label`-Angabe ist nur für Screenreader — die sichtbare Beschriftung liefert
 * `Field`, wie bei jedem anderen Formularfeld auch.
 */
export function PropertyUnitFields({
  properties,
  propertyLabel = "Objekt (optional)",
  unitLabel = "Einheit (optional)",
  propertyPlaceholder = "– Allgemein –",
  unitPlaceholder = "– Keine –",
}: {
  properties: Property[];
  propertyLabel?: string;
  unitLabel?: string;
  propertyPlaceholder?: string;
  unitPlaceholder?: string;
}) {
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [pending, startTransition] = useTransition();
  // Race-Schutz: nur die Antwort zur zuletzt gewählten Anfrage übernehmen.
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
    <>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="unitId" value={unitId} />

      <Field label={propertyLabel}>
        <Combobox
          label={propertyLabel}
          placeholder="Objekt suchen …"
          options={properties.map((p) => ({ value: p.id, label: p.name }))}
          value={propertyId || undefined}
          onSelect={handlePropertyChange}
          onClear={() => handlePropertyChange("")}
          clearOption={propertyPlaceholder}
          tone="inForm"
        />
      </Field>

      <Field label={unitLabel}>
        <Combobox
          label={unitLabel}
          placeholder={pending ? "Einheiten werden geladen …" : "Einheit suchen …"}
          options={units.map((u) => ({
            value: u.id,
            label: u.label,
            // Der Mietername macht die Einheit auffindbar, wenn man die Nummer
            // nicht im Kopf hat – im Alltag der häufigere Fall.
            sublabel: u.tenantNames.length > 0 ? u.tenantNames.join(", ") : undefined,
          }))}
          value={unitId || undefined}
          onSelect={setUnitId}
          onClear={() => setUnitId("")}
          clearOption={unitPlaceholder}
          disabled={!propertyId || pending}
          disabledHint={propertyId ? "wird geladen …" : "zuerst Objekt wählen"}
          tone="inForm"
        />
      </Field>

      {propertyId && !pending && units.length === 0 ? (
        <span className="-mt-2 block text-xs text-gray-400">
          Dieses Objekt hat keine Einheiten.
        </span>
      ) : null}
    </>
  );
}
