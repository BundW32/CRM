import {
  Alert,
  EmptyState,
  PageTitle,
  Pagination,
  buttonClass,
  cardSurfaceClass,
} from "@/components/ui";
import Link from "next/link";
import { AblageAlert } from "@/components/ablage-alert";
import { FilterBar, SortControl, type FilterConfig } from "@/components/filter-bar";
import {
  ADDRESS_BOOK_KINDS,
  loadAddressBook,
  parseKind,
  parseMandate,
} from "@/lib/address-book";
import { contactKindLabels, roleLabels } from "@/lib/labels";
import { normalizeSearch, pageHrefFor, parsePage, resolveSort } from "@/lib/list-query";
import { requireVerwalter } from "@/lib/session";
import { formatCents } from "@/lib/money";
import { freistellungGueltig } from "@/lib/weg/bauabzugsteuer";
import { bauleistungenJeHandwerker } from "@/lib/weg/bauabzugsteuer-service";
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
  const params = await searchParams;
  const { fehler, grund } = params;

  const q = normalizeSearch(params.q);
  const kind = parseKind(params.art);
  const mandate = parseMandate(params.vollmacht);
  const currentPage = parsePage(params.page);
  const sort = resolveSort(params.sort, params.dir, SORT_FIELDS, "name", "asc");

  // Vorwarnung zur Bauabzugsteuer (§ 48 EStG).
  //
  // Die Warnung im Buchungsformular kommt richtig, aber spät: Wer dort steht,
  // hat die Rechnung schon in der Hand. Wer bei 4.000 € steht, soll die
  // Bescheinigung **vor** dem nächsten Auftrag anfordern — dann ist das Thema
  // für das ganze Jahr erledigt. Deshalb hier, wo die Handwerker gepflegt
  // werden, und nicht in der Buchhaltung.
  const bauleistungen = await bauleistungenJeHandwerker(verwalter.organizationId, new Date());
  const bauabzugFaelle = bauleistungen.filter(
    (h) =>
      h.naehe !== "FREI" &&
      !freistellungGueltig(
        { nummer: h.freistellung.nummer, gueltigBis: h.freistellung.gueltigBis },
        new Date(),
      ),
  );

  const { entries, total } = await loadAddressBook(verwalter, {
    q,
    kind,
    mandate,
    page: currentPage,
    pageSize: PAGE_SIZE,
    sort: sort.key,
    dir: sort.dir,
  });

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
      <PageTitle
        action={
          <Link href="/verwaltung/kontakte/neu" className={buttonClass}>
            Kontakt anlegen
          </Link>
        }
      >
        Kontakte
      </PageTitle>

      {bauabzugFaelle.length > 0 ? (
        <Alert variant="warning" className="mb-4" title="Freistellungsbescheinigung fehlt">
          <p>
            Für {bauabzugFaelle.length === 1 ? "diesen Handwerker" : "diese Handwerker"} nähert
            sich die Gemeinschaft in diesem Kalenderjahr der 5.000-€-Grenze für Bauleistungen
            oder hat sie überschritten — ohne gültige Freistellungsbescheinigung müssen Sie dann
            15 % einbehalten und ans Finanzamt abführen (§ 48 EStG).
          </p>
          <ul className="mt-2 space-y-1">
            {bauabzugFaelle.map((h) => (
              <li key={h.craftsmanId}>
                <Link href={`/verwaltung/kontakte/${h.craftsmanId}`} className="underline">
                  {h.name}
                </Link>{" "}
                — {formatCents(h.bisherCents)} in diesem Jahr
                {h.naehe === "UEBER" ? " (Grenze überschritten)" : ""}
                {h.freistellung.nummer ? ", Bescheinigung abgelaufen" : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Fordern Sie die Bescheinigung an — die meisten Betriebe haben eine — und tragen Sie
            sie beim Kontakt ein. Dann entfällt der Einbehalt.
          </p>
        </Alert>
      ) : null}

      {/* Erfolg meldet der ToastHost (`?flash=…`) – er erscheint auch dann,
          wenn die Aktion von einer anderen Seite zurückspringt. Fehler bleiben
          als Banner am Formular stehen. */}
      {fehler === "bescheinigung" ? (
        <AblageAlert titel="Die Freistellungsbescheinigung wurde nicht gespeichert." grund={grund}>
          Nummer und Gültigkeitsdatum wurden ebenfalls nicht übernommen — bitte erneut speichern.
        </AblageAlert>
      ) : fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "email"
            ? "Diese E-Mail-Adresse wird bereits von einer anderen Person verwendet."
            : "Bitte Pflichtfelder (Name, Art) korrekt ausfüllen."}
        </Alert>
      ) : null}

      <div>
        <div>
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
            <div className={`mt-2 overflow-hidden ${cardSurfaceClass}`}>
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

      </div>
    </>
  );
}
