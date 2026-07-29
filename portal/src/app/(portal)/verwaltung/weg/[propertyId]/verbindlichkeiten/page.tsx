import Link from "next/link";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Badge, DataTable, KeyFigure, KeyFigures, type Column } from "@/components/data-display";
import { PendingButton } from "@/components/pending-button";
import { Tipp } from "@/components/tipp";
import { Alert, Card, EmptyState, PageTitle, buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateOnly } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { requireWegProperty } from "@/lib/weg/scope";
import { offenAmStichtag } from "@/lib/weg/vermoegensbericht";
import { deleteVerbindlichkeit, toggleBeglichen } from "./actions";

export const dynamic = "force-dynamic";

const FEHLER: Record<string, string> = {
  nichtgefunden: "Der Eintrag wurde nicht gefunden.",
};

const ART_LABEL = {
  RECHNUNG: "Offene Rechnung",
  DARLEHEN: "Darlehen",
  SONSTIGE: "Sonstige",
} as const;

type Zeile = {
  id: string;
  title: string;
  kind: keyof typeof ART_LABEL;
  creditor: string | null;
  amountCents: number;
  incurredOn: Date;
  dueDate: Date | null;
  settledAt: Date | null;
  note: string | null;
};

export default async function VerbindlichkeitenPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const alle = (await db.verbindlichkeit.findMany({
    where: { propertyId: property.id },
    // `nulls: "first"`, weil offene Verbindlichkeiten `settledAt = null` haben und
    // NULL in Postgres bei ASC sonst ans Ende rutscht — dann stehen die
    // erledigten oben und das, was noch zu tun ist, unten.
    orderBy: [{ settledAt: { sort: "asc", nulls: "first" } }, { amountCents: "desc" }],
    select: {
      id: true,
      title: true,
      kind: true,
      creditor: true,
      amountCents: true,
      incurredOn: true,
      dueDate: true,
      settledAt: true,
      note: true,
    },
  })) as Zeile[];

  const heute = new Date();
  const offen = alle.filter((v) => offenAmStichtag(v, heute));
  const offenCents = offen.reduce((s, v) => s + v.amountCents, 0);
  const ueberfaellig = offen.filter((v) => v.dueDate && v.dueDate < heute);

  const spalten: Column<Zeile>[] = [
    {
      header: "Bezeichnung",
      cell: (v) => (
        <div>
          <Link
            href={`/verwaltung/weg/${property.id}/verbindlichkeiten/neu?id=${v.id}`}
            className="font-medium text-gray-900 underline-offset-2 hover:underline"
          >
            {v.title}
          </Link>
          <div className="text-xs text-gray-500">
            {ART_LABEL[v.kind]}
            {v.creditor ? ` · ${v.creditor}` : ""}
          </div>
          {v.note ? <div className="mt-0.5 text-xs text-gray-400">{v.note}</div> : null}
        </div>
      ),
    },
    { header: "Betrag", align: "right", cell: (v) => formatCents(v.amountCents) },
    { header: "Entstanden", cell: (v) => formatDateOnly(v.incurredOn) },
    {
      header: "Fällig",
      cell: (v) =>
        v.dueDate ? (
          <span className={!v.settledAt && v.dueDate < heute ? "font-semibold text-red-700" : ""}>
            {formatDateOnly(v.dueDate)}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      header: "Status",
      cell: (v) =>
        v.settledAt ? (
          <Badge tone="success">beglichen {formatDateOnly(v.settledAt)}</Badge>
        ) : (
          <Badge tone="warning">offen</Badge>
        ),
    },
    {
      align: "right",
      className: "w-px whitespace-nowrap",
      cell: (v) => (
        <div className="flex items-center justify-end gap-2">
          <form action={toggleBeglichen}>
            <input type="hidden" name="propertyId" value={property.id} />
            <input type="hidden" name="id" value={v.id} />
            <PendingButton className="text-xs underline" pendingLabel="…">
              {v.settledAt ? "wieder offen" : "beglichen"}
            </PendingButton>
          </form>
          <form action={deleteVerbindlichkeit}>
            <input type="hidden" name="propertyId" value={property.id} />
            <input type="hidden" name="id" value={v.id} />
            <ConfirmActionButton
              className="text-xs text-red-600 hover:underline"
              confirmLabel="Wirklich löschen?"
              pendingLabel="Wird gelöscht…"
            >
              löschen
            </ConfirmActionButton>
          </form>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageTitle
        action={
          <Link
            href={`/verwaltung/weg/${property.id}/verbindlichkeiten/neu`}
            className={buttonClass}
          >
            Verbindlichkeit erfassen
          </Link>
        }
      >
        Verbindlichkeiten — {property.name}
      </PageTitle>

      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {FEHLER[sp.fehler] ?? "Die Eingabe konnte nicht verarbeitet werden."}
        </Alert>
      ) : null}

      <KeyFigures>
        <KeyFigure
          label="Offen heute"
          value={formatCents(offenCents)}
          tone={offenCents > 0 ? "warn" : "neutral"}
        />
        <KeyFigure label="Einträge offen" value={String(offen.length)} />
        <KeyFigure
          label="Davon überfällig"
          value={String(ueberfaellig.length)}
          tone={ueberfaellig.length > 0 ? "critical" : "neutral"}
        />
      </KeyFigures>

      <div className="mt-6">
      <Card title="Alle Verbindlichkeiten">
        <DataTable
          columns={spalten}
          rows={alle}
          getKey={(v) => v.id}
          minWidth="52rem"
          caption="Verbindlichkeiten der Gemeinschaft"
          empty={
            <EmptyState>
              Noch nichts erfasst. Wenn die Gemeinschaft nichts schuldet, ist das richtig so —
              der Vermögensbericht weist dann ausdrücklich keine Verbindlichkeiten aus.
            </EmptyState>
          }
        />
        <Tipp className="mt-4">
          Hier gehört alles hinein, was die Gemeinschaft am Jahresende noch schuldet und was
          nicht schon vom Konto abgegangen ist: die Handwerkerrechnung, die im Dezember kam
          und im Januar bezahlt wurde, ein Darlehen, eine Nachzahlung an den Versorger. Der
          Vermögensbericht (§ 28 Abs. 4 WEG) zieht sie von Rücklage, Kontoständen und
          Forderungen ab. Ohne sie sieht die Gemeinschaft reicher aus, als sie ist — und
          genau danach wird über Sonderumlagen entschieden.
        </Tipp>
      </Card>
      </div>
    </>
  );
}
