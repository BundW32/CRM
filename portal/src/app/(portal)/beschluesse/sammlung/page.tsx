import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, PageTitle, buttonSecondaryClass } from "@/components/ui";
import { ownedProperties, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, resolutionStatusLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const statusTone: Record<string, string> = {
  ANGENOMMEN: "bg-green-100 text-green-800",
  ABGELEHNT: "bg-red-100 text-red-700",
  ZURUECKGEZOGEN: "bg-gray-200 text-gray-700",
};

export default async function BeschlussSammlungPage({
  searchParams,
}: {
  searchParams: Promise<{ objekt?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "VERWALTER" && user.role !== "EIGENTUEMER") redirect("/dashboard");
  const { objekt } = await searchParams;

  // Zugängliche WEG-Objekte (Verwalter: Scope; Eigentümer: eigene).
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
    select: { id: true, name: true },
  });

  const selected = properties.find((p) => p.id === objekt) ?? properties[0] ?? null;

  const resolutions = selected
    ? await db.resolution.findMany({
        where: { propertyId: selected.id, status: { in: ["ANGENOMMEN", "ABGELEHNT"] } },
        orderBy: [{ number: "asc" }, { decidedAt: "asc" }],
        include: { votes: { select: { choice: true } } },
      })
    : [];

  return (
    <>
      <PageTitle
        action={
          <Link href="/beschluesse" className={buttonSecondaryClass}>
            ← Beschlüsse
          </Link>
        }
      >
        Beschluss-Sammlung
      </PageTitle>

      {properties.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">Keine WEG-Objekte vorhanden.</p>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/beschluesse/sammlung?objekt=${p.id}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  selected?.id === p.id
                    ? "border-brand-orange bg-brand-orange text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {p.name}
              </Link>
            ))}
            {selected ? (
              <a
                href={`/beschluesse/sammlung/export?objekt=${selected.id}`}
                className={`${buttonSecondaryClass} ml-auto`}
              >
                Als PDF exportieren
              </a>
            ) : null}
          </div>

          <Card title={selected?.name}>
            {resolutions.length === 0 ? (
              <EmptyState>Für dieses Objekt wurden noch keine Beschlüsse gefasst.</EmptyState>
            ) : (
              <ul className="divide-y divide-gray-100">
                {resolutions.map((r) => {
                  const ja = r.votes.filter((v) => v.choice === "JA").length;
                  const nein = r.votes.filter((v) => v.choice === "NEIN").length;
                  const enth = r.votes.filter((v) => v.choice === "ENTHALTUNG").length;
                  return (
                    <li key={r.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {r.number != null ? `Nr. ${r.number} · ` : ""}
                          {r.title}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[r.status] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {resolutionStatusLabels[r.status]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {r.decidedAt ? `entschieden am ${formatDate(r.decidedAt)}` : ""} · Ja {ja} ·
                        Nein {nein} · Enthaltung {enth}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
