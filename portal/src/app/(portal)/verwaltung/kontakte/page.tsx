import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { contactMethodLabels, roleLabels, tradeLabels } from "@/lib/labels";
import { portalUrl } from "@/lib/mailer";
import { requireVerwalter } from "@/lib/session";
import {
  createCraftsman,
  deleteCraftsman,
  toggleCraftsmanActive,
  updatePersonContact,
} from "./actions";

export const dynamic = "force-dynamic";

const TRADE_ORDER = Object.keys(tradeLabels) as Array<keyof typeof tradeLabels>;

export default async function KontaktePage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; angelegt?: string }>;
}) {
  await requireVerwalter();
  const { fehler, angelegt } = await searchParams;

  const [craftsmen, persons] = await Promise.all([
    db.craftsman.findMany({ orderBy: [{ active: "desc" }, { trade: "asc" }, { name: "asc" }] }),
    db.user.findMany({
      where: { role: { in: ["MIETER", "EIGENTUEMER"] } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <>
      <PageTitle>Kontaktbuch</PageTitle>

      {angelegt ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Handwerker wurde im Kontaktbuch gespeichert.
        </p>
      ) : null}
      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Bitte Pflichtfelder (Name, Gewerk) korrekt ausfüllen.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Handwerker-Liste */}
        <div className="space-y-4 lg:col-span-2">
          <Card title={`Handwerker (${craftsmen.length})`}>
            {craftsmen.length === 0 ? (
              <p className="text-sm text-gray-500">
                Noch keine Handwerker angelegt. Über das Formular rechts hinzufügen.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {craftsmen.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">
                        {c.company ? `${c.company} · ` : ""}
                        {c.name}
                        <span className="ml-2 rounded-full bg-brand-orange-light px-2 py-0.5 text-xs font-medium text-brand-orange-dark">
                          {tradeLabels[c.trade]}
                        </span>
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
            )}
          </Card>

          {/* Mieter & Eigentümer */}
          <Card title={`Mieter & Eigentümer (${persons.length})`}>
            {persons.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine Personen vorhanden.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {persons.map((p) => (
                  <li key={p.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {p.name}
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {roleLabels[p.role]}
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
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Handwerker anlegen */}
        <Card title="Handwerker hinzufügen">
          <form action={createCraftsman} className="space-y-3">
            <Field label="Firma (optional)">
              <input type="text" name="company" className={inputClass} placeholder="z. B. Müller Sanitär GmbH" />
            </Field>
            <Field label="Ansprechpartner / Name">
              <input type="text" name="name" required minLength={2} className={inputClass} />
            </Field>
            <Field label="Gewerk">
              <select name="trade" required className={inputClass} defaultValue="SANITAER">
                {TRADE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {tradeLabels[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Telefon">
              <input type="tel" name="phone" className={inputClass} />
            </Field>
            <Field label="E-Mail">
              <input type="email" name="email" className={inputClass} />
            </Field>
            <Field label="Bevorzugter Kontaktweg">
              <select name="preferredContact" required className={inputClass} defaultValue="TELEFON">
                {Object.entries(contactMethodLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notizen (optional)">
              <textarea name="notes" rows={2} className={inputClass} placeholder="z. B. Verfügbarkeiten, Konditionen" />
            </Field>
            <button type="submit" className={buttonClass}>
              Speichern
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
