import type { Prisma } from "@/generated/prisma/client";
import {
  Pagination,
  Alert,
  Card,
  EmptyState,
  Field,
  PageTitle,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { announcementWhereForUser, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { audienceLabels, formatDate } from "@/lib/labels";
import { optionsFrom, propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, parsePage, pageHrefFor } from "@/lib/list-query";
import { requireUser } from "@/lib/session";
import { acknowledgeAnnouncement, createAnnouncement, deleteAnnouncement } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AushaengePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const { fehler } = sp;
  const isVerwalter = user.role === "VERWALTER";
  const currentPage = parsePage(sp.page);

  // ── Filter: Suche, Objekt, Sichtbarkeit (nur Verwalter) ──
  const scope = await propertyScopeFilters(user, sp, { withUnit: false });
  const q = normalizeSearch(sp.q);
  const sicht = isVerwalter && sp.sicht && sp.sicht in audienceLabels ? sp.sicht : undefined;

  const annAnd: Prisma.AnnouncementWhereInput[] = [await announcementWhereForUser(user)];
  if (q) {
    annAnd.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (sicht) annAnd.push({ audience: sicht as Prisma.AnnouncementWhereInput["audience"] });
  if (scope.objektId) annAnd.push({ propertyId: scope.objektId });
  const announcementWhere: Prisma.AnnouncementWhereInput = { AND: annAnd };
  const hasFilter = Boolean(q || sicht || scope.active);

  const total = await db.announcement.count({ where: announcementWhere });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const announcements = await db.announcement.findMany({
    where: announcementWhere,
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { property: true, acknowledgements: { include: { user: true } } },
  });
  const properties = isVerwalter
    ? await db.property.findMany({ where: await propertyWhereForVerwalter(user), orderBy: { name: "asc" } })
    : [];

  const pageHref = pageHrefFor(`/aushaenge`, sp);

  const annFilters: FilterConfig[] = isVerwalter
    ? [
        {
          key: "sicht",
          label: "Sichtbarkeit",
          allLabel: "Alle",
          primary: true,
          options: optionsFrom(audienceLabels),
        },
      ]
    : [];

  return (
    <>
      <PageTitle>Aushänge</PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          Bitte alle Pflichtfelder korrekt ausfüllen.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div>
            <FilterBar
              searchPlaceholder="Suchen"
              searchHint="Nach Titel oder Text suchen"
              filters={annFilters}
              comboboxes={scope.comboboxes}
            />
            <p className="mt-2 px-1 text-xs text-gray-400">
              {total} {total === 1 ? "Aushang" : "Aushänge"}
              {hasFilter ? " (gefiltert)" : ""}
            </p>
          </div>

          {announcements.length === 0 ? (
            <EmptyState>
              {hasFilter ? "Keine Aushänge gefunden." : "Derzeit gibt es keine Aushänge."}
            </EmptyState>
          ) : (
            announcements.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{a.title}</h2>
                    <p className="text-xs text-gray-500">
                      {a.property.name} · {formatDate(a.createdAt)}
                      {isVerwalter ? ` · sichtbar für: ${audienceLabels[a.audience]}` : ""}
                    </p>
                  </div>
                  {isVerwalter ? (
                    <form action={deleteAnnouncement} className="shrink-0">
                      <input type="hidden" name="id" value={a.id} />
                      <ConfirmDeleteButton title="Aushang löschen" />
                    </form>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{a.body}</p>
                <div className="mt-3 border-t border-gray-100 pt-3">
                  {isVerwalter ? (
                    <p className="text-xs text-gray-500">
                      Gelesen ({a.acknowledgements.length}):{" "}
                      {a.acknowledgements.length > 0
                        ? a.acknowledgements.map((ack) => ack.user.name).join(", ")
                        : "noch niemand"}
                    </p>
                  ) : a.acknowledgements.some((ack) => ack.userId === user.id) ? (
                    <p className="text-xs font-medium text-green-700">✓ Zur Kenntnis genommen</p>
                  ) : (
                    <form action={acknowledgeAnnouncement}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Zur Kenntnis nehmen
                      </button>
                    </form>
                  )}
                </div>
              </Card>
            ))
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} total={total} hrefFor={pageHref} />
        </div>

        {isVerwalter ? (
          <Card title="Neuer Aushang">
            <form action={createAnnouncement} className="space-y-3">
              <Field label="Objekt">
                <select name="propertyId" required className={inputClass}>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sichtbar für">
                <select name="audience" required className={inputClass} defaultValue="ALLE">
                  {Object.entries(audienceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Titel">
                <input type="text" name="title" required minLength={3} maxLength={200} className={inputClass} />
              </Field>
              <Field label="Text">
                <textarea name="body" required minLength={3} maxLength={5000} rows={6} className={inputClass} />
              </Field>
              <button type="submit" className={buttonClass}>
                Veröffentlichen
              </button>
            </form>
          </Card>
        ) : null}
      </div>
    </>
  );
}
