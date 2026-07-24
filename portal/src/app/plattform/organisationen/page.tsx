import Link from "next/link";
import { PageTitle, Pagination, inputClass } from "@/components/ui";
import { planLabel, subscriptionStatusLabel } from "@/lib/billing";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { requirePlatformAdmin } from "@/lib/platform";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

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
  searchParams: Promise<{ q?: string; status?: string; typ?: string; aktiv?: string; page?: string }>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.OrganizationWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }
  if (sp.status) where.subscriptionStatus = sp.status;
  if (sp.typ) where.accountType = sp.typ;
  if (sp.aktiv === "1") where.active = true;
  if (sp.aktiv === "0") where.active = false;

  const [total, orgs] = await Promise.all([
    db.organization.count({ where }),
    db.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
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

  // Filter-Chip: baut die aktuelle Query mit einem geänderten Parameter.
  function chipHref(param: string, value: string | null) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sp.status) params.set("status", sp.status);
    if (sp.typ) params.set("typ", sp.typ);
    if (sp.aktiv) params.set("aktiv", sp.aktiv);
    if (value === null) params.delete(param);
    else params.set(param, value);
    const s = params.toString();
    return `/plattform/organisationen${s ? `?${s}` : ""}`;
  }

  return (
    <>
      <PageTitle>Verwaltungen ({total})</PageTitle>

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Name oder Slug suchen…"
          className={`${inputClass} max-w-xs`}
        />
        {sp.status ? <input type="hidden" name="status" value={sp.status} /> : null}
        {sp.typ ? <input type="hidden" name="typ" value={sp.typ} /> : null}
        {sp.aktiv ? <input type="hidden" name="aktiv" value={sp.aktiv} /> : null}
        <button type="submit" className="rounded-lg bg-shell-2 px-4 py-2 text-sm text-white">
          Suchen
        </button>
      </form>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link href={chipHref("aktiv", null)} className={`rounded-full border px-3 py-1 ${!sp.aktiv ? "border-brand-orange bg-brand-orange text-white" : "border-gray-300 bg-white text-gray-600"}`}>Alle</Link>
        <Link href={chipHref("aktiv", "1")} className={`rounded-full border px-3 py-1 ${sp.aktiv === "1" ? "border-brand-orange bg-brand-orange text-white" : "border-gray-300 bg-white text-gray-600"}`}>Aktiv</Link>
        <Link href={chipHref("aktiv", "0")} className={`rounded-full border px-3 py-1 ${sp.aktiv === "0" ? "border-brand-orange bg-brand-orange text-white" : "border-gray-300 bg-white text-gray-600"}`}>Inaktiv</Link>
        <span className="mx-1 text-gray-300">·</span>
        <Link href={chipHref("typ", null)} className={`rounded-full border px-3 py-1 ${!sp.typ ? "border-gray-400 bg-gray-100 text-gray-700" : "border-gray-300 bg-white text-gray-600"}`}>Alle Typen</Link>
        <Link href={chipHref("typ", "verwaltung")} className={`rounded-full border px-3 py-1 ${sp.typ === "verwaltung" ? "border-gray-400 bg-gray-100 text-gray-700" : "border-gray-300 bg-white text-gray-600"}`}>Hausverwaltung</Link>
        <Link href={chipHref("typ", "selbstverwalter")} className={`rounded-full border px-3 py-1 ${sp.typ === "selbstverwalter" ? "border-gray-400 bg-gray-100 text-gray-700" : "border-gray-300 bg-white text-gray-600"}`}>Selbstverwaltung</Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
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
        hrefFor={(p) => chipHref("page", String(p))}
      />
    </>
  );
}
