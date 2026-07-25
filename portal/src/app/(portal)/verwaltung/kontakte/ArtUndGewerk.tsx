"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import type { ContactKind } from "@/generated/prisma/client";
import { contactKindLabels, kindUsesTrade, tradeLabels } from "@/lib/labels";

const KIND_ORDER = Object.keys(contactKindLabels) as ContactKind[];
const TRADE_ORDER = Object.keys(tradeLabels) as Array<keyof typeof tradeLabels>;

/**
 * Art und Gewerk eines Kontakts – zusammen in einer Client-Komponente, weil das
 * eine über das andere entscheidet.
 *
 * Ein Gewerk führen nur Handwerker (`kindUsesTrade`). Bei „Behörde" oder
 * „Versorger" stand das Feld früher trotzdem da, mit dem Hinweis „nur bei
 * Handwerkern relevant" – Ballast, den man bei jedem Anlegen erneut lesen und
 * überspringen musste. Jetzt verschwindet es.
 *
 * Weil `Craftsman.trade` im Schema aber ein Pflichtfeld ist, wird im
 * ausgeblendeten Zustand `ALLGEMEIN` mitgeschickt – genau der Wert, den das
 * Schema für Nicht-Handwerker vorsieht.
 */
export function ArtUndGewerk() {
  const [kind, setKind] = useState<ContactKind>("HANDWERKER");
  const zeigtGewerk = kindUsesTrade(kind);

  return (
    <>
      <Field label="Art">
        <select
          name="kind"
          required
          className={inputClass}
          value={kind}
          onChange={(e) => setKind(e.target.value as ContactKind)}
        >
          {KIND_ORDER.map((k) => (
            <option key={k} value={k}>
              {contactKindLabels[k]}
            </option>
          ))}
        </select>
      </Field>
      {zeigtGewerk ? (
        <Field label="Gewerk">
          <select name="trade" required className={inputClass} defaultValue="SANITAER">
            {TRADE_ORDER.map((t) => (
              <option key={t} value={t}>
                {tradeLabels[t]}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="trade" value="ALLGEMEIN" />
      )}
    </>
  );
}
