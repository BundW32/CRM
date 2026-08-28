"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, UserRound } from "lucide-react";
import { contactKindLabels, contactMethodLabels, roleLabels, tradeLabels } from "@/lib/labels";
import { mitFreitext } from "@/lib/sonstiges";
import type { AddressBookEntry } from "@/lib/address-book";

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
      ? mitFreitext(contactKindLabels[entry.kind], entry.kindOther)
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
            {/* Vollmacht für Bescheinigungen. Nur die beiden Zustände zeigen,
                die eine Handlung nach sich ziehen – „alles in Ordnung" braucht
                kein Abzeichen und würde die Zeile nur zustellen. */}
            {entry.vollmacht === "keine" ? (
              <span
                title="Ohne Vollmacht können keine Bescheinigungen im Namen dieses Eigentümers erstellt werden."
                className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
              >
                Vollmacht fehlt
              </span>
            ) : entry.vollmacht === "im_auftrag" ? (
              <span
                title="Vollmacht liegt vor, aber keine eigenhändige Unterschrift – Bescheinigungen tragen den Zusatz „i. A.“."
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
              >
                i.&nbsp;A.
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

          {/* Bewusst RELATIV: `portalUrl` liest eine Server-Umgebungsvariable, die
              im Client nicht existiert – der Link zeigte dort immer auf
              localhost:3000. Relativ trifft er stets den richtigen Host. */}
          {entry.accessToken ? (
            <a
              href={`/auftraege/${entry.accessToken}`}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block text-xs text-brand-green hover:underline"
            >
              Auftragsportal-Link öffnen ↗
            </a>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-xs font-medium text-brand-orange-ink hover:underline"
          >
            {open ? "Schließen" : "Öffnen"}
          </button>
          {/* „Öffnen“ klappt die Kurzinfo auf, „Bearbeiten“ führt zur Detailseite –
              dort liegt bei Personen auch Zugang, Mietverhältnis und Eigentum. */}
          <Link
            href={`/verwaltung/kontakte/${entry.id}`}
            className="text-xs font-medium text-gray-500 hover:text-brand-green hover:underline"
          >
            Bearbeiten →
          </Link>
        </span>
      </div>

      {/* „Öffnen“ zeigt nur an – bearbeitet wird auf der Detailseite. Das hält
          die Liste ruhig und die Anzeige lesbar. */}
      {open ? (
        <div className="animate-page-in border-t border-gray-100 bg-gray-50/60 px-4 py-4">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">Telefon</dt>
              <dd>
                {entry.phone ? (
                  <a href={`tel:${entry.phone}`} className="text-gray-900 hover:text-brand-orange hover:underline">
                    {entry.phone}
                  </a>
                ) : (
                  <span className="text-gray-400">–</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">E-Mail</dt>
              <dd className="min-w-0 truncate">
                {entry.email ? (
                  <a href={`mailto:${entry.email}`} className="text-gray-900 hover:text-brand-orange hover:underline">
                    {entry.email}
                  </a>
                ) : (
                  <span className="text-gray-400">–</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Bevorzugter Kontaktweg</dt>
              <dd className="text-gray-900">
                {entry.preferredContact ? (
                  contactMethodLabels[entry.preferredContact]
                ) : (
                  <span className="text-gray-400">keine Angabe</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Art</dt>
              <dd className="text-gray-900">
                {artLabel}
                {!isPerson && entry.kind === "HANDWERKER" && entry.trade
                  ? ` · ${tradeLabels[entry.trade]}`
                  : ""}
              </dd>
            </div>

            {/* Zuordnungen erklären, weshalb dieselbe Person mehrfach in der
                Liste stehen kann: je Einheit ein eigener Zugang. */}
            {isPerson ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">
                  {entry.role === "EIGENTUEMER" ? "Eigentum" : "Einheiten"}
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {entry.zuordnungen.length === 0 ? (
                    <span className="text-gray-400">keine Zuordnung</span>
                  ) : (
                    entry.zuordnungen.map((z) => (
                      <span
                        key={z}
                        className="rounded-lg bg-white px-2 py-1 text-xs text-gray-700 ring-1 ring-gray-200"
                      >
                        {z}
                      </span>
                    ))
                  )}
                </dd>
              </div>
            ) : null}

            {entry.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">Notizen</dt>
                <dd className="whitespace-pre-line text-gray-700">{entry.notes}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-4 border-t border-gray-200 pt-3">
            <Link
              href={`/verwaltung/kontakte/${entry.id}`}
              className="text-xs font-medium text-brand-orange-ink hover:underline"
            >
              Bearbeiten →
            </Link>
          </div>
        </div>
      ) : null}
    </li>
  );
}
