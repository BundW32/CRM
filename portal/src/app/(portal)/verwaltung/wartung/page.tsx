import { Card, EmptyState, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import {
  formatDate,
  maintenanceIntervalLabels,
  tradeLabels,
} from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import {
  completeMaintenanceTask,
  createMaintenanceTask,
  deleteMaintenanceTask,
} from "./actions";

export const dynamic = "force-dynamic";

const DAY = 1000 * 60 * 60 * 24;

export default async function WartungPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  await requireVerwalter();
  const { fehler } = await searchParams;

  const [tasks, properties, craftsmen] = await Promise.all([
    db.maintenanceTask.findMany({
      where: { active: true },
      orderBy: { dueDate: "asc" },
      include: { property: true, craftsman: true },
    }),
    db.property.findMany({ orderBy: { name: "asc" } }),
    db.craftsman.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const now = new Date().getTime();

  return (
    <>
      <PageTitle>Wartung &amp; Prüfungen</PageTitle>
      <p className="mb-6 max-w-3xl text-sm text-gray-300">
        Wiederkehrende Wartungen und Prüfungen (z. B. Heizung, Rauchmelder,
        Legionellenprüfung) mit Fälligkeitsdatum. Überfällige Einträge sind rot,
        bald fällige orange markiert.
      </p>

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Bitte Titel, Intervall und Fälligkeitsdatum angeben.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {tasks.length === 0 ? (
            <EmptyState>Noch keine Wartungsaufgaben angelegt.</EmptyState>
          ) : (
            tasks.map((t) => {
              const days = Math.floor((t.dueDate.getTime() - now) / DAY);
              const tone =
                days < 0
                  ? "border-red-300 bg-red-50"
                  : days <= 14
                    ? "border-orange-300 bg-orange-50"
                    : "border-gray-200 bg-white";
              const statusText =
                days < 0
                  ? `überfällig seit ${Math.abs(days)} Tag(en)`
                  : days === 0
                    ? "heute fällig"
                    : `fällig in ${days} Tag(en)`;
              return (
                <div key={t.id} className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                      <p className="text-xs text-gray-500">
                        {maintenanceIntervalLabels[t.interval]} · fällig am{" "}
                        {formatDate(t.dueDate)} · {statusText}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t.property ? t.property.name : "Allgemein"}
                        {t.craftsman
                          ? ` · ${t.craftsman.company ? t.craftsman.company + " / " : ""}${t.craftsman.name} (${tradeLabels[t.craftsman.trade]})`
                          : ""}
                        {t.lastDoneAt ? ` · zuletzt erledigt ${formatDate(t.lastDoneAt)}` : ""}
                      </p>
                      {t.description ? (
                        <p className="mt-1 text-sm text-gray-700">{t.description}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <form action={completeMaintenanceTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold text-brand-green-dark hover:bg-brand-orange-dark"
                        >
                          Erledigt
                        </button>
                      </form>
                      <form action={deleteMaintenanceTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">
                          Löschen
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Card title="Wartung anlegen">
          <form action={createMaintenanceTask} className="space-y-3">
            <Field label="Titel">
              <input type="text" name="title" required minLength={2} className={inputClass} placeholder="z. B. Heizungswartung" />
            </Field>
            <Field label="Intervall">
              <select name="interval" required className={inputClass} defaultValue="JAEHRLICH">
                {Object.entries(maintenanceIntervalLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nächste Fälligkeit">
              <input type="date" name="dueDate" required className={inputClass} />
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
            <Field label="Handwerker (optional)">
              <select name="craftsmanId" className={inputClass} defaultValue="">
                <option value="">– keiner –</option>
                {craftsmen.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company ? `${c.company} / ` : ""}
                    {c.name} ({tradeLabels[c.trade]})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notiz (optional)">
              <textarea name="description" rows={2} className={inputClass} />
            </Field>
            <button type="submit" className={buttonClass}>
              Anlegen
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
