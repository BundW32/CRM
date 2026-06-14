import { redirect } from "next/navigation";
import { Card, EmptyState, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { ownedProperties } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, resolutionStatusLabels, voteChoiceLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import {
  castVote,
  closeResolution,
  createResolution,
  deleteResolution,
  withdrawResolution,
} from "./actions";

export const dynamic = "force-dynamic";

const statusTone: Record<string, string> = {
  OFFEN: "bg-blue-100 text-blue-800",
  ANGENOMMEN: "bg-green-100 text-green-800",
  ABGELEHNT: "bg-red-100 text-red-700",
  ZURUECKGEZOGEN: "bg-gray-200 text-gray-700",
};

function Tally({
  votes,
  eligible,
}: {
  votes: { choice: "JA" | "NEIN" | "ENTHALTUNG" }[];
  eligible: number;
}) {
  const ja = votes.filter((v) => v.choice === "JA").length;
  const nein = votes.filter((v) => v.choice === "NEIN").length;
  const enth = votes.filter((v) => v.choice === "ENTHALTUNG").length;
  return (
    <p className="mt-2 text-xs text-gray-500">
      Ja: <strong className="text-gray-800">{ja}</strong> · Nein:{" "}
      <strong className="text-gray-800">{nein}</strong> · Enthaltung:{" "}
      <strong className="text-gray-800">{enth}</strong> · abgegeben {votes.length}
      {eligible > 0 ? ` von ${eligible} Eigentümern` : ""}
    </p>
  );
}

export default async function BeschluessePage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "VERWALTER" && user.role !== "EIGENTUEMER") {
    redirect("/dashboard");
  }
  const { fehler } = await searchParams;
  const isVerwalter = user.role === "VERWALTER";

  let where = {};
  if (!isVerwalter) {
    const props = await ownedProperties(user.id);
    where = { propertyId: { in: props.map((p) => p.id) } };
  }

  const resolutions = await db.resolution.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { property: true, votes: { include: { user: true } } },
  });

  const propIds = [...new Set(resolutions.map((r) => r.propertyId))];
  const ownerCounts = await db.ownership.groupBy({
    by: ["propertyId"],
    where: { propertyId: { in: propIds } },
    _count: { _all: true },
  });
  const ownerCountMap = new Map(ownerCounts.map((o) => [o.propertyId, o._count._all]));

  const open = resolutions.filter((r) => r.status === "OFFEN");
  const decided = resolutions.filter((r) => r.status !== "OFFEN");

  // Nur WEG-Objekte können Umlaufbeschlüsse haben
  const properties = isVerwalter
    ? await db.property.findMany({ where: { managementType: "WEG" }, orderBy: { name: "asc" } })
    : [];

  return (
    <>
      <PageTitle>Beschlüsse &amp; Abstimmungen</PageTitle>

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {fehler === "keinweg"
            ? "Umlaufbeschlüsse sind nur für WEG-Objekte möglich."
            : "Bitte Objekt, Titel und Beschlusstext ausfüllen."}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Laufende Abstimmungen
          </h2>
          {open.length === 0 ? (
            <EmptyState>Derzeit keine laufenden Abstimmungen.</EmptyState>
          ) : (
            open.map((r) => {
              const myVote = r.votes.find((v) => v.userId === user.id);
              return (
                <div
                  key={r.id}
                  id={r.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{r.title}</h3>
                      <p className="text-xs text-gray-500">
                        {r.property.name}
                        {r.deadline ? ` · Frist: ${formatDate(r.deadline)}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[r.status]}`}
                    >
                      {resolutionStatusLabels[r.status]}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{r.description}</p>

                  <Tally votes={r.votes} eligible={ownerCountMap.get(r.propertyId) ?? 0} />

                  {/* Eigentümer: abstimmen */}
                  {!isVerwalter ? (
                    <form action={castVote} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                      <input type="hidden" name="resolutionId" value={r.id} />
                      {myVote ? (
                        <p className="text-xs text-gray-600">
                          Ihre Stimme: <strong>{voteChoiceLabels[myVote.choice]}</strong> — Sie
                          können sie bis zum Abschluss ändern.
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <select name="choice" required defaultValue={myVote?.choice ?? ""} className={`${inputClass} w-auto`}>
                          <option value="" disabled>
                            – Stimme wählen –
                          </option>
                          <option value="JA">Ja</option>
                          <option value="NEIN">Nein</option>
                          <option value="ENTHALTUNG">Enthaltung</option>
                        </select>
                        <input
                          type="text"
                          name="comment"
                          placeholder="Kommentar (optional)"
                          className={`${inputClass} w-auto flex-1`}
                        />
                        <button type="submit" className={buttonClass}>
                          {myVote ? "Stimme ändern" : "Abstimmen"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      {r.votes.length > 0 ? (
                        <ul className="mb-3 space-y-1 text-xs text-gray-500">
                          {r.votes.map((v) => (
                            <li key={v.id}>
                              {v.user.name}: <strong>{voteChoiceLabels[v.choice]}</strong>
                              {v.comment ? ` — ${v.comment}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3">
                        <form action={closeResolution}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className={buttonClass}>
                            Abstimmung schließen
                          </button>
                        </form>
                        <form action={withdrawResolution}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="text-xs text-gray-500 hover:underline">
                            Zurückziehen
                          </button>
                        </form>
                        <form action={deleteResolution}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="text-xs text-red-600 hover:underline">
                            Löschen
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-300">
            Beschlusssammlung
          </h2>
          {decided.length === 0 ? (
            <EmptyState>Noch keine abgeschlossenen Beschlüsse.</EmptyState>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <ul className="divide-y divide-gray-100">
                {decided.map((r) => (
                  <li key={r.id} id={r.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {r.number ? `Nr. ${r.number} · ` : ""}
                        {r.title}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[r.status]}`}
                      >
                        {resolutionStatusLabels[r.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {r.property.name}
                      {r.decidedAt ? ` · entschieden am ${formatDate(r.decidedAt)}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-gray-700">{r.description}</p>
                    <Tally votes={r.votes} eligible={ownerCountMap.get(r.propertyId) ?? 0} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {isVerwalter ? (
          <Card title="Umlaufbeschluss starten">
            {properties.length === 0 ? (
              <p className="text-sm text-gray-500">
                Keine WEG-Objekte vorhanden. Legen Sie ein Objekt mit Verwaltungsart „WEG“ an,
                um Umlaufbeschlüsse zu starten.
              </p>
            ) : (
              <form action={createResolution} className="space-y-3">
                <Field label="Objekt (WEG)">
                  <select name="propertyId" required className={inputClass}>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Titel">
                  <input type="text" name="title" required minLength={3} className={inputClass} />
                </Field>
                <Field label="Beschlusstext">
                  <textarea name="description" required minLength={3} rows={6} className={inputClass} />
                </Field>
                <Field label="Frist (optional)">
                  <input type="date" name="deadline" className={inputClass} />
                </Field>
                <button type="submit" className={buttonClass}>
                  Abstimmung starten
                </button>
                <p className="text-xs text-gray-500">
                  Alle Eigentümer des Objekts werden per E-Mail zur Abstimmung eingeladen.
                </p>
              </form>
            )}
          </Card>
        ) : (
          <Card title="Hinweis">
            <p className="text-sm text-gray-600">
              Hier stimmen Sie über Umlaufbeschlüsse Ihrer Eigentümergemeinschaft ab. Ihre
              Stimme können Sie bis zum Abschluss der Abstimmung ändern.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
