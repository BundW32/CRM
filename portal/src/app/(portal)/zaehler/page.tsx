import type { Prisma } from "@/generated/prisma/client";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Pagination, Alert, Card, EmptyState, Field, PageTitle, inputClass } from "@/components/ui";
import { FilterBar, SortControl, type FilterConfig } from "@/components/filter-bar";
import { PendingButton } from "@/components/pending-button";
import { SubmitButton } from "@/components/submit-button";
import { ownedProperties, propertyWhereForVerwalter, tenantUnits } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, meterTypeLabels } from "@/lib/labels";
import { optionsFrom, propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, pageHrefFor, parsePage, resolveSort, toOrderBy } from "@/lib/list-query";
import { requireUser } from "@/lib/session";
import { createMeter, deleteMeter, submitReading } from "./actions";
import { MeterTargetPicker } from "./meter-target-picker";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

// Whitelist der Sortierfelder (verhindert beliebige Felder aus der URL).
// Bewusst NICHT nach Objekt: Allgemeinzähler hängen am Objekt statt an einer
// Einheit, eine gemeinsame Sortierung darüber liefe über zwei verschiedene
// Beziehungen und stellte sie ans Ende. Dafür gibt es den Objekt-Filter.
const SORT_FIELDS = { nummer: "meterNumber", art: "type", angelegt: "createdAt" } as const;

const sortOptions = [
  { value: "nummer", label: "Zählernummer" },
  { value: "art", label: "Zählerart" },
  { value: "angelegt", label: "Anlagedatum" },
];

export default async function ZaehlerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const { fehler, gespeichert } = sp;
  const currentPage = parsePage(sp.page);
  const sort = resolveSort(sp.sort, sp.dir, SORT_FIELDS, "angelegt", "asc");
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

  // ── Filter (Suche, Art, Objekt/Einheit) auf den Rollen-Scope aufsetzen ──
  const scope = await propertyScopeFilters(user, sp, { withUnit: true });
  const q = normalizeSearch(sp.q);
  const art = sp.art && sp.art in meterTypeLabels ? sp.art : undefined;

  const meterAnd: Prisma.MeterWhereInput[] = [meterWhere];
  if (q) {
    meterAnd.push({
      OR: [
        { meterNumber: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (art) meterAnd.push({ type: art as Prisma.MeterWhereInput["type"] });
  if (scope.objektId) {
    meterAnd.push({
      OR: [{ propertyId: scope.objektId }, { unit: { propertyId: scope.objektId } }],
    });
  }
  if (scope.einheitId) meterAnd.push({ unitId: scope.einheitId });
  const hasFilter = Boolean(q || art || scope.active);
  meterWhere = { AND: meterAnd };

  const [totalMeters, meters] = await Promise.all([
    db.meter.count({ where: meterWhere }),
    db.meter.findMany({
      where: meterWhere,
      orderBy: toOrderBy(sort.field, sort.dir),
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        unit: { include: { property: true } },
        property: true,
        readings: { orderBy: { readingDate: "desc" }, take: 3, include: { createdBy: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalMeters / PAGE_SIZE));

  const pageHref = pageHrefFor(`/zaehler`, sp);

  const meterFilters: FilterConfig[] = [
    {
      key: "art",
      label: "Zählerart",
      allLabel: "Alle Arten",
      primary: true,
      options: optionsFrom(meterTypeLabels),
    },
  ];

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

  // Nur die Objektliste ausliefern; Einheiten lädt das Formular bei Objektauswahl
  // on demand nach (skaliert auch bei sehr großen Beständen).
  const properties =
    isVerwalter && verwalterPropWhere !== null
      ? await db.property.findMany({
          where: verwalterPropWhere,
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [];

  return (
    <>
      <PageTitle>Zählerstände</PageTitle>

      {gespeichert ? (
        <Alert variant="success" className="mb-4">
          Zählerstand gespeichert. Vielen Dank!
        </Alert>
      ) : null}
      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "wert"
            ? "Bitte einen gültigen Zählerstand (Zahl) eingeben."
            : "Bitte alle Pflichtfelder ausfüllen."}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div>
            <FilterBar
              searchPlaceholder="Suchen"
              searchHint="Nach Zählernummer oder Einbauort suchen"
              filters={meterFilters}
              comboboxes={scope.comboboxes}
            />
            <div className="mt-2 flex items-center justify-between gap-3 px-1">
              <p className="text-xs text-gray-400">
                {totalMeters} {totalMeters === 1 ? "Zähler" : "Zähler"}
                {hasFilter ? " (gefiltert)" : ""}
              </p>
              <SortControl sortOptions={sortOptions} defaultSort="angelegt" total={totalMeters} />
            </div>
          </div>

          {groups.size === 0 ? (
            <EmptyState>
              {hasFilter
                ? "Keine Zähler gefunden."
                : isVerwalter
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
                            <ConfirmActionButton
                              className="text-xs text-red-600 hover:underline"
                              confirmLabel="Wirklich löschen?"
                              pendingLabel="Wird gelöscht…"
                            >
                              Zähler löschen
                            </ConfirmActionButton>
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

          <Pagination currentPage={currentPage} totalPages={totalPages} total={totalMeters} itemLabel="Zähler" hrefFor={pageHref} />
        </div>

        {isVerwalter ? (
          <Card title="Zähler anlegen">
            {properties.length === 0 ? (
              <p className="text-sm text-gray-500">Legen Sie zuerst Objekte mit Einheiten an.</p>
            ) : (
              <form action={createMeter} className="space-y-3">
                <MeterTargetPicker properties={properties} />
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
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="remoteReadable" className="mt-0.5" />
                  <span>
                    Fernablesbar (Funk/Smart) — löst die monatliche Verbrauchsinformation
                    (§ 6a HeizkostenV) aus.
                  </span>
                </label>
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
