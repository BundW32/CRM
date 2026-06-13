import { Card, EmptyState, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { documentWhereForUser } from "@/lib/access";
import { db } from "@/lib/db";
import {
  audienceLabels,
  documentCategoryLabels,
  formatBytes,
  formatDate,
} from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { requestDocument, uploadDocument } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte alle Pflichtfelder ausfüllen und eine Datei auswählen.",
  datei: "Nur PDF oder Bilder bis 10 MB sind erlaubt.",
  anfrage: "Die Anforderung konnte nicht angelegt werden.",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const user = await requireUser();
  const { fehler } = await searchParams;
  const isVerwalter = user.role === "VERWALTER";

  const documents = await db.document.findMany({
    where: await documentWhereForUser(user),
    orderBy: { createdAt: "desc" },
    include: { property: true, unit: true },
  });

  const properties = isVerwalter
    ? await db.property.findMany({ include: { units: true }, orderBy: { name: "asc" } })
    : [];

  return (
    <>
      <PageTitle>Dokumente</PageTitle>

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessages[fehler] ?? "Aktion fehlgeschlagen."}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {documents.length === 0 ? (
            <EmptyState>Für Sie sind noch keine Dokumente hinterlegt.</EmptyState>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <ul className="divide-y divide-gray-100">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={`/api/files/dokument/${doc.id}`}
                      target="_blank"
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">
                          {doc.title}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {documentCategoryLabels[doc.category]}
                          {doc.property ? ` · ${doc.property.name}` : " · Allgemein"}
                          {doc.unit ? ` · ${doc.unit.label}` : ""}
                          {isVerwalter
                            ? ` · sichtbar für: ${audienceLabels[doc.audience]}`
                            : ""}{" "}
                          · {formatDate(doc.createdAt)} · {formatBytes(doc.size)}
                        </span>
                      </span>
                      <span className="text-sm text-brand-green">Öffnen →</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {isVerwalter ? (
            <Card title="Dokument hochladen">
              <form action={uploadDocument} className="space-y-3">
                <Field label="Titel">
                  <input
                    type="text"
                    name="title"
                    required
                    minLength={2}
                    maxLength={200}
                    className={inputClass}
                  />
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
                <Field label="Objekt (optional)">
                  <select name="propertyId" className={inputClass} defaultValue="">
                    <option value="">– Allgemein –</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Einheit (optional, überschreibt Objekt)">
                  <select name="unitId" className={inputClass} defaultValue="">
                    <option value="">– Keine –</option>
                    {properties.flatMap((p) =>
                      p.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {p.name} – {u.label}
                        </option>
                      ))
                    )}
                  </select>
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
                <button type="submit" className={buttonClass}>
                  Hochladen
                </button>
              </form>
            </Card>
          ) : (
            <Card title="Dokument anfordern">
              <p className="mb-3 text-sm text-gray-600">
                Sie benötigen ein Dokument (z. B. eine Mietbescheinigung)? Beschreiben
                Sie kurz, was Sie brauchen — wir melden uns über das Portal.
              </p>
              <form action={requestDocument} className="space-y-3">
                <textarea
                  name="description"
                  required
                  minLength={3}
                  maxLength={2000}
                  rows={4}
                  placeholder="z. B. Mietbescheinigung für das Jobcenter"
                  className={inputClass}
                />
                <button type="submit" className={buttonClass}>
                  Anfordern
                </button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
