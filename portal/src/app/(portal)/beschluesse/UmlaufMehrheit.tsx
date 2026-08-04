"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Field, inputClass } from "@/components/ui";

/**
 * Erforderliche Mehrheit eines **Umlaufbeschlusses**.
 *
 * Voreingestellt ist Allstimmigkeit, und das ist keine Vorsicht, sondern das
 * Gesetz: Ein Beschluss außerhalb der Versammlung kommt nach § 23 Abs. 3 WEG
 * nur zustande, wenn ALLE Eigentümer zustimmen — nicht die Mehrheit. Wer nicht
 * antwortet, blockiert. Der Grund ist der Minderheitenschutz: In der Versammlung
 * hört jeder die Gegenargumente, im Umlauf bekommt jeder nur einen fertigen Text.
 *
 * Zuvor stand hier „Einfache Mehrheit (Standard)" als Vorgabe. Eine WEG, die das
 * arglos nutzt, fasst Beschlüsse, die die gesetzliche Hürde verfehlen — bei einer
 * Verwalterbestellung ließe sich später alles kippen, was in der Zwischenzeit
 * geschah.
 *
 * Eine geringere Mehrheit bleibt wählbar, weil § 23 Abs. 3 Satz 2 sie zulässt —
 * aber nur, wenn die Gemeinschaft das Erfordernis vorher für genau diese Sache
 * abgesenkt hat. Darauf weist der Hinweis hin, sobald jemand abweicht.
 */
export function UmlaufMehrheit() {
  const [majority, setMajority] = useState("ALLSTIMMIG");
  const abgesenkt = majority !== "ALLSTIMMIG";

  return (
    <>
      <Field label="Erforderliche Mehrheit">
        <select
          name="majority"
          className={inputClass}
          value={majority}
          onChange={(e) => setMajority(e.target.value)}
        >
          <option value="ALLSTIMMIG">Allstimmigkeit — alle Eigentümer (gesetzlicher Regelfall)</option>
          <option value="EINFACH">Einfache Mehrheit</option>
          <option value="DREIVIERTEL">Qualifizierte 3/4-Mehrheit</option>
          <option value="DOPPELT_QUALIFIZIERT">
            Doppelt qualifiziert (§ 21 II: 2/3 Stimmen + 1/2 MEA)
          </option>
        </select>
      </Field>

      {abgesenkt ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Nur mit vorherigem Absenkungsbeschluss zulässig.</strong>{" "}
            Im Umlaufverfahren müssen sonst <strong>alle</strong> Eigentümer zustimmen (§ 23 Abs. 3
            Satz 1 WEG). Eine geringere Mehrheit gilt nur, wenn die Gemeinschaft das vorher{" "}
            <em>für genau diesen Gegenstand</em> beschlossen hat (§ 23 Abs. 3 Satz 2 WEG). Ohne
            diesen Beschluss kommt die Abstimmung nicht wirksam zustande und ist angreifbar.
          </span>
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          Im Umlaufverfahren zählt jede fehlende Antwort wie ein Nein — der Beschluss kommt nur
          zustande, wenn alle zustimmen. Reicht das nicht, gehört der Punkt auf die
          Tagesordnung der nächsten Versammlung, wo die einfache Mehrheit genügt.
        </p>
      )}
    </>
  );
}
