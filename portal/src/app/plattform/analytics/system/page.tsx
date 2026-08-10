import { Suspense } from "react";
import { Badge, type BadgeTone, DataTable } from "@/components/data-display";
import { PendingButton } from "@/components/pending-button";
import {
  Card,
  EmptyState,
  buttonCompact,
  buttonSecondaryClass,
  cardSurfaceClass,
} from "@/components/ui";
import { ingestQuellen } from "@/lib/analytics/ingest";
import { parseZeitraum } from "@/lib/analytics/zeitraum";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform";
import { AnalyticsShell } from "../analytics-shell";
import { resyncAction } from "./actions";

export const dynamic = "force-dynamic";

const ZEIT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

function statusBadge(status: string) {
  const tone: BadgeTone =
    status === "ok"
      ? "success"
      : status === "partial"
        ? "warning"
        : status === "laeuft"
          ? "info"
          : "danger";
  const label =
    status === "ok"
      ? "OK"
      : status === "partial"
        ? "Teilweise"
        : status === "laeuft"
          ? "Läuft"
          : "Fehler";
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

function dauerSekunden(startedAt: Date, finishedAt: Date | null): string {
  if (!finishedAt) return "–";
  return `${Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)} s`;
}

type Lauf = {
  id: string;
  source: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  rowsWritten: number;
  message: string | null;
};

// Stand je Quelle: Zeitplan, letzter Lauf, Re-Sync-Knopf. Für Quellen ohne
// Runner steht statt des Knopfs der Hinweis, wann die Anbindung kommt —
// ein Knopf, der immer scheitert, wäre nur ein schlechteres Etikett.
function QuellenTabelle({ letzteJeQuelle }: { letzteJeQuelle: Map<string, Lauf> }) {
  return (
    <DataTable
      caption="Datenquellen des Analytics-Dashboards mit Stand des letzten Ingest-Laufs"
      rows={ingestQuellen}
      getKey={(q) => q.key}
      minWidth="42rem"
      columns={[
        { header: "Quelle", cell: (q) => <span className="font-medium text-gray-900">{q.label}</span> },
        { header: "Zeitplan", cell: (q) => q.zeitplan },
        {
          header: "Letzter Lauf",
          cell: (q) => {
            const l = letzteJeQuelle.get(q.key);
            if (!l) return <span className="text-gray-400">noch nie</span>;
            return (
              <span className="flex items-center gap-2">
                {statusBadge(l.status)}
                <span>{ZEIT.format(l.startedAt)}</span>
                <span className="text-gray-400">· {l.rowsWritten} Zeilen</span>
              </span>
            );
          },
        },
        {
          header: "",
          align: "right",
          className: "w-px",
          cell: (q) =>
            q.runner ? (
              <form action={resyncAction}>
                <input type="hidden" name="quelle" value={q.key} />
                <PendingButton
                  className={`${buttonSecondaryClass} ${buttonCompact}`}
                  pendingLabel="Läuft …"
                >
                  Re-Sync
                </PendingButton>
              </form>
            ) : (
              <span className="text-xs text-gray-400">{q.folgt}</span>
            ),
        },
      ]}
    />
  );
}

async function IngestProtokoll() {
  const laeufe = await db.ingestRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  const letzteJeQuelle = new Map<string, Lauf>();
  for (const l of laeufe) {
    if (!letzteJeQuelle.has(l.source)) letzteJeQuelle.set(l.source, l);
  }

  return (
    <div className="space-y-5">
      <Card title="Datenquellen">
        <QuellenTabelle letzteJeQuelle={letzteJeQuelle} />
      </Card>

      <Card title="Protokoll der letzten Läufe">
        <DataTable
          caption="Die letzten 50 Ingest-Läufe aller Quellen"
          rows={laeufe}
          getKey={(l) => l.id}
          minWidth="44rem"
          empty={
            <EmptyState>
              Noch keine Ingest-Läufe. Sobald die ersten Quellen angebunden
              sind (Phase 2–4), erscheint hier jeder Lauf mit Status,
              Zeilenzahl und Dauer.
            </EmptyState>
          }
          columns={[
            { header: "Quelle", cell: (l) => <span className="font-medium text-gray-900">{l.source}</span> },
            { header: "Gestartet", cell: (l) => ZEIT.format(l.startedAt) },
            { header: "Dauer", align: "right", cell: (l) => dauerSekunden(l.startedAt, l.finishedAt) },
            { header: "Status", cell: (l) => statusBadge(l.status) },
            { header: "Zeilen", align: "right", cell: (l) => l.rowsWritten },
            {
              header: "Meldung",
              cell: (l) => (l.message ? <span className="text-gray-500">{l.message}</span> : "–"),
            },
          ]}
        />
      </Card>
    </div>
  );
}

function ProtokollSkeleton() {
  return (
    <div className="space-y-5">
      {[0, 1].map((i) => (
        <div key={i} className={`space-y-3 p-5 ${cardSurfaceClass}`}>
          <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
          {[...Array(4)].map((_, j) => (
            <div key={j} className="h-3.5 w-full animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default async function AnalyticsSystemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin();
  const zeitraum = parseZeitraum(await searchParams);

  return (
    <AnalyticsShell
      titel="System"
      pfad="/plattform/analytics/system"
      zeitraum={zeitraum}
      ohneZeitraumFilter
    >
      <Suspense fallback={<ProtokollSkeleton />}>
        <IngestProtokoll />
      </Suspense>
    </AnalyticsShell>
  );
}
