import type { Prisma } from "@/generated/prisma/client";
import { PendingButton } from "@/components/pending-button";
import Link from "next/link";
import {
  Pagination,
  Alert,
  Card,
  EmptyState,
  PageTitle,
  buttonClass,
  buttonCompact,
  buttonSecondaryClass,
} from "@/components/ui";
import { Badge } from "@/components/data-display";
import { FilterBar, SortControl, type FilterConfig } from "@/components/filter-bar";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { announcementWhereForUser } from "@/lib/access";
import { db } from "@/lib/db";
import { audienceLabels, formatDateOnly } from "@/lib/labels";
import { optionsFrom, propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, pageHrefFor, parsePage, resolveSort, toOrderBy } from "@/lib/list-query";
import { requireUser } from "@/lib/session";
import { acknowledgeAnnouncement, deleteAnnouncement } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

// Whitelist der Sortierfelder (verhindert beliebige Felder aus der URL).
const SORT_FIELDS = { datum: "createdAt", titel: "title", objekt: "property.name" } as const;

const sortOptions = [
  { value: "datum", label: "Datum" },
  { value: "titel", label: "Titel" },
  { value: "objekt", label: "Objekt" },
];

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
  const sort = resolveSort(sp.sort, sp.dir, SORT_FIELDS, "datum", "desc");

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
    orderBy: toOrderBy(sort.field, sort.dir),
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { property: true, acknowledgements: { include: { user: true } } },
  });

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
      <PageTitle
        action={
          isVerwalter ? (
            <Link href="/aushaenge/neu" className={buttonClass}>
              Neuer Aushang
            </Link>
          ) : null
        }
      >
        Aushänge
      </PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          Bitte alle Pflichtfelder korrekt ausfüllen.
        </Alert>
      ) : null}

      <div className="space-y-4">
        <div>
            <FilterBar
              searchPlaceholder="Suchen"
              searchHint="Nach Titel oder Text suchen"
              filters={annFilters}
              comboboxes={scope.comboboxes}
            />
            {/* Ergebniszeile: Trefferzahl links, Sortierung dezent rechts. Das
                Sortiermenü sieht nur der Verwalter – er hat Aushänge über viele
                Objekte hinweg; für Mieter und Eigentümer ist „neueste zuerst"
                die einzige sinnvolle Ordnung. */}
            <div className="mt-2 flex items-center justify-between gap-3 px-1">
              <p className="text-xs text-gray-400">
                {total} {total === 1 ? "Aushang" : "Aushänge"}
                {hasFilter ? " (gefiltert)" : ""}
              </p>
              <SortControl sortOptions={sortOptions} defaultSort="datum" total={total} />
            </div>
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
                      {a.property.name} · {formatDateOnly(a.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isVerwalter ? (
                      <Badge tone="neutral">{audienceLabels[a.audience]}</Badge>
                    ) : null}
                  {isVerwalter ? (
                    <form action={deleteAnnouncement} className="shrink-0">
                      <input type="hidden" name="id" value={a.id} />
                      <ConfirmDeleteButton title="Aushang löschen" />
                    </form>
                  ) : null}
                  </div>
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
                    <Badge tone="success">Zur Kenntnis genommen</Badge>
                  ) : (
                    <form action={acknowledgeAnnouncement}>
                      <input type="hidden" name="id" value={a.id} />
                      <PendingButton className={`${buttonSecondaryClass} ${buttonCompact}`}>
                        Zur Kenntnis nehmen
                      </PendingButton>
                    </form>
                  )}
                </div>
              </Card>
            ))
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} total={total} hrefFor={pageHref} />
        </div>
    </>
  );
}
