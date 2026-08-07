import { notFound } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Badge, stackTight } from "@/components/data-display";
import { Alert, Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { requirePlatformAdmin } from "@/lib/platform";
import { ANFRAGE_STATUS } from "@/app/(portal)/verwaltung/verwalter-tickets/status";
import { anfrageSchliessenPlattform, antwortSenden } from "../actions";

export const dynamic = "force-dynamic";

export default async function PlattformAnfrageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const { fehler } = await searchParams;

  const anfrage = await db.verwalterAnfrage.findUnique({
    where: { id },
    include: {
      organization: { select: { name: true, slug: true } },
      createdBy: { select: { name: true, email: true } },
      nachrichten: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!anfrage) notFound();

  const status = ANFRAGE_STATUS[anfrage.status];

  return (
    <>
      <PageTitle back={{ href: "/plattform/anfragen", label: "Verwalter-Anfragen" }}>
        {anfrage.title}
      </PageTitle>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span>#{anfrage.number}</span>
        <span className="font-medium text-gray-700">{anfrage.organization.name}</span>
        <span>
          gestellt von {anfrage.createdBy.name} ({anfrage.createdBy.email}) am{" "}
          {formatDate(anfrage.createdAt)}
        </span>
      </div>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          Bitte geben Sie eine Antwort ein.
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
                  <span>
                    {n.author?.name ?? "Gemeinschaft"} · {anfrage.organization.name}
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-400">{formatDate(n.createdAt)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap text-gray-700">{n.body}</p>
          </Card>
        ))}

        {anfrage.status !== "GESCHLOSSEN" ? (
          <Card title="Antwort des zertifizierten Verwalters">
            <form action={antwortSenden} className={stackTight}>
              <input type="hidden" name="anfrageId" value={anfrage.id} />
              <Field label="Antwort">
                <textarea name="body" required minLength={2} rows={8} className={inputClass} />
              </Field>
              <PendingButton className={buttonClass}>Antwort senden</PendingButton>
            </form>
          </Card>
        ) : null}

        {anfrage.status !== "GESCHLOSSEN" ? (
          <form action={anfrageSchliessenPlattform}>
            <input type="hidden" name="anfrageId" value={anfrage.id} />
            <ConfirmActionButton
              className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
              confirmLabel="Anfrage wirklich schließen?"
            >
              Ohne weitere Antwort schließen
            </ConfirmActionButton>
          </form>
        ) : null}
      </div>
    </>
  );
}
