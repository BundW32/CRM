import { Card, EmptyState, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { ownedProperties, tenantUnits } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, meterTypeLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { createMeter, deleteMeter, submitReading } from "./actions";

export const dynamic = "force-dynamic";

export default async function ZaehlerPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; gespeichert?: string }>;
}) {
  const user = await requireUser();
  const { fehler, gespeichert } = await searchParams;
  const isVerwalter = user.role === "VERWALTER";
  const isMieter = user.role === "MIETER";

  // Relevante Zähler je nach Rolle
  let where = {};
  if (isMieter) {
    const units = await tenantUnits(user.id);
    where = { unitId: { in: units.map((u) => u.id) } };
  } else if (!isVerwalter) {
    const props = await ownedProperties(user.id);
    where = { unit: { propertyId: { in: props.map((p) => p.id) } } };
  }

  const meters = await db.meter.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      unit: { include: { property: true } },
      readings: {
        orderBy: { readingDate: "desc" },
        take: 3,
        include: { createdBy: true },
      },
    },
  });

  // Nach Objekt/Einheit gruppieren
  const groups = new Map<string, typeof meters>();
  for (const m of meters) {
    const key = `${m.unit.property.name} – ${m.unit.label}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const units = isVerwalter
    ? await db.unit.findMany({ include: { property: true }, orderBy: { label: "asc" } })
    : [];

  const canSubmit = isVerwalter || isMieter;

  return (
    <>
      <PageTitle>Zählerstände</PageTitle>

      {gespeichert ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Zählerstand gespeichert. Vielen Dank!
        </p>
      ) : null}
      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {fehler === "wert"
            ? "Bitte einen gültigen Zählerstand (Zahl) eingeben."
            : "Bitte alle Pflichtfelder ausfüllen."}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {groups.size === 0 ? (
            <EmptyState>
              {isVerwalter
                ? "Noch keine Zähler angelegt."
                : "Für Ihre Einheit sind noch keine Zähler hinterlegt."}
            </EmptyState>
          ) : (
            [...groups.entries()].map(([key, list]) => (
              <Card key={key} title={key}>
                <ul className="space-y-4">
                  {list.map((m) => (
                    <li key={m.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {meterTypeLabels[m.type]}
                          {m.meterNumber ? ` · Nr. ${m.meterNumber}` : ""}
                          {m.location ? ` · ${m.location}` : ""}
                        </span>
                        {isVerwalter ? (
                          <form action={deleteMeter}>
                            <input type="hidden" name="id" value={m.id} />
                            <button type="submit" className="text-xs text-red-600 hover:underline">
                              Zähler löschen
                            </button>
                          </form>
                        ) : null}
                      </div>

                      {m.readings.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-gray-500">
                          {m.readings.map((r) => (
                            <li key={r.id}>
                              {formatDate(r.readingDate)}: <strong>{r.value}</strong>
                              {r.note ? ` · ${r.note}` : ""} · erfasst von {r.createdBy.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-gray-400">Noch kein Stand erfasst.</p>
                      )}

                      {canSubmit ? (
                        <form action={submitReading} className="mt-2 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="meterId" value={m.id} />
                          <label>
                            <span className="mb-1 block text-xs text-gray-500">Stand</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              name="value"
                              required
                              placeholder="z. B. 14502"
                              className={`${inputClass} w-32`}
                            />
                          </label>
                          <label>
                            <span className="mb-1 block text-xs text-gray-500">Datum</span>
                            <input type="date" name="readingDate" className={`${inputClass} w-40`} />
                          </label>
                          <button
                            type="submit"
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Speichern
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          )}
        </div>

        {isVerwalter ? (
          <Card title="Zähler anlegen">
            {units.length === 0 ? (
              <p className="text-sm text-gray-500">
                Legen Sie zuerst Objekte mit Einheiten an.
              </p>
            ) : (
              <form action={createMeter} className="space-y-3">
                <Field label="Einheit">
                  <select name="unitId" required className={inputClass}>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.property.name} – {u.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Zählerart">
                  <select name="type" required className={inputClass} defaultValue="STROM">
                    {Object.entries(meterTypeLabels).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Zählernummer (optional)">
                  <input type="text" name="meterNumber" className={inputClass} />
                </Field>
                <Field label="Einbauort (optional)">
                  <input type="text" name="location" className={inputClass} placeholder="z. B. Keller" />
                </Field>
                <button type="submit" className={buttonClass}>
                  Anlegen
                </button>
              </form>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}
