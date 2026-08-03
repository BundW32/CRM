"use client";

import { PendingButton } from "@/components/pending-button";
import { inputClass } from "@/components/ui";
import { contactMethodLabels } from "@/lib/labels";
import { updatePersonContact } from "../actions";

/** Kontaktdaten einer Person – der Teil, den man im Adressbuch am häufigsten pflegt. */
export function KontaktStammdaten({
  id,
  zurueck,
  name,
  email,
  phone,
  preferredContact,
}: {
  id: string;
  /** Rücksprungpfad nach dem Speichern. */
  zurueck: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredContact: string | null;
}) {
  return (
    <form action={updatePersonContact} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="zurueck" value={zurueck} />
      <label>
        <span className="mb-1 block text-xs text-gray-500">Name</span>
        <input
          type="text"
          name="name"
          required
          minLength={2}
          defaultValue={name}
          className={inputClass}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs text-gray-500">Bevorzugter Kontaktweg</span>
        <select name="preferredContact" defaultValue={preferredContact ?? ""} className={inputClass}>
          <option value="">– keine Angabe –</option>
          {Object.entries(contactMethodLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs text-gray-500">Telefon</span>
        <input type="tel" name="phone" defaultValue={phone ?? ""} className={inputClass} />
      </label>
      <label>
        <span className="mb-1 block text-xs text-gray-500">E-Mail</span>
        <input type="email" name="email" defaultValue={email ?? ""} className={inputClass} />
      </label>
      <div className="sm:col-span-2">
        <PendingButton className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          Speichern
        </PendingButton>
      </div>
    </form>
  );
}
