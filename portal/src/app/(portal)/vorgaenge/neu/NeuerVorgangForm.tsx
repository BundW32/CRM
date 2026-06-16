"use client";

import { useState } from "react";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { requestableDocuments, ticketTypeLabels, tradeLabels } from "@/lib/labels";
import { createTicket } from "../actions";

type Target = { propertyId: string; unitId: string | null; label: string };

export function NeuerVorgangForm({ targets }: { targets: Target[] }) {
  const [type, setType] = useState("SCHADEN");
  const isDoc = type === "DOKUMENT_ANFRAGE";

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

      <Field label="Objekt / Wohnung">
        <select name="target" required className={inputClass}>
          {targets.map((t) => (
            <option
              key={`${t.propertyId}|${t.unitId ?? ""}`}
              value={`${t.propertyId}|${t.unitId ?? ""}`}
            >
              {t.label}
            </option>
          ))}
        </select>
      </Field>

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

          <Field label="Fotos (optional, max. 10 Bilder à 10 MB)">
            <input
              type="file"
              name="photos"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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
