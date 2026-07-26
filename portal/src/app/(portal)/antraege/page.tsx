import { redirect } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import type { Prisma } from "@/generated/prisma/client";
import { Alert,
  Card,
  EmptyState,
  Field,
  PageTitle,
  Pagination,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ownedProperties, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { normalizeSearch, parsePage } from "@/lib/list-query";
import { getOrganization, requireUser } from "@/lib/session";
import {
  adoptMotionAsResolution,
  adoptMotionToMeeting,
  rejectMotion,
  submitMotion,
} from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const typeLabels: Record<string, string> = {
  BESCHLUSSANTRAG: "Beschlussantrag",
  VERSAMMLUNG: "Außerordentliche Versammlung",
};

const statusLabels: Record<string, string> = {
  EINGEREICHT: "Eingereicht",
  UEBERNOMMEN: "Übernommen",
  ABGELEHNT: "Abgelehnt",
};

const statusTone: Record<string, string> = {
  EINGEREICHT: "bg-blue-100 text-blue-800",
  UEBERNOMMEN: "bg-green-100 text-green-800",
  ABGELEHNT: "bg-red-100 text-red-700",
};

const flashText: Record<string, string> = {
  eingereicht: "Antrag eingereicht. Die Verwaltung prüft ihn.",
  uebernommen: "Antrag übernommen.",
  abgelehnt: "Antrag abgelehnt – der Einreicher wurde informiert.",
};

const errorText: Record<string, string> = {
  eingabe: "Bitte Titel und Begründung vollständig ausfüllen.",
  keinweg: "Anträge sind nur für WEG-Objekte möglich.",
  versammlung: "Bitte eine planbare Versammlung dieses Objekts wählen.",
  typ: "Ein Verlangen einer Versammlung kann nicht als Umlaufbeschluss übernommen werden.",
};

export default async function AntraegePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const org = await getOrganization();
  // Anträge sind ein Selbstverwaltungs-Feature.
  if (org?.accountType !== "selbstverwalter") redirect("/dashboard");

  const sp = await searchParams;
  const flashKey = sp.eingereicht
    ? "eingereicht"
    : sp.uebernommen
      ? "uebernommen"
      : sp.abgelehnt
        ? "abgelehnt"
        : null;
  const flash = flashKey ? flashText[flashKey] : null;
  const error = sp.fehler ? errorText[sp.fehler] ?? null : null;

  // Eigene WEG-Objekte (für das Einreichen).
  const owned = await ownedProperties(user.id);
  const wegOwned = owned.filter((p) => p.managementType === "WEG");

  const isVerwalter = user.role === "VERWALTER";

  // Eigene Anträge (Status-Verlauf für den Eigentümer).
  // Eigene Anträge sammeln sich über die Jahre – paginiert und durchsuchbar.
  const currentPage = parsePage(sp.page);
  const q = normalizeSearch(sp.q);
  const myMotionWhere: Prisma.OwnerMotionWhereInput = {
    AND: [
      { submittedById: user.id },
      ...(q
        ? [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { description: { contains: q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };
  const [myMotions, myMotionTotal] = await Promise.all([
    db.ownerMotion.findMany({
      where: myMotionWhere,
      include: { property: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.ownerMotion.count({ where: myMotionWhere }),
  ]);

  // Paginierung muss die aktive Suche mittragen.
  function pageHref(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/antraege${qs ? `?${qs}` : ""}`;
  }

  // Review-Bereich für den internen Verwalter: offene Anträge im Scope.
  let reviewMotions: Awaited<ReturnType<typeof loadReview>>["motions"] = [];
  let meetingsByProperty = new Map<string, { id: string; title: string; scheduledAt: Date }[]>();
  if (isVerwalter) {
    const review = await loadReview(user);
    reviewMotions = review.motions;
    meetingsByProperty = review.meetingsByProperty;
  }

  return (
    <>
      <PageTitle>Anträge</PageTitle>

      {flash ? (
        <Alert variant="success" className="mb-4">{flash}</Alert>
      ) : null}
      {error ? (
        <Alert variant="error" className="mb-4">{error}</Alert>
      ) : null}

      {/* Review-Bereich (interner Verwalter) */}
      {isVerwalter ? (
        <Card title="Eingereichte Anträge">
          {reviewMotions.length === 0 ? (
            <p className="text-sm text-gray-500">Aktuell liegen keine offenen Anträge vor.</p>
          ) : (
            <ul className="space-y-4">
              {reviewMotions.map((m) => {
                const meetings = meetingsByProperty.get(m.propertyId) ?? [];
                return (
                  <li key={m.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {typeLabels[m.type] ?? m.type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {m.property.name} · {m.submittedBy.name} · {formatDate(m.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 font-medium text-gray-800">{m.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{m.description}</p>

                    <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:flex-wrap sm:items-end">
                      {/* Als Umlaufbeschluss übernehmen – nur für Beschlussanträge,
                          nicht für ein Versammlungs-Verlangen. */}
                      {m.type !== "VERSAMMLUNG" ? (
                        <form action={adoptMotionAsResolution}>
                          <input type="hidden" name="motionId" value={m.id} />
                          <PendingButton className={buttonSecondaryClass}>Als Umlaufbeschluss</PendingButton>
                        </form>
                      ) : null}

                      {/* Zu Versammlung hinzufügen */}
                      {meetings.length > 0 ? (
                        <form action={adoptMotionToMeeting} className="flex items-end gap-2">
                          <input type="hidden" name="motionId" value={m.id} />
                          <label className="text-xs text-gray-500">
                            Versammlung
                            <select name="meetingId" className={`${inputClass} mt-1 w-auto`}>
                              {meetings.map((mt) => (
                                <option key={mt.id} value={mt.id}>
                                  {mt.title} ({formatDate(mt.scheduledAt)})
                                </option>
                              ))}
                            </select>
                          </label>
                          <PendingButton className={buttonSecondaryClass}>Zu Versammlung</PendingButton>
                        </form>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Keine planbare Versammlung – zuerst unter Versammlungen anlegen.
                        </span>
                      )}

                      {/* Ablehnen */}
                      <form action={rejectMotion} className="flex items-end gap-2">
                        <input type="hidden" name="motionId" value={m.id} />
                        <label className="text-xs text-gray-500">
                          Begründung (optional)
                          <input
                            type="text"
                            name="note"
                            maxLength={2000}
                            placeholder="z. B. nicht zuständig"
                            className={`${inputClass} mt-1 w-56`}
                          />
                        </label>
                        <PendingButton className="text-sm text-red-600 hover:underline">Ablehnen</PendingButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {/* Antrag einreichen (Eigentümer mit WEG-Objekt) */}
      {wegOwned.length > 0 ? (
        <div className={isVerwalter ? "mt-6" : ""}>
          <Card title="Antrag einreichen">
            <form action={submitMotion} className="space-y-4">
              <Field label="Objekt">
                <select name="propertyId" className={inputClass} required>
                  {wegOwned.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Art des Antrags">
                <select name="type" className={inputClass} defaultValue="BESCHLUSSANTRAG">
                  <option value="BESCHLUSSANTRAG">Beschlussantrag</option>
                  <option value="VERSAMMLUNG">Außerordentliche Versammlung verlangen</option>
                </select>
              </Field>
              <Field label="Titel">
                <input
                  type="text"
                  name="title"
                  required
                  minLength={3}
                  maxLength={200}
                  className={inputClass}
                  placeholder="Kurzer Betreff"
                />
              </Field>
              <Field label="Begründung / Beschlusstext">
                <textarea
                  name="description"
                  required
                  minLength={3}
                  maxLength={5000}
                  rows={5}
                  className={inputClass}
                  placeholder="Worüber soll abgestimmt werden? Bei einer außerordentlichen Versammlung: Anlass und gewünschte Tagesordnung."
                />
              </Field>
              <p className="text-xs text-gray-400">
                Hinweis: Eine außerordentliche Versammlung muss einberufen werden, wenn mehr als ein
                Viertel der Eigentümer sie verlangt (§ 24 Abs. 2 WEG). Die Verwaltung prüft Ihren
                Antrag und übernimmt ihn als Umlaufbeschluss oder Tagesordnungspunkt.
              </p>
              <PendingButton className={buttonClass}>Antrag einreichen</PendingButton>
            </form>
          </Card>
        </div>
      ) : null}

      {/* Eigene Anträge */}
      <div className="mt-6">
        <Card title={`Meine Anträge (${myMotionTotal})`}>
          <FilterBar
            className="mb-3"
            searchPlaceholder="Suchen"
            searchHint="Nach Titel oder Antragstext suchen"
          />

          {myMotions.length === 0 ? (
            <EmptyState>
              {q ? "Keine Anträge gefunden." : "Sie haben noch keine Anträge eingereicht."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-gray-50">
              {myMotions.map((m) => (
                <li key={m.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${statusTone[m.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {statusLabels[m.status] ?? m.status}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {typeLabels[m.type] ?? m.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {m.property.name} · {formatDate(m.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-gray-800">{m.title}</p>
                  {m.status === "ABGELEHNT" && m.decisionNote ? (
                    <p className="mt-1 text-sm text-red-600">Begründung: {m.decisionNote}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(1, Math.ceil(myMotionTotal / PAGE_SIZE))}
            total={myMotionTotal}
            itemLabel="Anträge"
            hrefFor={pageHref}
          />
        </Card>
      </div>
    </>
  );
}

// Lädt die offenen Anträge im Scope des Verwalters plus die planbaren
// Versammlungen je Objekt (für das „Zu Versammlung"-Auswahlfeld).
async function loadReview(user: Parameters<typeof propertyWhereForVerwalter>[0]) {
  const propWhere = await propertyWhereForVerwalter(user);
  const props = await db.property.findMany({ where: propWhere, select: { id: true } });
  const ids = props.map((p) => p.id);

  const motions = await db.ownerMotion.findMany({
    where: {
      organizationId: user.organizationId,
      status: "EINGEREICHT",
      propertyId: { in: ids },
    },
    include: {
      property: { select: { name: true } },
      submittedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const meetings = await db.ownersMeeting.findMany({
    where: { propertyId: { in: ids }, status: { in: ["GEPLANT", "EINBERUFEN"] } },
    select: { id: true, title: true, propertyId: true, scheduledAt: true },
    orderBy: { scheduledAt: "asc" },
  });
  const meetingsByProperty = new Map<string, { id: string; title: string; scheduledAt: Date }[]>();
  for (const mt of meetings) {
    const list = meetingsByProperty.get(mt.propertyId) ?? [];
    list.push({ id: mt.id, title: mt.title, scheduledAt: mt.scheduledAt });
    meetingsByProperty.set(mt.propertyId, list);
  }

  return { motions, meetingsByProperty };
}
