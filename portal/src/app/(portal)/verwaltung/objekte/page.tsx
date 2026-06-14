import { Card, EmptyState, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { createUnit } from "./actions";

export const dynamic = "force-dynamic";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; eingerichtet?: string }>;
}) {
  await requireVerwalter();
  const { fehler, eingerichtet } = await searchParams;

  const properties = await db.property.findMany({
    orderBy: { name: "asc" },
    include: {
      units: {
        include: { tenancies: { where: { active: true }, include: { user: true } } },
      },
      ownerships: { include: { user: true } },
    },
  });

  return (
    <>
      <PageTitle
        action={
          <a href="/verwaltung/objekte/neu" className={buttonClass}>
            + Objekt anlegen
          </a>
        }
      >
        Objekte
      </PageTitle>

      {eingerichtet ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Objekt wurde angelegt. Mieter können Sie jetzt unter „Nutzer“ hinzufügen.
        </p>
      ) : null}
      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Bitte alle Pflichtfelder korrekt ausfüllen.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {properties.length === 0 ? (
            <EmptyState>Noch keine Objekte angelegt.</EmptyState>
          ) : (
            properties.map((p) => (
              <Card key={p.id} title={`${p.name} · ${p.street}, ${p.zip} ${p.city}`}>
                <p className="mb-2 text-xs text-gray-500">
                  Eigentümer:{" "}
                  {p.ownerships.length > 0
                    ? p.ownerships.map((o) => o.user.name).join(", ")
                    : "– nicht zugeordnet –"}
                </p>
                {(() => {
                  const details = [
                    p.buildYear ? `Baujahr ${p.buildYear}` : null,
                    p.livingArea ? `${p.livingArea} m²` : null,
                    p.floors != null ? `${p.floors} Etagen` : null,
                    p.buildingType,
                    p.heatingType,
                  ].filter(Boolean);
                  return details.length > 0 ? (
                    <p className="mb-2 text-xs text-gray-500">{details.join(" · ")}</p>
                  ) : null;
                })()}
                {p.notes ? (
                  <p className="mb-2 text-xs italic text-gray-400">{p.notes}</p>
                ) : null}
                {p.units.length === 0 ? (
                  <p className="text-sm text-gray-500">Keine Einheiten angelegt.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {p.units.map((u) => (
                      <li key={u.id} className="flex justify-between py-2 text-sm">
                        <span className="text-gray-900">
                          {u.label}
                          {u.floor ? ` (${u.floor})` : ""}
                        </span>
                        <span className="text-gray-500">
                          {u.tenancies.length > 0
                            ? u.tenancies.map((t) => t.user.name).join(", ")
                            : "leer / kein Mieter"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))
          )}
        </div>

        <div className="space-y-5">
          <Card title="Schnell ein ganzes Objekt anlegen">
            <p className="text-sm text-gray-600">
              Objekt mit Stammdaten, Einheiten, Eigentümer und Mietern in einem Schritt
              erfassen.
            </p>
            <a href="/verwaltung/objekte/neu" className={`${buttonClass} mt-3`}>
              + Objekt anlegen
            </a>
          </Card>

          <Card title="Neue Einheit">
            <form action={createUnit} className="space-y-3">
              <Field label="Objekt">
                <select name="propertyId" required className={inputClass}>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bezeichnung">
                <input type="text" name="label" required className={inputClass} placeholder="z. B. WE 03, 1. OG links" />
              </Field>
              <Field label="Etage (optional)">
                <input type="text" name="floor" className={inputClass} />
              </Field>
              <button type="submit" className={buttonClass}>
                Anlegen
              </button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
