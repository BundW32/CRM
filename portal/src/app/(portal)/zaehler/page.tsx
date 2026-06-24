import { Card, EmptyState, Field, PageTitle, inputClass } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { SubmitButton } from "@/components/submit-button";
import { ownedProperties, propertyWhereForVerwalter, tenantUnits } from "@/lib/access";
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

  // Einmalig den Property-Scope für Verwalter berechnen
  const verwalterPropWhere = isVerwalter ? await propertyWhereForVerwalter(user) : null;

  // Relevante Zähler und Erfassungsrechte je nach Rolle
  const myUnitIds = new Set<string>();
  const myPropIds = new Set<string>();
  let meterWhere = {};
  if (isMieter) {
    const myUnits = await tenantUnits(user.id);
    myUnits.forEach((u) => myUnitIds.add(u.id));
    meterWhere = { unitId: { in: [...myUnitIds] } };
  } else if (isVerwalter) {
    meterWhere = {
      OR: [
        { property: verwalterPropWhere ?? {} },
        { unit: { property: verwalterPropWhere ?? {} } },
      ],
    };
  } else {
    const props = await ownedProperties(user.id);
    props.forEach((p) => myPropIds.add(p.id));
    meterWhere = {
      OR: [
        { propertyId: { in: [...myPropIds] } },
        { unit: { propertyId: { in: [...myPropIds] } } },
      ],
    };
  }

  const meters = await db.meter.findMany({
    where: meterWhere,
    orderBy: { createdAt: "asc" },
    include: {
      unit: { include: { property: true } },
      property: true,
      readings: { orderBy: { readingDate: "desc" }, take: 3, include: { createdBy: true } },
    },
  });

  function canSubmit(m: (typeof meters)[number]) {
    if (isVerwalter) return true;
    if (isMieter) return Boolean(m.unitId && myUnitIds.has(m.unitId));
    return Boolean(m.propertyId && myPropIds.has(m.propertyId));
  }

  // Gruppieren: Einheit → "Objekt – Einheit", Allgemein → "Objekt – Allgemein"
  const groups = new Map<string, typeof meters>();
  for (const m of meters) {
    const key = m.unit
      ? `${m.unit.property.name} – ${m.unit.label}`
      : `${m.property?.name ?? "Objekt"} – Allgemein`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const [units, properties] = isVerwalter && verwalterPropWhere !== null
    ? await Promise.all([
        db.unit.findMany({ where: { property: verwalterPropWhere }, include: { property: true }, orderBy: { label: "asc" } }),
        db.property.findMany({ where: verwalterPropWhere, orderBy: { name: "asc" } }),
      ])
    : [[], []];

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
                : "Für Sie sind noch keine Zähler hinterlegt."}
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

                      {canSubmit(m) ? (
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
                          <PendingButton
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            pendingLabel="Wird gespeichert…"
                          >
                            Speichern
                          </PendingButton>
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
            {units.length === 0 && properties.length === 0 ? (
              <p className="text-sm text-gray-500">Legen Sie zuerst Objekte mit Einheiten an.</p>
            ) : (
              <form action={createMeter} className="space-y-3">
                <Field label="Zuordnung">
                  <select name="target" required className={inputClass}>
                    <optgroup label="Allgemein (ganzes Objekt)">
                      {properties.map((p) => (
                        <option key={`prop-${p.id}`} value={`prop:${p.id}`}>
                          {p.name} – Allgemein
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Einheiten">
                      {units.map((u) => (
                        <option key={`unit-${u.id}`} value={`unit:${u.id}`}>
                          {u.property.name} – {u.label}
                        </option>
                      ))}
                    </optgroup>
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
                <SubmitButton pendingLabel="Wird angelegt…">Anlegen</SubmitButton>
                <p className="text-xs text-gray-500">
                  Allgemeinzähler (z. B. Allgemeinstrom, Hauswasser) können Eigentümer und
                  Verwalter ablesen; Einheitszähler der jeweilige Mieter.
                </p>
              </form>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}
