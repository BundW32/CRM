import { notFound } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Badge, stackTight } from "@/components/data-display";
import { Alert, Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { verwalterAnfrageWhereForVerwalter } from "@/lib/access";
import { hatPlanFunktion } from "@/lib/billing";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { anfrageSchliessen, rueckfrageSenden } from "../actions";
import { ANFRAGE_STATUS } from "../status";

export const dynamic = "force-dynamic";

export default async function AnfrageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string }>;
}) {
  const verwalter = await requireVerwalter();
  const org = await getOrganization();
  const { id } = await params;
  const { fehler } = await searchParams;

  // findFirst mit dem Access-Filter, nie findUnique auf die rohe Id — sonst
  // wäre die Id anderer Mandanten nur einen geratenen Link entfernt.
  const anfrage = await db.verwalterAnfrage.findFirst({
    where: { id, ...verwalterAnfrageWhereForVerwalter(verwalter) },
    include: {
      nachrichten: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!anfrage || !org) notFound();

  const darfSenden = hatPlanFunktion(org, "verwalterTicket");
  const status = ANFRAGE_STATUS[anfrage.status];
  const offenFuerNachrichten = anfrage.status !== "GESCHLOSSEN";

  return (
    <>
      <PageTitle back={{ href: "/verwaltung/verwalter-tickets", label: "Verwalter-Tickets" }}>
        {anfrage.title}
      </PageTitle>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span>Anfrage #{anfrage.number}</span>
        <span>gestellt am {formatDate(anfrage.createdAt)}</span>
      </div>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          Bitte geben Sie eine Nachricht ein.
        </Alert>
      ) : null}

      <div className="max-w-3xl space-y-3">
        {anfrage.nachrichten.map((n) => (
          <Card key={n.id}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                {n.vomBetreiber ? (
                  <>
                    <Badge tone="accent">Zertifizierter Verwalter</Badge>
                    {n.author ? <span>{n.author.name}</span> : null}
                  </>
                ) : (
                  (n.author?.name ?? "Ihre Gemeinschaft")
                )}
              </span>
              <span className="text-xs text-gray-400">{formatDate(n.createdAt)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap text-gray-700">{n.body}</p>
          </Card>
        ))}

        {offenFuerNachrichten && darfSenden ? (
          <Card>
            <form action={rueckfrageSenden} className={stackTight}>
              <input type="hidden" name="anfrageId" value={anfrage.id} />
              <Field label={anfrage.status === "BEANTWORTET" ? "Rückfrage" : "Ergänzung"}>
                <textarea name="body" required minLength={2} rows={5} className={inputClass} />
              </Field>
              <div className="flex flex-wrap items-center gap-4">
                <PendingButton className={buttonClass}>Senden</PendingButton>
              </div>
            </form>
          </Card>
        ) : null}

        {!darfSenden && offenFuerNachrichten ? (
          <Alert variant="info">
            Neue Nachrichten setzen den Verwalter-Plus-Tarif voraus. Der bisherige
            Verlauf bleibt für Ihre Gemeinschaft lesbar.
          </Alert>
        ) : null}

        {offenFuerNachrichten ? (
          <form action={anfrageSchliessen}>
            <input type="hidden" name="anfrageId" value={anfrage.id} />
            <ConfirmActionButton
              className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
              confirmLabel="Anfrage wirklich schließen?"
            >
              Anfrage schließen
            </ConfirmActionButton>
          </form>
        ) : null}
      </div>
    </>
  );
}
