import Link from "next/link";
import { PageTitle, Pagination, cardSurfaceClass } from "@/components/ui";
import { FilterBar, SortControl, type FilterConfig } from "@/components/filter-bar";
import { planLabel, subscriptionStatusLabel } from "@/lib/billing";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { normalizeSearch, parsePage, resolveSort, toOrderBy, pageHrefFor } from "@/lib/list-query";
import { requirePlatformAdmin } from "@/lib/platform";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Whitelist der Sortierfelder (verhindert beliebige Felder aus der URL).
const SORT_FIELDS = { registriert: "createdAt", name: "name", tarif: "plan" } as const;

const sortOptions = [
  { value: "registriert", label: "Registriert" },
  { value: "name", label: "Name" },
  { value: "tarif", label: "Tarif" },
];

const STATUS_VALUES = ["active", "trialing", "past_due", "canceled"];
const TYP_VALUES = ["verwaltung", "selbstverwalter"];

// Farbliche Einordnung des Abo-Status.
function statusTone(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "trialing":
      return "bg-blue-100 text-blue-800";
    case "past_due":
      return "bg-amber-100 text-amber-800";
    case "canceled":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default async function OrganisationenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const q = normalizeSearch(sp.q);
  const page = parsePage(sp.page);
  const sort = resolveSort(sp.sort, sp.dir, SORT_FIELDS, "registriert", "desc");

  const where: Prisma.OrganizationWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }
  if (sp.status && STATUS_VALUES.includes(sp.status)) where.subscriptionStatus = sp.status;
  if (sp.typ && TYP_VALUES.includes(sp.typ)) where.accountType = sp.typ;
  if (sp.aktiv === "1") where.active = true;
  if (sp.aktiv === "0") where.active = false;
  const hasFilter = Boolean(q || sp.status || sp.typ || sp.aktiv);

  const [total, orgs] = await Promise.all([
    db.organization.count({ where }),
    db.organization.findMany({
      where,
      orderBy: toOrderBy(sort.field, sort.dir) as Prisma.OrganizationOrderByWithRelationInput,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        accountType: true,
        active: true,
        plan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        createdAt: true,
        _count: { select: { users: true, properties: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const orgFilters: FilterConfig[] = [
    {
      key: "aktiv",
      label: "Zustand",
      allLabel: "Alle",
      primary: true,
      options: [
        { value: "1", label: "Aktiv" },
        { value: "0", label: "Inaktiv" },
      ],
    },
    {
      key: "typ",
      label: "Typ",
      allLabel: "Alle Typen",
      options: [
        { value: "verwaltung", label: "Hausverwaltung" },
        { value: "selbstverwalter", label: "Selbstverwaltung" },
      ],
    },
    {
      key: "status",
      label: "Abo-Status",
      allLabel: "Alle Status",
      options: STATUS_VALUES.map((s) => ({ value: s, label: subscriptionStatusLabel(s) })),
    },
  ];

  return (
    <>
      <PageTitle>Verwaltungen ({total})</PageTitle>

      <FilterBar
        searchPlaceholder="Suchen"
        searchHint="Nach Name oder Slug suchen"
        filters={orgFilters}
      />
      <div className="mb-3 mt-2 flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-gray-400">
          {total} {total === 1 ? "Verwaltung" : "Verwaltungen"}
          {hasFilter ? " (gefiltert)" : ""}
        </p>
        <SortControl sortOptions={sortOptions} defaultSort="registriert" total={total} />
      </div>

      <div className={`overflow-x-auto ${cardSurfaceClass}`}>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3">Verwaltung</th>
              <th className="px-4 py-3">Typ</th>
              <th className="px-4 py-3">Tarif</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trial-Ende</th>
              <th className="px-4 py-3">Nutzer / Objekte</th>
              <th className="px-4 py-3">Registriert</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orgs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Keine Verwaltungen gefunden.
                </td>
              </tr>
            ) : (
              orgs.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/plattform/organisationen/${o.id}`} className="font-medium text-brand-green hover:underline">
                      {o.name}
                    </Link>
                    <span className="block text-xs text-gray-400">
                      {o.slug}
                      {!o.active ? " · deaktiviert" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.accountType === "selbstverwalter" ? "Selbstverwaltung" : "Hausverwaltung"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{planLabel(o.plan)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(o.subscriptionStatus)}`}>
                      {subscriptionStatusLabel(o.subscriptionStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.trialEndsAt ? formatDate(o.trialEndsAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {o._count.users} / {o._count.properties}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(o.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        total={total}
        itemLabel="Verwaltungen"
        hrefFor={pageHrefFor("/plattform/organisationen", sp)}
      />
    </>
  );
}
