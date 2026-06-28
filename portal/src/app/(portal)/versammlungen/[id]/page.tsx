import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { canVerwalterAccessProperty, ownedProperties } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, resolutionStatusLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import {
  addAgendaItem,
  cancelMeeting,
  deleteAgendaItem,
  deleteMeeting,
  generateProtocol,
  moveAgendaItem,
  sendInvitation,
  updateAgendaItem,
  updateAttendance,
  updateMeeting,
} from "../actions";

export const dynamic = "force-dynamic";

// Date → Wert für <input type="datetime-local"> (YYYY-MM-DDTHH:MM).
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const statusLabel: Record<string, string> = {
  GEPLANT: "Geplant",
  EINBERUFEN: "Einberufen",
  DURCHGEFUEHRT: "Durchgeführt",
  ABGESAGT: "Abgesagt",
};

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ eingeladen?: string; protokoll?: string; fehler?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { eingeladen, protokoll, fehler } = await searchParams;

  // Mandanten-Wand direkt in der Query (Defense-in-Depth): nur Versammlungen der
  // eigenen Organisation werden überhaupt geladen.
  const meeting = await db.ownersMeeting.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      property: { select: { id: true, name: true, organizationId: true } },
      agendaItems: {
        orderBy: { sortOrder: "asc" },
        include: { resolution: { include: { votes: { select: { choice: true } } } } },
      },
    },
  });
  if (!meeting) notFound();

  // Zugriff: Verwalter im Scope (gleiche Org) oder Eigentümer des Objekts.
  let isVerwalter = false;
  if (user.role === "VERWALTER") {
    if (meeting.organizationId !== user.organizationId) notFound();
    if (!(await canVerwalterAccessProperty(user, meeting.propertyId))) notFound();
    isVerwalter = true;
  } else if (user.role === "EIGENTUEMER") {
    const owned = await ownedProperties(user.id);
    if (!owned.some((p) => p.id === meeting.propertyId)) notFound();
  } else {
    redirect("/dashboard");
  }

  return (
    <>
      <PageTitle
        action={
          <Link href="/versammlungen" className={buttonSecondaryClass}>
            ← Versammlungen
          </Link>
        }
      >
        {meeting.title}
      </PageTitle>

      {eingeladen ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Einladung an {eingeladen} Eigentümer versendet.
        </p>
      ) : null}
      {protokoll ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Protokoll erstellt und für Eigentümer bereitgestellt.
        </p>
      ) : null}
      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Bitte Titel und einen gültigen Termin angeben.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Tagesordnung">
            <p className="mb-3 text-xs text-gray-500">
              {meeting.property.name} · {formatDate(meeting.scheduledAt)}
              {meeting.location ? ` · ${meeting.location}` : ""} ·{" "}
              <span className="font-medium">{statusLabel[meeting.status]}</span>
            </p>

            {meeting.agendaItems.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine Tagesordnungspunkte.</p>
            ) : (
              <ol className="space-y-3">
                {meeting.agendaItems.map((it, i) => (
                  <li key={it.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        TOP {i + 1}: {it.title}
                        {it.type === "BESCHLUSS" ? (
                          <span className="ml-2 rounded-full bg-brand-orange-light px-2 py-0.5 text-xs text-brand-orange-dark">
                            Beschluss
                          </span>
                        ) : null}
                      </span>
                      {isVerwalter ? (
                        <div className="flex items-center gap-2">
                          <form action={moveAgendaItem}>
                            <input type="hidden" name="meetingId" value={meeting.id} />
                            <input type="hidden" name="itemId" value={it.id} />
                            <input type="hidden" name="direction" value="up" />
                            <button
                              type="submit"
                              disabled={i === 0}
                              className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              aria-label="nach oben"
                            >
                              ↑
                            </button>
                          </form>
                          <form action={moveAgendaItem}>
                            <input type="hidden" name="meetingId" value={meeting.id} />
                            <input type="hidden" name="itemId" value={it.id} />
                            <input type="hidden" name="direction" value="down" />
                            <button
                              type="submit"
                              disabled={i === meeting.agendaItems.length - 1}
                              className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              aria-label="nach unten"
                            >
                              ↓
                            </button>
                          </form>
                          <form action={deleteAgendaItem}>
                            <input type="hidden" name="meetingId" value={meeting.id} />
                            <input type="hidden" name="itemId" value={it.id} />
                            <button type="submit" className="text-xs text-red-600 hover:underline">
                              entfernen
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                    {it.description ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{it.description}</p>
                    ) : null}
                    {it.type === "BESCHLUSS" && it.resolution ? (
                      <p className="mt-1 text-xs text-gray-500">
                        Beschluss: <strong>{resolutionStatusLabels[it.resolution.status]}</strong> ·{" "}
                        <Link href="/beschluesse" className="text-brand-green hover:underline">
                          zur Abstimmung
                        </Link>
                      </p>
                    ) : null}
                    {isVerwalter ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                          bearbeiten
                        </summary>
                        <form action={updateAgendaItem} className="mt-2 space-y-2">
                          <input type="hidden" name="meetingId" value={meeting.id} />
                          <input type="hidden" name="itemId" value={it.id} />
                          <input
                            type="text"
                            name="title"
                            defaultValue={it.title}
                            required
                            minLength={2}
                            className={inputClass}
                          />
                          <textarea
                            name="description"
                            defaultValue={it.description ?? ""}
                            rows={2}
                            className={inputClass}
                          />
                          <button type="submit" className="text-xs text-brand-green hover:underline">
                            Speichern
                          </button>
                        </form>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}

            {meeting.protocolDocumentId ? (
              <p className="mt-4 text-sm">
                <a
                  href={`/api/files/dokument/${meeting.protocolDocumentId}`}
                  className="text-brand-green hover:underline"
                >
                  Protokoll (PDF) öffnen
                </a>
              </p>
            ) : null}
          </Card>
        </div>

        {isVerwalter ? (
          <div className="space-y-4">
            <Card title="Tagesordnungspunkt hinzufügen">
              <form action={addAgendaItem} className="space-y-3">
                <input type="hidden" name="meetingId" value={meeting.id} />
                <Field label="Titel">
                  <input type="text" name="title" required minLength={2} className={inputClass} />
                </Field>
                <Field label="Beschreibung (optional)">
                  <textarea name="description" rows={3} className={inputClass} />
                </Field>
                <Field label="Art">
                  <select name="type" defaultValue="INFO" className={inputClass}>
                    <option value="INFO">Zur Information</option>
                    <option value="BESCHLUSS">Beschluss (Abstimmung)</option>
                  </select>
                </Field>
                <button type="submit" className={buttonClass}>
                  Hinzufügen
                </button>
                <p className="text-xs text-gray-500">
                  Beschluss-TOPs erzeugen automatisch eine Abstimmung im Bereich Beschlüsse.
                </p>
              </form>
            </Card>

            <Card title="Eckdaten & Anwesenheit">
              <form action={updateMeeting} className="space-y-3">
                <input type="hidden" name="meetingId" value={meeting.id} />
                <Field label="Titel">
                  <input type="text" name="title" defaultValue={meeting.title} required className={inputClass} />
                </Field>
                <Field label="Termin">
                  <input
                    type="datetime-local"
                    name="scheduledAt"
                    defaultValue={toLocalInput(meeting.scheduledAt)}
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Ort (optional)">
                  <input type="text" name="location" defaultValue={meeting.location ?? ""} className={inputClass} />
                </Field>
                <button type="submit" className={buttonSecondaryClass}>
                  Eckdaten speichern
                </button>
              </form>

              <form action={updateAttendance} className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                <input type="hidden" name="meetingId" value={meeting.id} />
                <Field label="Anwesenheit / Vertretung (fürs Protokoll)">
                  <textarea
                    name="attendanceNote"
                    defaultValue={meeting.attendanceNote ?? ""}
                    rows={2}
                    placeholder="z. B. 5 von 8 Eigentümern anwesend, 1 per Vollmacht vertreten"
                    className={inputClass}
                  />
                </Field>
                <button type="submit" className="text-xs text-brand-green hover:underline">
                  Anwesenheit speichern
                </button>
              </form>
            </Card>

            <Card title="Aktionen">
              <div className="space-y-3">
                <form action={sendInvitation}>
                  <input type="hidden" name="meetingId" value={meeting.id} />
                  <button type="submit" className={`${buttonClass} w-full`}>
                    Einladung an Eigentümer senden
                  </button>
                </form>
                <form action={generateProtocol}>
                  <input type="hidden" name="meetingId" value={meeting.id} />
                  <button type="submit" className={`${buttonSecondaryClass} w-full`}>
                    Protokoll erstellen (PDF)
                  </button>
                </form>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  {meeting.status !== "ABGESAGT" ? (
                    <form action={cancelMeeting}>
                      <input type="hidden" name="meetingId" value={meeting.id} />
                      <button type="submit" className="text-xs text-amber-700 hover:underline">
                        Versammlung absagen
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-gray-400">Abgesagt</span>
                  )}
                  <form action={deleteMeeting}>
                    <input type="hidden" name="meetingId" value={meeting.id} />
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      Löschen
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </>
  );
}
