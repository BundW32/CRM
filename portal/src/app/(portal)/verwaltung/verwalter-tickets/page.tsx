import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircleQuestion } from "lucide-react";
import { Badge, DataTable, type Column } from "@/components/data-display";
import { Alert, Card, EmptyState, PageTitle, buttonClass } from "@/components/ui";
import { verwalterAnfrageWhereForVerwalter } from "@/lib/access";
import { hatPlanFunktion, planLabel } from "@/lib/billing";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { ANFRAGE_STATUS } from "./status";

export const dynamic = "force-dynamic";

type Zeile = {
  id: string;
  number: number;
  title: string;
  status: keyof typeof ANFRAGE_STATUS;
  updatedAt: Date;
  antworten: number;
};

export default async function VerwalterTicketsPage() {
  const verwalter = await requireVerwalter();
  const org = await getOrganization();
  if (!org) redirect("/verwaltung");

  const darfSenden = hatPlanFunktion(org, "verwalterTicket");

  // Die Liste sieht auch, wer den Tarif nicht (mehr) hat: Bereits beantwortete
  // Anfragen sind bezahlte Leistung und bleiben lesbar. Nur NEUE Nachrichten
  // hängen am Verwalter-Plus-Tarif (serverseitig in den Actions gesperrt).
  const anfragen = await db.verwalterAnfrage.findMany({
    where: verwalterAnfrageWhereForVerwalter(verwalter),
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      updatedAt: true,
      _count: { select: { nachrichten: { where: { vomBetreiber: true } } } },
    },
  });

  const zeilen: Zeile[] = anfragen.map((a) => ({
    id: a.id,
    number: a.number,
    title: a.title,
    status: a.status,
    updatedAt: a.updatedAt,
    antworten: a._count.nachrichten,
  }));

  const spalten: Column<Zeile>[] = [
    {
      header: "Anfrage",
      cell: (z) => (
        <Link
          href={`/verwaltung/verwalter-tickets/${z.id}`}
          className="font-medium text-gray-900 hover:text-brand-orange"
        >
          {z.title}
        </Link>
      ),
    },
    {
      header: "Status",
      cell: (z) => <Badge tone={ANFRAGE_STATUS[z.status].tone}>{ANFRAGE_STATUS[z.status].label}</Badge>,
      className: "w-px whitespace-nowrap",
    },
    {
      header: "Antworten",
      cell: (z) => z.antworten,
      align: "right",
      className: "w-px",
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
          darfSenden ? (
            <Link href="/verwaltung/verwalter-tickets/neu" className={buttonClass}>
              Neue Anfrage
            </Link>
          ) : undefined
        }
      >
        Verwalter-Tickets
      </PageTitle>

      <p className="mb-4 max-w-3xl text-sm text-gray-600">
        Ihr direkter Draht zu einem zertifizierten Verwalter (§ 26a WEG): Stellen Sie
        die Fragen Ihrer Gemeinschaft — Abrechnung, Beschlussformulierungen,
        schwierige Einzelfälle. Die Antwort erscheint hier im Portal und bleibt
        dokumentiert.
      </p>

      {!darfSenden ? (
        <Alert variant="info" className="mb-4">
          Das Ticket-System gehört zum <strong>Verwalter-Plus</strong>-Tarif
          {planLabel(org.plan) !== "Verwalter-Plus" ? (
            <> — Ihre Gemeinschaft nutzt derzeit {planLabel(org.plan)}</>
          ) : null}
          .{" "}
          {verwalter.isSuperAdmin ? (
            <>
              Den Wechsel finden Sie unter{" "}
              <Link href="/verwaltung/abrechnung" className="font-semibold underline">
                Einstellungen → Abrechnung
              </Link>
              .
            </>
          ) : (
            <>Den Wechsel kann ein Administrator Ihrer Gemeinschaft vornehmen.</>
          )}{" "}
          Bereits gestellte Anfragen und ihre Antworten bleiben lesbar.
        </Alert>
      ) : null}

      <Card>
        <DataTable
          columns={spalten}
          rows={zeilen}
          getKey={(z) => z.id}
          caption="Anfragen an den zertifizierten Verwalter"
          empty={
            <EmptyState
              icon={<MessageCircleQuestion className="h-5 w-5" />}
              action={
                darfSenden ? (
                  <Link href="/verwaltung/verwalter-tickets/neu" className={buttonClass}>
                    Erste Anfrage stellen
                  </Link>
                ) : undefined
              }
            >
              Noch keine Anfragen. {darfSenden ? "Stellen Sie die erste Frage — die Antwort kommt von einem zertifizierten Verwalter." : ""}
            </EmptyState>
          }
        />
      </Card>
    </>
  );
}
