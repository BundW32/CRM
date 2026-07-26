import { Alert, EmptyState, PageTitle, Pagination } from "@/components/ui";
import { FilterBar, SortControl, type FilterConfig } from "@/components/filter-bar";
import {
  ADDRESS_BOOK_KINDS,
  loadAddressBook,
  parseKind,
  parseMandate,
} from "@/lib/address-book";
import { contactKindLabels, roleLabels } from "@/lib/labels";
import { normalizeSearch, pageHrefFor, parsePage, resolveSort } from "@/lib/list-query";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { isSelfManaged, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { KontaktAnlegen } from "./KontaktAnlegen";
import { KontaktZeile } from "./KontaktZeile";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

// Whitelist der Sortierfelder. Das Adressbuch führt Personen und Firmen aus
// zwei Tabellen zusammen und sortiert im Speicher – die Schlüssel benennen
// deshalb keine Spalten, sondern die Vergleichsart.
const SORT_FIELDS = { name: "name", art: "art" } as const;

const sortOptions = [
  { value: "name", label: "Name" },
  { value: "art", label: "Art" },
];

// Beschriftung der „Art“ – Personenrollen und Kontaktarten in einer Liste.
function kindLabel(value: string): string {
  if (value in roleLabels) return roleLabels[value as keyof typeof roleLabels];
  if (value in contactKindLabels) return contactKindLabels[value as keyof typeof contactKindLabels];
  return value;
}

export default async function KontaktePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const verwalter = await requireVerwalter();
  const selfManaged = isSelfManaged(await getOrganization());
  const params = await searchParams;
  const { fehler } = params;

  const q = normalizeSearch(params.q);
  const kind = parseKind(params.art);
  const mandate = parseMandate(params.vollmacht);
  const currentPage = parsePage(params.page);
  const sort = resolveSort(params.sort, params.dir, SORT_FIELDS, "name", "asc");

  const { entries, total } = await loadAddressBook(verwalter, {
    q,
    kind,
    mandate,
    page: currentPage,
    pageSize: PAGE_SIZE,
    sort: sort.key,
    dir: sort.dir,
  });
  // Objektliste für das Anlegen einer Person mit Zugang (Mieter/Eigentümer-Zuordnung).
  const propsForNewUser = (
    await db.property.findMany({
      where: await propertyWhereForVerwalter(verwalter),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  ).map((p) => ({ id: p.id, name: p.name }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilter = Boolean(q || kind || mandate);

  const filters: FilterConfig[] = [
    {
      key: "art",
      label: "Art",
      primary: true,
      options: ADDRESS_BOOK_KINDS.map((k) => ({ value: k, label: kindLabel(k) })),
    },
    {
      // Betrifft nur Eigentümer und blendet darum alles andere aus. Macht die
      // Fälle auffindbar, in denen eine Bescheinigung nicht automatisch
      // entstehen kann – sonst merkt man das erst, wenn ein Mieter fragt.
      key: "vollmacht",
      label: "Vollmacht",
      allLabel: "Alle Eigentümer",
      options: [
        { value: "fehlt", label: "Vollmacht fehlt" },
        { value: "ohne_unterschrift", label: "Ohne eigene Unterschrift" },
        { value: "erteilt", label: "Vollmacht erteilt" },
      ],
    },
  ];

  const pageHref = pageHrefFor(`/verwaltung/kontakte`, params);

  return (
    <>
      <PageTitle>Kontakte</PageTitle>

      {/* Erfolg meldet der ToastHost (`?flash=…`) – er erscheint auch dann,
          wenn die Aktion von einer anderen Seite zurückspringt. Fehler bleiben
          als Banner am Formular stehen. */}
      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "email"
            ? "Diese E-Mail-Adresse wird bereits von einer anderen Person verwendet."
            : "Bitte Pflichtfelder (Name, Art) korrekt ausfüllen."}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FilterBar
            searchPlaceholder="Suchen"
            searchHint="Nach Name, Firma, E-Mail oder Telefon suchen"
            filters={filters}
          />

          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-xs text-gray-400">
              {total} Kontakt{total !== 1 ? "e" : ""}
              {hasFilter ? " (gefiltert)" : ""}
            </p>
            <SortControl sortOptions={sortOptions} defaultSort="name" total={total} />
          </div>

          {entries.length === 0 ? (
            <EmptyState>
              {hasFilter
                ? "Keine Kontakte gefunden."
                : "Noch keine Kontakte – rechts können Sie den ersten anlegen."}
            </EmptyState>
          ) : (
            <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <ul className="divide-y divide-gray-100">
                {entries.map((e) => (
                  <KontaktZeile key={`${e.source}-${e.id}`} entry={e} />
                ))}
              </ul>
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={total}
            hrefFor={pageHref}
          />
        </div>

        {/* Ein Formular, eine Weiche: Ganz oben steht die Art, alles Weitere
            folgt daraus – auch, ob ein Portalzugang entsteht. */}
        <div className="space-y-5">
          <KontaktAnlegen
            properties={propsForNewUser}
            isSuperAdmin={verwalter.isSuperAdmin}
            selfManaged={selfManaged}
          />
        </div>
      </div>
    </>
  );
}
