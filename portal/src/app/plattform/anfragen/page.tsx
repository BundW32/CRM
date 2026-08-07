import Link from "next/link";
import { Badge, DataTable, type Column } from "@/components/data-display";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { requirePlatformAdmin } from "@/lib/platform";
import { ANFRAGE_STATUS } from "@/app/(portal)/verwaltung/verwalter-tickets/status";

export const dynamic = "force-dynamic";

type Zeile = {
  id: string;
  number: number;
  title: string;
  status: keyof typeof ANFRAGE_STATUS;
  updatedAt: Date;
  orgName: string;
};

// Anfragen ALLER Verwaltungen — das ist der Arbeitsvorrat des zertifizierten
// Verwalters und bewusst mandantenübergreifend (nur Betreiber).
export default async function PlattformAnfragenPage({
  searchParams,
}: {
  searchParams: Promise<{ alle?: string }>;
}) {
  await requirePlatformAdmin();
  const { alle } = await searchParams;
  const nurOffene = alle !== "1";

  const anfragen = await db.verwalterAnfrage.findMany({
    where: nurOffene ? { status: "OFFEN" } : undefined,
    orderBy: { updatedAt: "asc" }, // die älteste offene Frage zuerst — wer am längsten wartet, ist dran
    take: 200,
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      updatedAt: true,
      organization: { select: { name: true } },
    },
  });

  const zeilen: Zeile[] = anfragen.map((a) => ({
    id: a.id,
    number: a.number,
    title: a.title,
    status: a.status,
    updatedAt: a.updatedAt,
    orgName: a.organization.name,
  }));

  const spalten: Column<Zeile>[] = [
    {
      header: "Anfrage",
      cell: (z) => (
        <Link
          href={`/plattform/anfragen/${z.id}`}
          className="font-medium text-gray-900 hover:text-brand-green"
        >
          {z.title}
        </Link>
      ),
    },
    { header: "Gemeinschaft", cell: (z) => z.orgName },
    {
      header: "Status",
      cell: (z) => <Badge tone={ANFRAGE_STATUS[z.status].tone}>{ANFRAGE_STATUS[z.status].label}</Badge>,
      className: "w-px whitespace-nowrap",
    },
    {
      header: "Zuletzt",
      cell: (z) => formatDate(z.updatedAt),
      align: "right",
      className: "w-px whitespace-nowrap",
    },
    {
      header: "Nr.",
      cell: (z) => <span className="text-gray-400">#{z.number}</span>,
      align: "right",
      className: "w-px",
    },
  ];

  return (
    <>
      <PageTitle
        action={
          <Link
            href={nurOffene ? "/plattform/anfragen?alle=1" : "/plattform/anfragen"}
            className="text-sm font-medium text-brand-green hover:underline"
          >
            {nurOffene ? "Alle anzeigen" : "Nur offene anzeigen"}
          </Link>
        }
      >
        Verwalter-Anfragen
      </PageTitle>

      <p className="mb-4 max-w-3xl text-sm text-gray-600">
        Fragen der Verwalter-Plus-Gemeinschaften an den zertifizierten Verwalter
        (§ 26a WEG). Antworten erscheinen im Portal der jeweiligen Gemeinschaft.
      </p>

      <Card>
        <DataTable
          columns={spalten}
          rows={zeilen}
          getKey={(z) => z.id}
          caption="Verwalter-Anfragen aller Gemeinschaften"
          empty={
            <EmptyState>
              {nurOffene ? "Keine offenen Anfragen — alles beantwortet." : "Noch keine Anfragen."}
            </EmptyState>
          }
        />
      </Card>
    </>
  );
}
