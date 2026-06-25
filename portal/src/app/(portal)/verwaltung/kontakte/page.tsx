import { Field, PageTitle, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { craftsmanWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { tradeLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { createCraftsman } from "./actions";
import { KontakteListe } from "./KontakteListe";
import type { CraftsmanRow } from "./KontakteListe";

export const dynamic = "force-dynamic";

const TRADE_ORDER = Object.keys(tradeLabels) as Array<keyof typeof tradeLabels>;

export default async function KontaktePage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; angelegt?: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { fehler, angelegt } = await searchParams;

  // Handwerker sind ein gemeinsamer Pool (überschaubar) und werden komplett geladen;
  // Mieter/Eigentümer werden im Kontaktbuch serverseitig gesucht (skaliert bei großen
  // Beständen) – siehe KontakteListe / searchContactPersons.
  const craftsmenRaw = await db.craftsman.findMany({
    where: await craftsmanWhereForVerwalter(verwalter),
    orderBy: [{ active: "desc" }, { trade: "asc" }, { name: "asc" }],
  });

  const craftsmen: CraftsmanRow[] = craftsmenRaw.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    trade: c.trade as CraftsmanRow["trade"],
    email: c.email,
    phone: c.phone,
    preferredContact: c.preferredContact as CraftsmanRow["preferredContact"],
    notes: c.notes,
    active: c.active,
    isInternal: c.isInternal,
    accessToken: c.accessToken,
  }));

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
        {/* Handwerker-Liste + Personen */}
        <div className="lg:col-span-2">
          <KontakteListe craftsmen={craftsmen} />
        </div>

        {/* Handwerker anlegen */}
        <div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Handwerker hinzufügen</h2>
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
                  {[
                    ["EMAIL", "E-Mail"],
                    ["TELEFON", "Telefon"],
                    ["MOBIL", "Mobil"],
                    ["POST", "Post"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Notizen (optional)">
                <textarea name="notes" rows={2} className={inputClass} placeholder="z. B. Verfügbarkeiten, Konditionen" />
              </Field>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" name="isInternal" className="mt-0.5" />
                <span>
                  <span className="font-medium">Interner Handwerker (Eigenleistung)</span>
                  <span className="block text-xs text-gray-500">
                    Wird bei der Vorgangszuordnung zuerst angeboten. Externe Handwerker können
                    erst nach ausdrücklicher Freigabe beauftragt werden.
                  </span>
                </span>
              </label>
              <SubmitButton pendingLabel="Wird gespeichert…">Speichern</SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
