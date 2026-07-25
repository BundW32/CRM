import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { Card, EmptyState, PageTitle, Pagination, buttonSecondaryClass } from "@/components/ui";
import { ownedProperties, isSelfManaged, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import {
  documentCategoryLabels,
  formatBytes,
  formatDate,
  resolutionStatusLabels,
  votingPrincipleLabels,
} from "@/lib/labels";
import { parsePage } from "@/lib/list-query";
import { getOrganization, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const LIST_PAGE_SIZE = 20;

const statusTone: Record<string, string> = {
  ANGENOMMEN: "bg-green-100 text-green-800",
  ABGELEHNT: "bg-red-100 text-red-700",
  ZURUECKGEZOGEN: "bg-gray-200 text-gray-700",
};

// Konsolidierte Transparenz-/Leseansicht für die Selbstverwaltung: Eigentümer
// (und der interne Verwalter) sehen an einer Stelle die Eigentümerliste mit MEA
// und Stimmanteil, den Verwaltungsbeirat, die Beschluss-Sammlung und die für
// Eigentümer freigegebenen Dokumente (u. a. Versammlungsprotokolle). Reine
// Lesesicht – keine Schreibrechte; Finanzbelege bleiben extern.
export default async function GemeinschaftPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (user.role !== "VERWALTER" && user.role !== "EIGENTUEMER") redirect("/dashboard");
  // Nur in selbstverwalteten Organisationen – im Profi-Profil bleibt WEG unter „Verwaltung".
  if (!isSelfManaged(await getOrganization())) redirect("/dashboard");

  const sp = await searchParams;
  const { objekt } = sp;
  const bPage = parsePage(sp.bseite);
  const dPage = parsePage(sp.dseite);

  // Zugängliche WEG-Objekte (Verwalter: Scope; Eigentümer: eigene, org-gesichert).
  let propWhere;
  if (user.role === "VERWALTER") {
    propWhere = { ...(await propertyWhereForVerwalter(user)), managementType: "WEG" as const };
  } else {
    const owned = (await ownedProperties(user.id)).filter(
      (p) => p.organizationId === user.organizationId,
    );
    propWhere = { id: { in: owned.map((p) => p.id) }, managementType: "WEG" as const };
  }
  const properties = await db.property.findMany({
    where: propWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true, votingPrinciple: true },
  });

  const selected = properties.find((p) => p.id === objekt) ?? properties[0] ?? null;

  const owners = selected
    ? await db.ownership.findMany({
        where: { propertyId: selected.id },
        include: { user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      })
    : [];
  const totalMea = owners.reduce((s, o) => s + (o.mea ?? 0), 0);
  const boardMembers = owners.filter((o) => o.isBoardMember);

  // Beschlüsse und Dokumente wachsen dauerhaft – beide paginiert. Vorher waren
  // die Beschlüsse unbegrenzt und die Dokumente still auf 20 gedeckelt.
  const resolutionWhere: Prisma.ResolutionWhereInput | undefined = selected
    ? { propertyId: selected.id, status: { in: ["ANGENOMMEN", "ABGELEHNT"] } }
    : undefined;
  const documentWhere: Prisma.DocumentWhereInput | undefined = selected
    ? { propertyId: selected.id, audience: { in: ["EIGENTUEMER", "ALLE"] } }
    : undefined;

  const [resolutions, resolutionTotal, documents, documentTotal] = selected
    ? await Promise.all([
        db.resolution.findMany({
          where: resolutionWhere,
          orderBy: [{ number: "asc" }, { decidedAt: "asc" }],
          skip: (bPage - 1) * LIST_PAGE_SIZE,
          take: LIST_PAGE_SIZE,
          select: { id: true, number: true, title: true, status: true, decidedAt: true },
        }),
        db.resolution.count({ where: resolutionWhere }),
        db.document.findMany({
          where: documentWhere,
          orderBy: { createdAt: "desc" },
          skip: (dPage - 1) * LIST_PAGE_SIZE,
          take: LIST_PAGE_SIZE,
          select: { id: true, title: true, category: true, createdAt: true, size: true },
        }),
        db.document.count({ where: documentWhere }),
      ])
    : [[], 0, [], 0];

  // Blättern in einer Liste erhält Objektauswahl und die andere Liste.
  function hrefWith(param: string, p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== param) params.set(k, v);
    }
    if (p > 1) params.set(param, String(p));
    const qs = params.toString();
    return `/gemeinschaft${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <PageTitle>Gemeinschaft</PageTitle>

      {properties.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">
            Für Sie ist noch keine WEG hinterlegt. Sobald ein WEG-Objekt angelegt und Ihnen als
            Eigentümer zugeordnet ist, sehen Sie hier die Transparenz-Übersicht Ihrer Gemeinschaft.
          </p>
        </Card>
      ) : (
        <>
          {/* Objektauswahl */}
          {properties.length > 1 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {properties.map((p) => (
                <Link
                  key={p.id}
                  href={`/gemeinschaft?objekt=${p.id}`}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    selected?.id === p.id
                      ? "border-brand-orange bg-brand-orange text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          ) : null}

          {selected ? (
            <div className="space-y-5">
              {/* Eigentümer & Miteigentumsanteile */}
              <Card title="Eigentümer & Stimmanteile">
                <p className="mb-3 text-xs text-gray-400">
                  Stimmprinzip: {votingPrincipleLabels[selected.votingPrinciple] ?? selected.votingPrinciple}
                </p>
                {owners.length === 0 ? (
                  <EmptyState>Diesem Objekt sind noch keine Eigentümer zugeordnet.</EmptyState>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                          <th className="px-3 py-2">Eigentümer</th>
                          <th className="px-3 py-2">MEA</th>
                          <th className="px-3 py-2">Anteil</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {owners.map((o) => {
                          const share =
                            totalMea > 0 && o.mea != null
                              ? `${((o.mea / totalMea) * 100).toLocaleString("de-DE", {
                                  maximumFractionDigits: 2,
                                })} %`
                              : "—";
                          return (
                            <tr key={o.id}>
                              <td className="px-3 py-2 text-gray-800">
                                <span className="flex flex-wrap items-center gap-2">
                                  {o.user.name}
                                  {o.isBoardMember ? (
                                    <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-xs font-medium text-brand-green">
                                      Beirat
                                    </span>
                                  ) : null}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600">{o.mea ?? "—"}</td>
                              <td className="px-3 py-2 text-gray-600">{share}</td>
                            </tr>
                          );
                        })}
                        <tr className="border-t border-gray-200">
                          <td className="px-3 py-2 font-medium text-gray-700">Summe</td>
                          <td className="px-3 py-2 font-medium text-gray-700" colSpan={2}>
                            {totalMea} MEA
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Verwaltungsbeirat */}
              <Card title="Verwaltungsbeirat">
                {boardMembers.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Für diese Gemeinschaft ist derzeit kein Verwaltungsbeirat benannt.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {boardMembers.map((o) => (
                      <li
                        key={o.id}
                        className="rounded-full bg-brand-green/10 px-3 py-1 text-sm font-medium text-brand-green"
                      >
                        {o.user.name}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* Beschluss-Sammlung */}
              <Card title="Beschluss-Sammlung">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/beschluesse/sammlung?objekt=${selected.id}`}
                    className={buttonSecondaryClass}
                  >
                    Vollständige Sammlung öffnen
                  </Link>
                  <a
                    href={`/beschluesse/sammlung/export?objekt=${selected.id}`}
                    className={buttonSecondaryClass}
                  >
                    Als PDF exportieren
                  </a>
                </div>
                {resolutions.length === 0 ? (
                  <EmptyState>Für dieses Objekt wurden noch keine Beschlüsse gefasst.</EmptyState>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {resolutions.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="text-sm text-gray-900">
                          {r.number != null ? `Nr. ${r.number} · ` : ""}
                          {r.title}
                          {r.decidedAt ? (
                            <span className="ml-1 text-xs text-gray-400">
                              ({formatDate(r.decidedAt)})
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[r.status] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {resolutionStatusLabels[r.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <Pagination
                  currentPage={bPage}
                  totalPages={Math.max(1, Math.ceil(resolutionTotal / LIST_PAGE_SIZE))}
                  total={resolutionTotal}
                  itemLabel="Beschlüsse"
                  hrefFor={(p) => hrefWith("bseite", p)}
                />
              </Card>

              {/* Dokumente & Protokolle */}
              <Card title="Dokumente & Protokolle">
                {documents.length === 0 ? (
                  <EmptyState>Für die Gemeinschaft sind noch keine Dokumente hinterlegt.</EmptyState>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {documents.map((doc) => (
                      <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900">
                            {doc.title}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {documentCategoryLabels[doc.category]} · {formatDate(doc.createdAt)} ·{" "}
                            {formatBytes(doc.size)}
                          </span>
                        </span>
                        <a
                          href={`/api/files/dokument/${doc.id}`}
                          target="_blank"
                          className="shrink-0 text-sm text-brand-green hover:underline"
                        >
                          Öffnen →
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                <Pagination
                  currentPage={dPage}
                  totalPages={Math.max(1, Math.ceil(documentTotal / LIST_PAGE_SIZE))}
                  total={documentTotal}
                  itemLabel="Dokumente"
                  hrefFor={(p) => hrefWith("dseite", p)}
                />

                <p className="mt-3 text-xs text-gray-400">
                  Alle für Eigentümer freigegebenen Unterlagen finden Sie unter{" "}
                  <Link href="/infos?t=dokumente" className="underline">
                    Infos → Dokumente
                  </Link>
                  .
                </p>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
