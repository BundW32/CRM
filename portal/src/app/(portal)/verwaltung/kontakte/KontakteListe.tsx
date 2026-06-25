"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Card, inputClass } from "@/components/ui";
import { contactMethodLabels, tradeLabels } from "@/lib/labels";
import { portalUrl } from "@/lib/url";
import {
  deleteCraftsman,
  searchContactPersons,
  toggleCraftsmanActive,
  toggleCraftsmanInternal,
  updatePersonContact,
  type ContactPerson,
} from "./actions";

type Trade = keyof typeof tradeLabels;

export type CraftsmanRow = {
  id: string;
  name: string;
  company: string | null;
  trade: Trade;
  email: string | null;
  phone: string | null;
  preferredContact: keyof typeof contactMethodLabels;
  notes: string | null;
  active: boolean;
  isInternal: boolean;
  accessToken: string | null;
};

const TRADE_ORDER = Object.keys(tradeLabels) as Trade[];

export function KontakteListe({ craftsmen }: { craftsmen: CraftsmanRow[] }) {
  const [search, setSearch] = useState("");

  const q = search.toLowerCase();

  const filteredCraftsmen = q
    ? craftsmen.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.company ?? "").toLowerCase().includes(q) ||
          tradeLabels[c.trade].toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q)
      )
    : craftsmen;

  // Group craftsmen by trade
  const byTrade: Record<string, CraftsmanRow[]> = {};
  for (const c of filteredCraftsmen) {
    if (!byTrade[c.trade]) byTrade[c.trade] = [];
    byTrade[c.trade].push(c);
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Nach Name, Gewerk, Ort suchen…"
        className={inputClass}
      />

      {/* Handwerker */}
      <Card title={`Handwerker (${filteredCraftsmen.length})`}>
        {filteredCraftsmen.length === 0 ? (
          <p className="text-sm text-gray-500">
            {q ? "Keine Handwerker gefunden." : "Noch keine Handwerker angelegt."}
          </p>
        ) : (
          <div className="space-y-3">
            {TRADE_ORDER.filter((t) => byTrade[t]?.length).map((trade) => (
              <details key={trade} open>
                <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 select-none list-none">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-400">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                  {tradeLabels[trade]}
                  <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {byTrade[trade].length}
                  </span>
                </summary>
                <ul className="mt-1 divide-y divide-gray-100 pl-2">
                  {byTrade[trade].map((c) => (
                    <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900">
                          {c.company ? `${c.company} · ` : ""}
                          {c.name}
                          {c.isInternal ? (
                            <span className="ml-2 rounded-full bg-brand-green/10 px-2 py-0.5 text-xs font-semibold text-brand-green">
                              intern · Eigenleistung
                            </span>
                          ) : null}
                          {!c.active ? (
                            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                              inaktiv
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {c.phone ? (
                            <a href={`tel:${c.phone}`} className="hover:text-brand-orange hover:underline">
                              {c.phone}
                            </a>
                          ) : null}
                          {c.phone && c.email ? " · " : ""}
                          {c.email ? (
                            <a href={`mailto:${c.email}`} className="hover:text-brand-orange hover:underline">
                              {c.email}
                            </a>
                          ) : null}
                          {(c.phone || c.email) ? " · " : ""}
                          bevorzugt: {contactMethodLabels[c.preferredContact]}
                        </span>
                        {c.notes ? (
                          <span className="block text-xs italic text-gray-400">{c.notes}</span>
                        ) : null}
                        {c.accessToken ? (
                          <a
                            href={portalUrl(`/auftraege/${c.accessToken}`)}
                            target="_blank"
                            className="mt-0.5 block text-xs text-brand-green hover:underline"
                          >
                            Auftragsportal-Link öffnen ↗
                          </a>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <form action={toggleCraftsmanInternal}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="text-xs text-gray-500 hover:underline">
                            {c.isInternal ? "Als extern markieren" : "Als intern markieren"}
                          </button>
                        </form>
                        <form action={toggleCraftsmanActive}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="text-xs text-gray-500 hover:underline">
                            {c.active ? "Deaktivieren" : "Aktivieren"}
                          </button>
                        </form>
                        <form action={deleteCraftsman}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="text-xs text-red-600 hover:underline">
                            Löschen
                          </button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </Card>

      {/* Personen – serverseitige Suche (skaliert bei vielen Mietern/Eigentümern) */}
      <PersonenListe query={search} />
    </div>
  );
}

const PERSON_LIMIT = 50;

function PersonenListe({ query }: { query: string }) {
  const [persons, setPersons] = useState<ContactPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

  useEffect(() => {
    const handle = setTimeout(() => {
      const req = ++reqRef.current;
      startTransition(async () => {
        const found = await searchContactPersons(query);
        if (reqRef.current === req) {
          setPersons(found);
          setLoaded(true);
        }
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  const eigentuemer = persons.filter((p) => p.role === "EIGENTUEMER");
  const mieter = persons.filter((p) => p.role === "MIETER");

  return (
    <Card title={`Mieter & Eigentümer${pending ? " …" : ""}`}>
      {persons.length === 0 ? (
        <p className="text-sm text-gray-500">
          {!loaded || pending
            ? "Wird geladen …"
            : query
              ? "Keine Personen gefunden."
              : "Noch keine Personen vorhanden."}
        </p>
      ) : (
        <div className="space-y-6">
          {eigentuemer.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                Eigentümer ({eigentuemer.length})
              </h3>
              <ul className="divide-y divide-gray-100">
                {eigentuemer.map((p) => (
                  <PersonCard key={p.id} person={p} />
                ))}
              </ul>
            </div>
          )}
          {mieter.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                Mieter ({mieter.length})
              </h3>
              <ul className="divide-y divide-gray-100">
                {mieter.map((p) => (
                  <PersonCard key={p.id} person={p} />
                ))}
              </ul>
            </div>
          )}
          {persons.length >= PERSON_LIMIT ? (
            <p className="text-xs text-gray-400">
              Es werden die ersten {PERSON_LIMIT} Treffer angezeigt – bitte Suche verfeinern.
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function PersonCard({ person: p }: { person: ContactPerson }) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-900">
          {p.name}
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {p.role === "EIGENTUEMER" ? "Eigentümer" : "Mieter"}
          </span>
        </span>
        <span className="text-xs text-gray-500">
          {p.email ? (
            <a href={`mailto:${p.email}`} className="hover:text-brand-orange hover:underline">
              {p.email}
            </a>
          ) : (
            "keine E-Mail"
          )}
        </span>
      </div>
      <form
        action={updatePersonContact}
        className="mt-2 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="id" value={p.id} />
        <label className="flex-1">
          <span className="mb-1 block text-xs text-gray-500">Telefon</span>
          <input
            type="tel"
            name="phone"
            defaultValue={p.phone ?? ""}
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-gray-500">Bevorzugter Kontakt</span>
          <select
            name="preferredContact"
            defaultValue={p.preferredContact ?? ""}
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
        <button
          type="submit"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Speichern
        </button>
      </form>
    </li>
  );
}
