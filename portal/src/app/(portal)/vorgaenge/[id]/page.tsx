import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  Field,
  PageTitle,
  StatusBadge,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { canViewTicket } from "@/lib/access";
import { db } from "@/lib/db";
import {
  formatDate,
  roleLabels,
  ticketPriorityLabels,
  ticketStatusLabels,
  ticketTypeLabels,
} from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { addComment, setOwnTicketStatus, updateTicket } from "../actions";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      property: true,
      unit: true,
      createdBy: true,
      assignedTo: true,
      attachments: { where: { commentId: null } },
      comments: {
        include: { author: true, attachments: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ticket || !(await canViewTicket(user, ticket))) notFound();

  const isVerwalter = user.role === "VERWALTER";
  const isAssignedHandwerker =
    user.role === "HANDWERKER" && ticket.assignedToId === user.id;
  const comments = ticket.comments.filter((c) => isVerwalter || !c.internal);
  const assignableUsers = isVerwalter
    ? await db.user.findMany({
        where: { role: { in: ["VERWALTER", "HANDWERKER"] }, active: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      })
    : [];

  return (
    <>
      <PageTitle action={<StatusBadge status={ticket.status} />}>
        #{ticket.number} · {ticket.title}
      </PageTitle>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Beschreibung">
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {ticket.description}
            </p>
            {ticket.attachments.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ticket.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={`/api/files/anhang/${a.id}`}
                    target="_blank"
                    className="block overflow-hidden rounded-md border border-gray-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/files/anhang/${a.id}`}
                      alt={a.fileName}
                      className="h-32 w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            ) : null}
          </Card>

          <Card title="Verlauf">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine Kommentare.</p>
            ) : (
              <ul className="space-y-4">
                {comments.map((c) => (
                  <li
                    key={c.id}
                    className={`rounded-md p-3 ${c.internal ? "bg-amber-50" : "bg-gray-50"}`}
                  >
                    <p className="text-xs text-gray-500">
                      {c.author.name} ({roleLabels[c.author.role]}) ·{" "}
                      {formatDate(c.createdAt)}
                      {c.internal ? " · Interne Notiz" : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                      {c.body}
                    </p>
                    {c.attachments.length > 0 ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {c.attachments.map((a) => (
                          <a
                            key={a.id}
                            href={`/api/files/anhang/${a.id}`}
                            target="_blank"
                            className="block overflow-hidden rounded-md border border-gray-200"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/files/anhang/${a.id}`}
                              alt={a.fileName}
                              className="h-24 w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <form action={addComment} className="mt-5 space-y-3">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Field label="Kommentar hinzufügen">
                <textarea
                  name="body"
                  required
                  minLength={1}
                  maxLength={5000}
                  rows={3}
                  className={inputClass}
                />
              </Field>
              <Field label="Fotos anhängen (optional)">
                <input
                  type="file"
                  name="photos"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-orange-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-orange-dark hover:file:bg-orange-100"
                />
              </Field>
              {isVerwalter ? (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="internal" />
                  Interne Notiz (für Mieter/Eigentümer nicht sichtbar)
                </label>
              ) : null}
              <button type="submit" className={buttonClass}>
                Senden
              </button>
            </form>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Details">
            <dl className="space-y-2 text-sm">
              <Detail label="Art" value={ticketTypeLabels[ticket.type]} />
              {ticket.category ? <Detail label="Kategorie" value={ticket.category} /> : null}
              <Detail
                label="Objekt"
                value={`${ticket.property.name}, ${ticket.property.street}, ${ticket.property.zip} ${ticket.property.city}`}
              />
              {ticket.unit ? <Detail label="Einheit" value={ticket.unit.label} /> : null}
              {ticket.location ? <Detail label="Ort" value={ticket.location} /> : null}
              <Detail label="Priorität" value={ticketPriorityLabels[ticket.priority]} />
              <Detail label="Gemeldet von" value={ticket.createdBy.name} />
              <Detail
                label="Zugewiesen an"
                value={ticket.assignedTo?.name ?? "– noch niemand –"}
              />
              <Detail label="Erstellt am" value={formatDate(ticket.createdAt)} />
              <Detail label="Aktualisiert" value={formatDate(ticket.updatedAt)} />
            </dl>
          </Card>

          {isVerwalter ? (
            <Card title="Bearbeiten">
              <form action={updateTicket} className="space-y-3">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <Field label="Status">
                  <select name="status" defaultValue={ticket.status} className={inputClass}>
                    {Object.entries(ticketStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priorität">
                  <select
                    name="priority"
                    defaultValue={ticket.priority}
                    className={inputClass}
                  >
                    {Object.entries(ticketPriorityLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Zugewiesen an">
                  <select
                    name="assignedToId"
                    defaultValue={ticket.assignedToId ?? ""}
                    className={inputClass}
                  >
                    <option value="">– niemand –</option>
                    {assignableUsers.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({roleLabels[v.role]})
                      </option>
                    ))}
                  </select>
                </Field>
                <button type="submit" className={buttonClass}>
                  Speichern
                </button>
              </form>
            </Card>
          ) : null}

          {isAssignedHandwerker ? (
            <Card title="Auftragsstatus melden">
              <div className="flex flex-col gap-2">
                <form action={setOwnTicketStatus}>
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input type="hidden" name="status" value="IN_BEARBEITUNG" />
                  <button type="submit" className={`${buttonClass} w-full`}>
                    Arbeit begonnen
                  </button>
                </form>
                <form action={setOwnTicketStatus}>
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input type="hidden" name="status" value="ERLEDIGT" />
                  <button type="submit" className={`${buttonClass} w-full`}>
                    Auftrag erledigt
                  </button>
                </form>
                <p className="text-xs text-gray-500">
                  Bitte dokumentieren Sie die Ausführung mit Fotos über das
                  Kommentarfeld.
                </p>
              </div>
            </Card>
          ) : null}

          <Link href="/vorgaenge" className="block text-sm text-gray-300 hover:text-brand-orange hover:underline">
            ← Zurück zur Übersicht
          </Link>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}
