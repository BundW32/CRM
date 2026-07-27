import Link from "next/link";
import { Download, Eye } from "lucide-react";
import { PendingButton } from "@/components/pending-button";
import type { Prisma } from "@/generated/prisma/client";
import {
  Pagination,
  Alert,
  EmptyState,
  PageTitle,
  buttonClass,
  buttonCompact,
  buttonGhostClass,
  buttonSecondaryClass,
} from "@/components/ui";
import { Badge } from "@/components/data-display";
import { FilterBar, SortControl, type FilterConfig } from "@/components/filter-bar";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { documentWhereForUser, ownedProperties } from "@/lib/access";
import { db } from "@/lib/db";
import {
  audienceLabels,
  documentCategoryLabels,
  formatBytes,
  formatDateOnly,
} from "@/lib/labels";
import { optionsFrom, propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, pageHrefFor, parsePage, resolveSort, toOrderBy } from "@/lib/list-query";
import { requireUser } from "@/lib/session";
import { acknowledgeDocument, deleteDocument } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

// Whitelist der Sortierfelder (verhindert beliebige Felder aus der URL).
const SORT_FIELDS = { datum: "createdAt", titel: "title", groesse: "size" } as const;

const sortOptions = [
  { value: "datum", label: "Datum" },
  { value: "titel", label: "Titel" },
  { value: "groesse", label: "Dateigröße" },
];

export default async function DokumentePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const { fehler, hochgeladen, geloescht } = sp;
  const isVerwalter = user.role === "VERWALTER";
  const currentPage = parsePage(sp.page);
  const sort = resolveSort(sp.sort, sp.dir, SORT_FIELDS, "datum", "desc");

  // ── Filter: Suche, Kategorie, Objekt → Einheit ──
  const scope = await propertyScopeFilters(user, sp, { withUnit: true });
  const q = normalizeSearch(sp.q);
  const kat = sp.kat && sp.kat in documentCategoryLabels ? sp.kat : undefined;

  const docAnd: Prisma.DocumentWhereInput[] = [await documentWhereForUser(user)];
  if (q) {
    docAnd.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { fileName: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (kat) docAnd.push({ category: kat as Prisma.DocumentWhereInput["category"] });
  if (scope.objektId) docAnd.push({ propertyId: scope.objektId });
  if (scope.einheitId) docAnd.push({ unitId: scope.einheitId });
  const documentWhere: Prisma.DocumentWhereInput = { AND: docAnd };
  const hasFilter = Boolean(q || kat || scope.active);

  const total = await db.document.count({ where: documentWhere });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const documents = await db.document.findMany({
    where: documentWhere,
    orderBy: toOrderBy(sort.field, sort.dir),
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { property: true, unit: true, acknowledgements: { include: { user: true } } },
  });

  const pageHref = pageHrefFor(`/dokumente`, sp);

  const docFilters: FilterConfig[] = [
    {
      key: "kat",
      label: "Kategorie",
      allLabel: "Alle Kategorien",
      primary: true,
      options: optionsFrom(documentCategoryLabels),
    },
  ];


  // Objekte des Eigentümers (für den Eigentümer-Upload).
  const ownedProps = user.role === "EIGENTUEMER" ? await ownedProperties(user.id) : [];

  return (
    <>
      <PageTitle
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Hochladen dürfen Verwaltung und Eigentümer (für ihre eigenen
                Objekte); anfordern alle außer der Verwaltung. */}
            {isVerwalter || (user.role === "EIGENTUEMER" && ownedProps.length > 0) ? (
              <Link href="/dokumente/neu" className={buttonClass}>
                Dokument hochladen
              </Link>
            ) : null}
            {!isVerwalter ? (
              <Link href="/dokumente/anfordern" className={buttonSecondaryClass}>
                Dokument anfordern
              </Link>
            ) : null}
          </div>
        }
      >
        Dokumente
      </PageTitle>

      {hochgeladen ? (
        <Alert variant="success" className="mb-4">
          Dokument hochgeladen.
        </Alert>
      ) : null}
      {geloescht ? (
        <Alert variant="success" className="mb-4">
          Dokument gelöscht.
        </Alert>
      ) : null}
      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "datei"
            ? "Nur PDF oder Bilder bis 10 MB sind erlaubt."
            : fehler === "anfrage"
              ? "Bitte ein Dokument wählen oder kurz beschreiben."
              : "Bitte alle Pflichtfelder korrekt ausfüllen."}
        </Alert>
      ) : null}

      <div className="space-y-4">
        <div>
          <div className="mb-3">
            <FilterBar
              searchPlaceholder="Suchen"
              searchHint="Nach Titel oder Dateiname suchen"
              filters={docFilters}
              comboboxes={scope.comboboxes}
            />
            {/* Ergebniszeile: Trefferzahl links, Sortierung dezent rechts. */}
            <div className="mt-2 flex items-center justify-between gap-3 px-1">
              <p className="text-xs text-gray-400">
                {total} {total === 1 ? "Dokument" : "Dokumente"}
                {hasFilter ? " (gefiltert)" : ""}
              </p>
              <SortControl sortOptions={sortOptions} defaultSort="datum" total={total} />
            </div>
          </div>

          {documents.length === 0 ? (
            <EmptyState>
              {hasFilter
                ? "Keine Dokumente gefunden."
                : "Für Sie sind noch keine Dokumente hinterlegt."}
            </EmptyState>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <ul className="divide-y divide-gray-100">
                {documents.map((doc) => (
                  <li key={doc.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <a
                          href={`/api/files/dokument/${doc.id}`}
                          target="_blank"
                          className="block truncate text-sm font-medium text-gray-900 hover:underline"
                        >
                          {doc.title}
                        </a>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500">
                          <Badge tone="neutral">{documentCategoryLabels[doc.category]}</Badge>
                          {isVerwalter ? (
                            <Badge tone="info">{audienceLabels[doc.audience]}</Badge>
                          ) : null}
                          <span>
                            {doc.property ? doc.property.name : "Allgemein"}
                            {doc.unit ? ` · ${doc.unit.label}` : ""}
                            {` · ${formatDateOnly(doc.createdAt)} · ${formatBytes(doc.size)}`}
                          </span>
                        </span>
                      </div>
                      <span className="flex shrink-0 items-center gap-1">
                        <a
                          href={`/api/files/dokument/${doc.id}`}
                          target="_blank"
                          className={`${buttonGhostClass} px-2.5 py-1.5 text-xs`}
                        >
                          <Eye className="h-4 w-4" />
                          Öffnen
                        </a>
                        {/* Direkter Download – funktioniert zuverlässig auch auf dem Handy */}
                        <a
                          href={`/api/files/dokument/${doc.id}?download=1`}
                          className={`${buttonGhostClass} px-2.5 py-1.5 text-xs`}
                        >
                          <Download className="h-4 w-4" />
                          <span className="hidden sm:inline">Herunterladen</span>
                          <span className="sm:hidden">Laden</span>
                        </a>
                        {isVerwalter ? (
                          <form action={deleteDocument} className="inline-flex">
                            <input type="hidden" name="id" value={doc.id} />
                            <ConfirmDeleteButton title="Dokument löschen" />
                          </form>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-2">
                      {isVerwalter ? (
                        <p className="text-xs text-gray-500">
                          Gelesen ({doc.acknowledgements.length}):{" "}
                          {doc.acknowledgements.length > 0
                            ? doc.acknowledgements.map((ack) => ack.user.name).join(", ")
                            : "noch niemand"}
                        </p>
                      ) : doc.acknowledgements.some((ack) => ack.userId === user.id) ? (
                        <Badge tone="success">Zur Kenntnis genommen</Badge>
                      ) : (
                        <form action={acknowledgeDocument}>
                          <input type="hidden" name="id" value={doc.id} />
                          <PendingButton className={`${buttonSecondaryClass} ${buttonCompact}`}>
                            Zur Kenntnis nehmen
                          </PendingButton>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} total={total} hrefFor={pageHref} />
        </div>

      </div>
    </>
  );
}
