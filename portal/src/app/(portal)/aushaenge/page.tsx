import { Card, EmptyState, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { announcementWhereForUser } from "@/lib/access";
import { db } from "@/lib/db";
import { audienceLabels, formatDate } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { acknowledgeAnnouncement, createAnnouncement, deleteAnnouncement } from "./actions";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const user = await requireUser();
  const { fehler } = await searchParams;
  const isVerwalter = user.role === "VERWALTER";

  const announcements = await db.announcement.findMany({
    where: await announcementWhereForUser(user),
    orderBy: { createdAt: "desc" },
    include: {
      property: true,
      createdBy: true,
      acknowledgements: { include: { user: true } },
    },
  });

  const properties = isVerwalter
    ? await db.property.findMany({ orderBy: { name: "asc" } })
    : [];

  return (
    <>
      <PageTitle>Aushänge</PageTitle>

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Bitte alle Felder ausfüllen (mind. 3 Zeichen).
        </p>
      ) : null}

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
                      {isVerwalter
                        ? ` · sichtbar für: ${audienceLabels[a.audience]}`
                        : ""}
                    </p>
                  </div>
                  {isVerwalter ? (
                    <form action={deleteAnnouncement}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline"
                      >
                        Löschen
                      </button>
                    </form>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{a.body}</p>

                <div className="mt-3 border-t border-gray-100 pt-3">
                  {isVerwalter ? (
                    <p className="text-xs text-gray-500">
                      Gelesen ({a.acknowledgements.length}):{" "}
                      {a.acknowledgements.length > 0
                        ? a.acknowledgements
                            .map((ack) => ack.user.name)
                            .join(", ")
                        : "noch niemand"}
                    </p>
                  ) : a.acknowledgements.some((ack) => ack.userId === user.id) ? (
                    <p className="text-xs font-medium text-green-700">
                      ✓ Zur Kenntnis genommen
                    </p>
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
                <input
                  type="text"
                  name="title"
                  required
                  minLength={3}
                  maxLength={200}
                  className={inputClass}
                />
              </Field>
              <Field label="Text">
                <textarea
                  name="body"
                  required
                  minLength={3}
                  maxLength={5000}
                  rows={6}
                  className={inputClass}
                />
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
