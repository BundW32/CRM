"use client";

import { useState } from "react";
import { Building2, UserRound } from "lucide-react";
import { inputClass } from "@/components/ui";
import { contactKindLabels, contactMethodLabels, roleLabels, tradeLabels } from "@/lib/labels";
import { portalUrl } from "@/lib/url";
import type { AddressBookEntry } from "@/lib/address-book";
import {
  deleteCraftsman,
  toggleCraftsmanActive,
  toggleCraftsmanInternal,
  updateCraftsman,
  updatePersonContact,
} from "./actions";

const TRADE_ORDER = Object.keys(tradeLabels) as Array<keyof typeof tradeLabels>;
const KIND_ORDER = Object.keys(contactKindLabels) as Array<keyof typeof contactKindLabels>;

/**
 * Eine Zeile im Adressbuch. Personen (mit Portalzugang) und Karteikarten sehen
 * bewusst ähnlich aus – gesucht wird nach Name und Nummer, nicht nach Datenmodell.
 * Ein kleines Symbol und ein Etikett machen die Art trotzdem sofort erkennbar.
 */
export function KontaktZeile({ entry }: { entry: AddressBookEntry }) {
  const [open, setOpen] = useState(false);
  const isPerson = entry.source === "person";
  const Icon = isPerson ? UserRound : Building2;

  const artLabel = isPerson
    ? entry.role
      ? roleLabels[entry.role]
      : "Person"
    : entry.kind
      ? contactKindLabels[entry.kind]
      : "Kontakt";

  const title = entry.company ? `${entry.company} · ${entry.name}` : entry.name;

  return (
    <li>
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isPerson ? "bg-brand-orange-light text-brand-orange-dark" : "bg-gray-100 text-gray-500"
          }`}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{title}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              {artLabel}
            </span>
            {!isPerson && entry.kind === "HANDWERKER" && entry.trade ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                {tradeLabels[entry.trade]}
              </span>
            ) : null}
            {entry.isInternal ? (
              <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[11px] font-semibold text-brand-green">
                intern
              </span>
            ) : null}
            {!entry.active ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                inaktiv
              </span>
            ) : null}
          </span>

          {/* Telefon und E-Mail direkt in der Zeile – dafür schlägt man hier nach. */}
          <span className="mt-0.5 block text-xs text-gray-500">
            {entry.phone ? (
              <a href={`tel:${entry.phone}`} className="hover:text-brand-orange hover:underline">
                {entry.phone}
              </a>
            ) : null}
            {entry.phone && entry.email ? " · " : ""}
            {entry.email ? (
              <a href={`mailto:${entry.email}`} className="hover:text-brand-orange hover:underline">
                {entry.email}
              </a>
            ) : null}
            {!entry.phone && !entry.email ? "keine Kontaktdaten hinterlegt" : null}
            {entry.preferredContact
              ? ` · bevorzugt: ${contactMethodLabels[entry.preferredContact]}`
              : ""}
          </span>

          {entry.notes ? (
            <span className="mt-0.5 block text-xs italic text-gray-400">{entry.notes}</span>
          ) : null}

          {entry.accessToken ? (
            <a
              href={portalUrl(`/auftraege/${entry.accessToken}`)}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block text-xs text-brand-green hover:underline"
            >
              Auftragsportal-Link öffnen ↗
            </a>
          ) : null}
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="shrink-0 text-xs font-medium text-brand-orange-ink hover:underline"
        >
          {open ? "Schließen" : "Bearbeiten"}
        </button>
      </div>

      {open ? (
        <div className="animate-page-in border-t border-gray-100 bg-gray-50/60 px-4 py-3">
          {isPerson ? (
            <form action={updatePersonContact} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="id" value={entry.id} />
              <label>
                <span className="mb-1 block text-xs text-gray-500">Name</span>
                <input
                  type="text"
                  name="name"
                  required
                  minLength={2}
                  defaultValue={entry.name}
                  className={inputClass}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-gray-500">Bevorzugter Kontaktweg</span>
                <select
                  name="preferredContact"
                  defaultValue={entry.preferredContact ?? ""}
                  className={inputClass}
                >
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
                <input
                  type="tel"
                  name="phone"
                  defaultValue={entry.phone ?? ""}
                  className={inputClass}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-gray-500">E-Mail</span>
                <input
                  type="email"
                  name="email"
                  defaultValue={entry.email ?? ""}
                  className={inputClass}
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Speichern
                </button>
              </div>
            </form>
          ) : (
            <>
              <form action={updateCraftsman} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="id" value={entry.id} />
                <label>
                  <span className="mb-1 block text-xs text-gray-500">Art</span>
                  <select
                    name="kind"
                    required
                    defaultValue={entry.kind ?? "HANDWERKER"}
                    className={inputClass}
                  >
                    {KIND_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {contactKindLabels[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs text-gray-500">Firma (optional)</span>
                  <input
                    type="text"
                    name="company"
                    defaultValue={entry.company ?? ""}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-gray-500">Ansprechpartner / Name</span>
                  <input
                    type="text"
                    name="name"
                    required
                    minLength={2}
                    defaultValue={entry.name}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-gray-500">Gewerk</span>
                  <select
                    name="trade"
                    required
                    defaultValue={entry.trade ?? "ALLGEMEIN"}
                    className={inputClass}
                  >
                    {TRADE_ORDER.map((t) => (
                      <option key={t} value={t}>
                        {tradeLabels[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs text-gray-500">Bevorzugter Kontaktweg</span>
                  <select
                    name="preferredContact"
                    required
                    defaultValue={entry.preferredContact ?? "TELEFON"}
                    className={inputClass}
                  >
                    {Object.entries(contactMethodLabels).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs text-gray-500">Telefon</span>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={entry.phone ?? ""}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-gray-500">E-Mail</span>
                  <input
                    type="email"
                    name="email"
                    defaultValue={entry.email ?? ""}
                    className={inputClass}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs text-gray-500">Notizen (optional)</span>
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={entry.notes ?? ""}
                    className={inputClass}
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Speichern
                  </button>
                </div>
              </form>

              <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-gray-200 pt-3">
                <form action={toggleCraftsmanInternal}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button type="submit" className="text-xs text-gray-500 hover:underline">
                    {entry.isInternal ? "Als extern markieren" : "Als intern markieren"}
                  </button>
                </form>
                <form action={toggleCraftsmanActive}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button type="submit" className="text-xs text-gray-500 hover:underline">
                    {entry.active ? "Deaktivieren" : "Aktivieren"}
                  </button>
                </form>
                <form action={deleteCraftsman}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Löschen
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
