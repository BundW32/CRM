import { Download, Eye } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import {
  Pagination,
  Alert,
  Card,
  EmptyState,
  Field,
  PageTitle,
  buttonClass,
  buttonGhostClass,
  inputClass,
} from "@/components/ui";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PropertyUnitFields } from "@/components/property-unit-fields";
import { RecipientPicker } from "@/components/recipient-picker";
import { SubmitButton } from "@/components/submit-button";
import { documentWhereForUser, ownedProperties, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import {
  audienceLabels,
  documentCategoryLabels,
  formatBytes,
  formatDate,
  requestableDocuments,
} from "@/lib/labels";
import { optionsFrom, propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, parsePage, pageHrefFor } from "@/lib/list-query";
import { requireUser } from "@/lib/session";
import {
  acknowledgeDocument,
  deleteDocument,
  requestDocument,
  searchDocumentRecipients,
  uploadDocument,
  uploadOwnerDocument,
} from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

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
    orderBy: { createdAt: "desc" },
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

  const properties = isVerwalter
    ? await db.property.findMany({
        where: await propertyWhereForVerwalter(user),
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Objekte des Eigentümers (für den Eigentümer-Upload).
  const ownedProps = user.role === "EIGENTUEMER" ? await ownedProperties(user.id) : [];

  return (
    <>
      <PageTitle>Dokumente</PageTitle>

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

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3">
            <FilterBar
              searchPlaceholder="Suchen"
              searchHint="Nach Titel oder Dateiname suchen"
              filters={docFilters}
              comboboxes={scope.comboboxes}
            />
            <p className="mt-2 px-1 text-xs text-gray-400">
              {total} {total === 1 ? "Dokument" : "Dokumente"}
              {hasFilter ? " (gefiltert)" : ""}
            </p>
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
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">
                            {documentCategoryLabels[doc.category]}
                          </span>
                          <span>
                            {doc.property ? doc.property.name : "Allgemein"}
                            {doc.unit ? ` · ${doc.unit.label}` : ""}
                            {isVerwalter ? ` · sichtbar für: ${audienceLabels[doc.audience]}` : ""}
                            {` · ${formatDate(doc.createdAt)} · ${formatBytes(doc.size)}`}
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
                        <p className="text-xs font-medium text-green-700">✓ Zur Kenntnis genommen</p>
                      ) : (
                        <form action={acknowledgeDocument}>
                          <input type="hidden" name="id" value={doc.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Zur Kenntnis nehmen
                          </button>
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

        <div className="space-y-5">
          {isVerwalter ? (
            <Card title="Dokument hochladen">
              <form action={uploadDocument} className="space-y-3">
                <Field label="Titel">
                  <input type="text" name="title" required minLength={2} maxLength={200} className={inputClass} />
                </Field>
                <Field label="Kategorie">
                  <select name="category" required className={inputClass}>
                    {Object.entries(documentCategoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sichtbar für">
                  <select name="audience" required className={inputClass}>
                    {Object.entries(audienceLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <PropertyUnitFields
                  properties={properties.map((p) => ({ id: p.id, name: p.name }))}
                  unitLabel="Einheit (optional, überschreibt Objekt)"
                />
                <Field label="Nur für bestimmte Empfänger (optional)">
                  <RecipientPicker search={searchDocumentRecipients} />
                  <p className="mt-1 text-xs text-gray-500">
                    Leer lassen = wie „Sichtbar für“ (alle im Objekt). Bei Auswahl sehen NUR die
                    gewählten Personen (und die Verwaltung) das Dokument.
                  </p>
                </Field>
                <Field label="Datei (PDF oder Bild, max. 10 MB)">
                  <input
                    type="file"
                    name="file"
                    required
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-orange-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-orange-dark hover:file:bg-orange-100"
                  />
                </Field>
                <SubmitButton pendingLabel="Wird hochgeladen…">Hochladen</SubmitButton>
              </form>
            </Card>
          ) : (
            <>
              {user.role === "EIGENTUEMER" && ownedProps.length > 0 ? (
                <Card title="Dokument hochladen">
                  <p className="mb-3 text-sm text-gray-600">
                    Für Ihre Verwaltung – optional auch für Ihre Mieter sichtbar. Andere Eigentümer
                    sehen es nicht.
                  </p>
                  <form action={uploadOwnerDocument} className="space-y-3">
                    <Field label="Titel">
                      <input type="text" name="title" required minLength={2} maxLength={200} className={inputClass} />
                    </Field>
                    <Field label="Kategorie">
                      <select name="category" required className={inputClass}>
                        {Object.entries(documentCategoryLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Objekt">
                      <select name="propertyId" required className={inputClass}>
                        {ownedProps.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" name="shareTenants" value="1" className="h-4 w-4" />
                      Auch für meine Mieter sichtbar
                    </label>
                    <Field label="Datei (PDF oder Bild, max. 10 MB)">
                      <input
                        type="file"
                        name="file"
                        required
                        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                        className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-orange-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-orange-dark hover:file:bg-orange-100"
                      />
                    </Field>
                    <SubmitButton pendingLabel="Wird hochgeladen…">Hochladen</SubmitButton>
                  </form>
                </Card>
              ) : null}
              <Card title="Dokument anfordern">
                <p className="mb-3 text-sm text-gray-600">
                  Benötigen Sie ein Dokument (z. B. eine Wohnungsgeberbescheinigung)? Wählen Sie es aus
                  — die Verwaltung kümmert sich darum und meldet sich über das Portal.
                </p>
                <form action={requestDocument} className="space-y-3">
                  <Field label="Dokument">
                    <select name="art" className={inputClass} defaultValue={requestableDocuments[0]}>
                      {requestableDocuments.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Anmerkung (optional)">
                    <textarea
                      name="description"
                      maxLength={2000}
                      rows={3}
                      placeholder="z. B. wofür Sie das Dokument benötigen oder bis wann"
                      className={inputClass}
                    />
                  </Field>
                  <button type="submit" className={buttonClass}>
                    Anfordern
                  </button>
                </form>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
