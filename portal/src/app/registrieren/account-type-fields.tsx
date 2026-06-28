"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import type { AccountType } from "@/lib/labels";

// Auswahl Hausverwaltung vs. Selbstverwaltung + dazu passend beschriftetes
// Namensfeld. Bewusst ein kleines Client-Inseln-Stück, damit das Label live
// umschaltet; der Rest des Formulars bleibt server-gerendert.
export function AccountTypeFields({ initial = "verwaltung" }: { initial?: AccountType }) {
  const [type, setType] = useState<AccountType>(initial);
  const isSelf = type === "selbstverwalter";

  const cardClass = (active: boolean) =>
    `flex cursor-pointer flex-col gap-0.5 rounded-xl border-2 p-3 text-left transition ${
      active
        ? "border-brand-orange bg-brand-orange-light"
        : "border-gray-200 bg-white hover:border-gray-300"
    }`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <label className={cardClass(!isSelf)}>
          <input
            type="radio"
            name="accountType"
            value="verwaltung"
            checked={!isSelf}
            onChange={() => setType("verwaltung")}
            className="sr-only"
          />
          <span className="text-sm font-semibold text-gray-900">Hausverwaltung</span>
          <span className="text-xs text-gray-500">Professionelle Verwaltung</span>
        </label>
        <label className={cardClass(isSelf)}>
          <input
            type="radio"
            name="accountType"
            value="selbstverwalter"
            checked={isSelf}
            onChange={() => setType("selbstverwalter")}
            className="sr-only"
          />
          <span className="text-sm font-semibold text-gray-900">Selbstverwaltung</span>
          <span className="text-xs text-gray-500">Eigene WEG / eigenes Objekt</span>
        </label>
      </div>

      <Field label={isSelf ? "Name Ihrer WEG / Ihres Objekts" : "Name der Hausverwaltung"}>
        <input
          type="text"
          name="company"
          required
          minLength={2}
          maxLength={200}
          placeholder={isSelf ? "z. B. WEG Musterstraße 12" : "z. B. Muster Hausverwaltung GmbH"}
          className={inputClass}
        />
      </Field>
    </div>
  );
}
