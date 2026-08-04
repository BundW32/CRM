"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { MEETING_AGENDA_TEMPLATES } from "@/lib/weg/meeting-agenda-templates";

/**
 * Auswahl eines TOP aus dem Vorlagenkatalog — mit Vorschau.
 *
 * Zuvor stand hier nur ein Auswahlfeld. Es schneidet lange Titel ab, und der
 * eigentliche Inhalt — der ausformulierte Beschlussvorschlag — war überhaupt
 * nicht zu sehen. Man musste „Vorlage übernehmen" drücken, um zu erfahren, was
 * man übernimmt, und danach wieder aufräumen, wenn es das Falsche war.
 *
 * Die Vorlagen liegen ohnehin im Browser (sie stammen aus einer Konstante, nicht
 * aus der Datenbank) — die Vorschau kostet also keine Abfrage.
 */
export function VorlagenWahl() {
  const [key, setKey] = useState(MEETING_AGENDA_TEMPLATES[0].key);
  const vorlage = MEETING_AGENDA_TEMPLATES.find((t) => t.key === key);

  return (
    <>
      <Field label="Aus Vorlagenkatalog">
        <select
          name="templateKey"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className={inputClass}
        >
          {MEETING_AGENDA_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.title}
              {t.type === "BESCHLUSS" ? " (Beschluss)" : ""}
            </option>
          ))}
        </select>
      </Field>

      {vorlage ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-gray-900">
            {vorlage.title}
            {vorlage.type === "BESCHLUSS" ? (
              <span className="rounded-full bg-brand-orange-light px-2 py-0.5 text-[11px] font-medium text-brand-orange-dark">
                Beschluss
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
            {vorlage.description}
          </p>
        </div>
      ) : null}
    </>
  );
}
