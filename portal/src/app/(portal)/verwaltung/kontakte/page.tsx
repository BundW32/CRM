import {
  Alert,
  CollapsibleCard,
  EmptyState,
  Field,
  PageTitle,
  Pagination,
  inputClass,
} from "@/components/ui";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { SubmitButton } from "@/components/submit-button";
import {
  ADDRESS_BOOK_KINDS,
  loadAddressBook,
  parseKind,
} from "@/lib/address-book";
import { contactKindLabels, roleLabels, tradeLabels } from "@/lib/labels";
import { normalizeSearch, parsePage } from "@/lib/list-query";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { isSelfManaged, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { NewUserForm } from "../nutzer/new-user-form";
import { createCraftsman } from "./actions";
import { KontaktZeile } from "./KontaktZeile";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const TRADE_ORDER = Object.keys(tradeLabels) as Array<keyof typeof tradeLabels>;
const KIND_ORDER = Object.keys(contactKindLabels) as Array<keyof typeof contactKindLabels>;

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
  const { fehler, angelegt } = params;

  const q = normalizeSearch(params.q);
  const kind = parseKind(params.art);
  const currentPage = parsePage(params.page);

  const { entries, total } = await loadAddressBook(verwalter, {
    q,
    kind,
    page: currentPage,
    pageSize: PAGE_SIZE,
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
  const hasFilter = Boolean(q || kind);

  const filters: FilterConfig[] = [
    {
      key: "art",
      label: "Art",
      primary: true,
      options: ADDRESS_BOOK_KINDS.map((k) => ({ value: k, label: kindLabel(k) })),
    },
  ];

  // Paginierung muss alle aktiven Filter mittragen.
  function pageHref(p: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "page") sp.set(k, v);
    }
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/verwaltung/kontakte${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <PageTitle>Kontakte</PageTitle>

      {angelegt ? (
        <Alert variant="success" className="mb-4">
          Kontakt wurde gespeichert.
        </Alert>
      ) : null}
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

        {/* Zwei Wege, einen Kontakt anzulegen – die Weiche ist der Portalzugang:
            Mieter/Eigentümer/Verwalter bekommen ein Konto, alle übrigen sind
            reine Karteikarten. */}
        <div className="space-y-5">
          <CollapsibleCard title="Person mit Zugang anlegen">
            <p className="mb-3 text-xs text-gray-500">
              Mieter, Eigentümer oder Verwalter – erhält einen Portalzugang per E-Mail-Einladung
              oder Zugangsschreiben.
            </p>
            <NewUserForm
              zurueck="/verwaltung/kontakte"
              properties={propsForNewUser}
              isSuperAdmin={verwalter.isSuperAdmin}
              selfManaged={selfManaged}
            />
          </CollapsibleCard>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-base font-semibold text-gray-900">Kontakt hinzufügen</h2>
            <p className="mb-4 text-xs text-gray-500">
              Firma oder Ansprechpartner ohne Portalzugang – Handwerker, Dienstleister,
              Versorger, Behörden.
            </p>
            <form action={createCraftsman} className="space-y-3">
              <Field label="Art">
                <select name="kind" required className={inputClass} defaultValue="HANDWERKER">
                  {KIND_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {contactKindLabels[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Firma (optional)">
                <input
                  type="text"
                  name="company"
                  className={inputClass}
                  placeholder="z. B. Müller Sanitär GmbH"
                />
              </Field>
              <Field label="Ansprechpartner / Name">
                <input type="text" name="name" required minLength={2} className={inputClass} />
              </Field>
              <Field label="Gewerk (nur bei Handwerkern relevant)">
                <select name="trade" required className={inputClass} defaultValue="SANITAER">
                  {TRADE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {tradeLabels[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Telefon">
                <input type="tel" name="phone" className={inputClass} />
              </Field>
              <Field label="E-Mail">
                <input type="email" name="email" className={inputClass} />
              </Field>
              <Field label="Bevorzugter Kontaktweg">
                <select
                  name="preferredContact"
                  required
                  className={inputClass}
                  defaultValue="TELEFON"
                >
                  {[
                    ["EMAIL", "E-Mail"],
                    ["TELEFON", "Telefon"],
                    ["MOBIL", "Mobil"],
                    ["POST", "Post"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Notizen (optional)">
                <textarea
                  name="notes"
                  rows={2}
                  className={inputClass}
                  placeholder="z. B. Verfügbarkeiten, Konditionen"
                />
              </Field>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" name="isInternal" className="mt-0.5" />
                <span>
                  <span className="font-medium">Intern (Eigenleistung)</span>
                  <span className="block text-xs text-gray-500">
                    Wird bei der Vorgangszuordnung zuerst angeboten. Externe können erst nach
                    ausdrücklicher Freigabe beauftragt werden.
                  </span>
                </span>
              </label>
              <SubmitButton pendingLabel="Wird gespeichert…">Speichern</SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
