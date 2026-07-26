import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { Alert, Card, EmptyState, Field, PageTitle, Pagination, buttonClass, inputClass } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ownedProperties, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, parsePage } from "@/lib/list-query";
import { requireUser } from "@/lib/session";
import { createMeeting } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const statusTone: Record<string, string> = {
  GEPLANT: "bg-blue-100 text-blue-800",
  EINBERUFEN: "bg-amber-100 text-amber-800",
  DURCHGEFUEHRT: "bg-green-100 text-green-800",
  ABGESAGT: "bg-gray-200 text-gray-700",
};
const statusLabel: Record<string, string> = {
  GEPLANT: "Geplant",
  EINBERUFEN: "Einberufen",
  DURCHGEFUEHRT: "Durchgeführt",
  ABGESAGT: "Abgesagt",
};

export default async function VersammlungenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (user.role !== "VERWALTER" && user.role !== "EIGENTUEMER") redirect("/dashboard");
  const sp = await searchParams;
  const { fehler } = sp;
  const isVerwalter = user.role === "VERWALTER";
  const currentPage = parsePage(sp.page);

  // Zugängliche WEG-Objekte.
  let propWhere;
  if (isVerwalter) {
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
  const propIds = properties.map((p) => p.id);

  // Versammlungen sammeln sich über die Jahre – paginiert statt vollständig.
  const scope = await propertyScopeFilters(user, sp, { withUnit: false });
  const q = normalizeSearch(sp.q);

  const meetingAnd: Prisma.OwnersMeetingWhereInput[] = [{ propertyId: { in: propIds } }];
  if (q) {
    meetingAnd.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (scope.objektId) meetingAnd.push({ propertyId: scope.objektId });
  const meetingWhere: Prisma.OwnersMeetingWhereInput = { AND: meetingAnd };
  const hasFilter = Boolean(q || scope.active);

  const [meetings, meetingTotal] = await Promise.all([
    db.ownersMeeting.findMany({
      where: meetingWhere,
      orderBy: { scheduledAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { property: { select: { name: true } }, _count: { select: { agendaItems: true } } },
    }),
    db.ownersMeeting.count({ where: meetingWhere }),
  ]);

  // Paginierung muss alle aktiven Filter mittragen.
  function pageHref(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/versammlungen${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <PageTitle>Eigentümerversammlungen</PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "keinweg"
            ? "Versammlungen sind nur für WEG-Objekte möglich."
            : "Bitte Objekt, Titel und Termin ausfüllen."}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <FilterBar
            className="mb-3"
            searchPlaceholder="Suchen"
            searchHint="Nach Titel oder Ort suchen"
            comboboxes={scope.comboboxes}
          />
          <p className="mb-2 px-1 text-xs text-gray-400">
            {meetingTotal} {meetingTotal === 1 ? "Versammlung" : "Versammlungen"}
            {hasFilter ? " (gefiltert)" : ""}
          </p>

          {meetings.length === 0 ? (
            <EmptyState>
              {hasFilter ? "Keine Versammlungen gefunden." : "Noch keine Versammlungen angelegt."}
            </EmptyState>
          ) : (
            meetings.map((m) => (
              <Link
                key={m.id}
                href={`/versammlungen/${m.id}`}
                className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{m.title}</h3>
                    <p className="text-xs text-gray-500">
                      {m.property.name} · {formatDate(m.scheduledAt)} · {m._count.agendaItems} TOP
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[m.status]}`}>
                    {statusLabel[m.status]}
                  </span>
                </div>
              </Link>
            ))
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(1, Math.ceil(meetingTotal / PAGE_SIZE))}
            total={meetingTotal}
            itemLabel="Versammlungen"
            hrefFor={pageHref}
          />
        </div>

        {isVerwalter ? (
          <Card title="Versammlung anlegen">
            {properties.length === 0 ? (
              <p className="text-sm text-gray-500">
                Keine WEG-Objekte vorhanden. Legen Sie ein Objekt mit Verwaltungsart WEG an.
              </p>
            ) : (
              <form action={createMeeting} className="space-y-3">
                <Field label="Objekt (WEG)">
                  <select name="propertyId" required className={inputClass}>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Titel">
                  <input
                    type="text"
                    name="title"
                    required
                    minLength={3}
                    placeholder="z. B. Ordentliche Eigentümerversammlung 2026"
                    className={inputClass}
                  />
                </Field>
                <Field label="Termin">
                  <input type="datetime-local" name="scheduledAt" required className={inputClass} />
                </Field>
                <Field label="Ort">
                  <input
                    type="text"
                    name="location"
                    required
                    placeholder="z. B. Gemeindesaal, Musterstr. 1 – oder Online / Videokonferenz"
                    className={inputClass}
                  />
                </Field>
                <Field label="Link zur Video-Zuschaltung (optional)">
                  <input
                    type="text"
                    name="videoLink"
                    placeholder="leer = Standard-Link des Objekts (falls hinterlegt)"
                    className={inputClass}
                  />
                </Field>
                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input type="checkbox" name="saveVideoDefault" className="mt-0.5" />
                  <span>
                    Eingegebenen Link als Standard für dieses Objekt speichern (wird bei
                    künftigen Versammlungen vorbelegt).
                  </span>
                </label>
                <button type="submit" className={buttonClass}>
                  Versammlung anlegen
                </button>
              </form>
            )}
          </Card>
        ) : (
          <Card title="Hinweis">
            <p className="text-sm text-gray-600">
              Hier sehen Sie die Einladungen, Tagesordnungen und Protokolle der Versammlungen
              Ihrer Eigentümergemeinschaft.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
