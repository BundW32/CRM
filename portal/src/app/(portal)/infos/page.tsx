import Link from "next/link";
import { Download, Eye } from "lucide-react";
import type { User } from "@/generated/prisma/client";
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
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PropertyUnitFields } from "@/components/property-unit-fields";
import { SubmitButton } from "@/components/submit-button";
import {
  announcementWhereForUser,
  documentWhereForUser,
  ownedProperties,
  propertyWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import {
  audienceLabels,
  documentCategoryLabels,
  formatBytes,
  formatDate,
  requestableDocuments,
} from "@/lib/labels";
import { RecipientPicker } from "@/components/recipient-picker";
import { requireUser } from "@/lib/session";
import {
  acknowledgeAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
} from "../aushaenge/actions";
import {
  acknowledgeDocument,
  deleteDocument,
  requestDocument,
  searchDocumentRecipients,
  uploadDocument,
  uploadOwnerDocument,
} from "../dokumente/actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function InfosPage({
  searchParams,
}: {
  searchParams: Promise<{
    t?: string;
    fehler?: string;
    apage?: string;
    dpage?: string;
    hochgeladen?: string;
    geloescht?: string;
  }>;
}) {
  const user = await requireUser();
  const { t, fehler, apage, dpage, hochgeladen, geloescht } = await searchParams;
  const tab = t === "dokumente" ? "dokumente" : "aushaenge";
  const isVerwalter = user.role === "VERWALTER";

  return (
    <>
      <PageTitle>Infos</PageTitle>

      {/* Tabs */}
      <div className="mb-5 flex gap-2 text-sm">
        <Link
          href="/infos?t=aushaenge"
          className={`rounded-full px-4 py-1.5 font-medium ${
            tab === "aushaenge"
              ? "bg-brand-orange text-brand-green-dark"
              : "border border-white/20 bg-white/90 text-gray-600"
          }`}
        >
          Aushänge
        </Link>
        <Link
          href="/infos?t=dokumente"
          className={`rounded-full px-4 py-1.5 font-medium ${
            tab === "dokumente"
              ? "bg-brand-orange text-brand-green-dark"
              : "border border-white/20 bg-white/90 text-gray-600"
          }`}
        >
          Dokumente
        </Link>
      </div>

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

      {tab === "aushaenge" ? (
        <AushaengeTab user={user} isVerwalter={isVerwalter} page={apage} />
      ) : (
        <DokumenteTab user={user} isVerwalter={isVerwalter} page={dpage} />
      )}
    </>
  );
}

async function AushaengeTab({
  user,
  isVerwalter,
  page,
}: {
  user: User;
  isVerwalter: boolean;
  page?: string;
}) {
  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const announcementWhere = await announcementWhereForUser(user);
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

  function pageHref(p: number) {
    const sp = new URLSearchParams();
    sp.set("t", "aushaenge");
    if (p > 1) sp.set("apage", String(p));
    return `/infos?${sp.toString()}`;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {announcements.length === 0 ? (
          <EmptyState>Derzeit gibt es keine Aushänge.</EmptyState>
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
  );
}

async function DokumenteTab({
  user,
  isVerwalter,
  page,
}: {
  user: User;
  isVerwalter: boolean;
  page?: string;
}) {
  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const documentWhere = await documentWhereForUser(user);
  const total = await db.document.count({ where: documentWhere });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const documents = await db.document.findMany({
    where: documentWhere,
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { property: true, unit: true, acknowledgements: { include: { user: true } } },
  });

  function pageHref(p: number) {
    const sp = new URLSearchParams();
    sp.set("t", "dokumente");
    if (p > 1) sp.set("dpage", String(p));
    return `/infos?${sp.toString()}`;
  }

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
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {documents.length === 0 ? (
          <EmptyState>Für Sie sind noch keine Dokumente hinterlegt.</EmptyState>
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
  );
}
