import { Card, EmptyState, PageTitle, inputClass, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { formatDate } from "@/lib/labels";
import { createNote, deleteNote, togglePinNote } from "./actions";

export const dynamic = "force-dynamic";

type FilterType = "alle" | "objekte" | "einheiten" | "personen";

function buildWhere(type: FilterType) {
  if (type === "objekte") return { propertyId: { not: null as string | null } };
  if (type === "einheiten") return { unitId: { not: null as string | null } };
  if (type === "personen") return { targetUserId: { not: null as string | null } };
  return {};
}

export default async function NotizenPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireVerwalter();

  const params = await searchParams;
  const type = (params.type ?? "alle") as FilterType;
  const filterWhere = buildWhere(type);

  const [notes, properties, units, persons] = await Promise.all([
    db.note.findMany({
      where: filterWhere,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: {
        property: true,
        unit: { include: { property: true } },
        targetUser: true,
        author: true,
      },
    }),
    db.property.findMany({ orderBy: { name: "asc" } }),
    db.unit.findMany({
      orderBy: [{ propertyId: "asc" }, { label: "asc" }],
      include: { property: true },
    }),
    db.user.findMany({
      where: { role: { in: ["MIETER", "EIGENTUEMER"] }, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const filters: { label: string; value: FilterType }[] = [
    { label: "Alle", value: "alle" },
    { label: "Objekte", value: "objekte" },
    { label: "Einheiten", value: "einheiten" },
    { label: "Mieter/Eigentümer", value: "personen" },
  ];

  return (
    <>
      <PageTitle>Notizen</PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Note list – takes up 2 columns on large screens */}
        <div className="space-y-4 lg:col-span-2">
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <a
                key={f.value}
                href={f.value === "alle" ? "/verwaltung/notizen" : `?type=${f.value}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  type === f.value
                    ? "bg-brand-orange text-brand-green-dark"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </a>
            ))}
          </div>

          {/* Notes */}
          {notes.length === 0 ? (
            <EmptyState>Keine Notizen vorhanden.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => {
                const contextLabel = note.property
                  ? note.property.name
                  : note.unit
                    ? `${note.unit.label} · ${note.unit.property.name}`
                    : note.targetUser
                      ? note.targetUser.name
                      : null;

                // Inline server action wrappers using .bind()
                const boundDelete = deleteNote.bind(null, note.id);
                const boundTogglePin = togglePinNote.bind(null, note.id, note.pinned);

                return (
                  <li
                    key={note.id}
                    className={`rounded-2xl border bg-white p-4 shadow-sm ${
                      note.pinned ? "border-orange-300" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Pin button */}
                      <form action={boundTogglePin}>
                        <button
                          type="submit"
                          title={note.pinned ? "Anpinnen aufheben" : "Anpinnen"}
                          className="mt-0.5 flex-shrink-0 text-xl leading-none transition hover:scale-110"
                        >
                          {note.pinned ? (
                            <span className="text-orange-500">★</span>
                          ) : (
                            <span className="text-gray-300 hover:text-orange-400">☆</span>
                          )}
                        </button>
                      </form>

                      {/* Body */}
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-sm text-gray-900">{note.body}</p>
                        <p className="mt-2 text-xs text-gray-400">
                          {contextLabel ? (
                            <>
                              <span className="font-medium text-gray-500">{contextLabel}</span>
                              {" · "}
                            </>
                          ) : null}
                          {note.author.name} · {formatDate(note.createdAt)}
                        </p>
                      </div>

                      {/* Delete button */}
                      <form action={boundDelete}>
                        <button
                          type="submit"
                          title="Notiz löschen"
                          className="flex-shrink-0 rounded px-1.5 py-0.5 text-sm font-bold text-red-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          ×
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Create form */}
        <Card title="Neue Notiz">
          <form action={createNote} className="space-y-4">
            <div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Notiz *</span>
                <textarea
                  name="body"
                  required
                  minLength={1}
                  maxLength={2000}
                  rows={4}
                  placeholder="Interne Notiz verfassen…"
                  className={inputClass}
                />
              </label>
            </div>

            <div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Objekt (optional)
                </span>
                <select name="propertyId" className={inputClass}>
                  <option value="">— kein Objekt —</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Einheit (optional)
                </span>
                <select name="unitId" className={inputClass}>
                  <option value="">— keine Einheit —</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label} · {u.property.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Mieter/Eigentümer (optional)
                </span>
                <select name="targetUserId" className={inputClass}>
                  <option value="">— keine Person —</option>
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <SubmitButton pendingLabel="Wird gespeichert…">Notiz speichern</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
