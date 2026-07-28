import Link from "next/link";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import { notFound, redirect } from "next/navigation";
import { Alert, Card, EmptyState, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { canVerwalterAccessProperty, ownedProperties } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, formatDateOnly, resolutionStatusLabels } from "@/lib/labels";
import { isMailEnabled } from "@/lib/mailer";
import { requireUser } from "@/lib/session";
import {
  INVITATION_MIN_WEEKS,
  checkInvitationDeadline,
  latestSendDate,
} from "@/lib/weg/meeting-invitation";
import {
  addAgendaFromTemplate,
  addAgendaItem,
  cancelMeeting,
  deleteAgendaItem,
  deleteMeeting,
  generateProtocol,
  markInvitationSent,
  sendInvitation,
  updateAgendaItem,
  updateAttendance,
  updateMeeting,
} from "../actions";

import { TopReihenfolge } from "./TopReihenfolge";
import { VorlagenWahl } from "./VorlagenWahl";
import { FilePreviewLink } from "@/components/file-preview-link";

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
  searchParams: Promise<{ eingeladen?: string; protokoll?: string; fehler?: string; hinweis?: string; markiert?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { eingeladen, protokoll, fehler, hinweis, markiert } = await searchParams;

  // Mandanten-Wand direkt in der Query (Defense-in-Depth): nur Versammlungen der
  // eigenen Organisation werden überhaupt geladen.
  const meeting = await db.ownersMeeting.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      property: { select: { id: true, name: true, organizationId: true } },
      agendaItems: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
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

  // Abgeschlossen (durchgeführt/abgesagt) → Tagesordnung & Einladung eingefroren.
  const closed = meeting.status === "DURCHGEFUEHRT" || meeting.status === "ABGESAGT";
  const canEditAgenda = isVerwalter && !closed;

  // Empfänger (für den Einzel-PDF-Download) und Fristenrechner nur für Verwalter.
  const owners = isVerwalter
    ? await db.ownership.findMany({
        where: { propertyId: meeting.propertyId },
        select: { user: { select: { id: true, name: true } } },
        orderBy: { user: { name: "asc" } },
      })
    : [];
  // Fristenrechner: gerechnet ab dem Versanddatum (falls schon versendet), sonst
  // ab heute (= „wenn ich jetzt einlade"). Mindestfrist 3 Wochen (§ 24 IV WEG).
  const referenceSendDate = meeting.invitationSentAt ?? new Date();
  const deadline = checkInvitationDeadline(meeting.scheduledAt, referenceSendDate);
  const latestSend = latestSendDate(meeting.scheduledAt);

  return (
    <>
      <PageTitle
        back={{ href: "/versammlungen", label: "Versammlungen" }}
      >
        {meeting.title}
      </PageTitle>

      {eingeladen ? (
        <Alert variant="success" className="mb-4">
          Einladung an {eingeladen} Eigentümer versendet.
        </Alert>
      ) : null}
      {markiert ? (
        <Alert variant="success" className="mb-4">
          Einladung als versendet markiert – das Versanddatum ({formatDateOnly(new Date())}) ist gesetzt.
        </Alert>
      ) : null}
      {protokoll ? (
        <Alert variant="success" className="mb-4">
          Protokoll erstellt und für Eigentümer bereitgestellt.
        </Alert>
      ) : null}
      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "gesperrt"
            ? "Die Versammlung ist abgeschlossen – Tagesordnung und Einladung sind gesperrt."
            : fehler === "abgesagt"
              ? "Für eine abgesagte Versammlung kann kein Protokoll erstellt werden."
              : fehler === "durchgefuehrt"
                ? "Eine durchgeführte Versammlung kann nicht geändert oder abgesagt werden."
                : fehler === "protokoll"
                  ? "Das Protokoll konnte nicht erstellt werden. Bitte erneut versuchen."
                  : fehler === "gerade_versendet"
                    ? "Die Einladung wurde gerade erst versendet – bitte kurz warten, bevor Sie erneut senden."
                    : "Bitte Titel und einen gültigen Termin angeben."}
        </Alert>
      ) : null}
      {hinweis === "neuterminieren" ? (
        <Alert variant="warning" className="mb-4">
          Termin geändert – bitte die Einladung erneut an die Eigentümer senden.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Tagesordnung">
            <p className="mb-3 text-xs text-gray-500">
              {meeting.property.name} · {formatDate(meeting.scheduledAt)}
              {meeting.location ? ` · ${meeting.location}` : ""} ·{" "}
              <span className="font-medium">{statusLabel[meeting.status]}</span>
            </p>
            {meeting.videoLink ? (
              <p className="mb-3 text-xs text-gray-500">
                Video-Zuschaltung:{" "}
                <span className="break-all text-gray-700">{meeting.videoLink}</span>
              </p>
            ) : null}

            {meeting.agendaItems.length === 0 ? (
              <EmptyState>Noch keine Tagesordnungspunkte.</EmptyState>
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
                      {canEditAgenda ? (
                        <div className="flex items-center gap-2">
                          <form action={deleteAgendaItem}>
                            <input type="hidden" name="meetingId" value={meeting.id} />
                            <input type="hidden" name="itemId" value={it.id} />
                            <ConfirmActionButton
                              className="text-xs text-red-600 hover:underline"
                              confirmLabel="Wirklich entfernen?"
                              pendingLabel="Wird entfernt…"
                            >
                              entfernen
                            </ConfirmActionButton>
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
                    {canEditAgenda ? (
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
                          <PendingButton className="text-xs text-brand-green hover:underline">Speichern</PendingButton>
                        </form>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}

            {/* Sortieren in einer eigenen, schmalen Liste statt an den Zeilen
                selbst: Die tragen verschachtelte Formulare (bearbeiten,
                entfernen, abstimmen), an denen sich nicht ziehen lässt. */}
            {canEditAgenda && meeting.agendaItems.length > 1 ? (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Reihenfolge
                </p>
                <TopReihenfolge
                  meetingId={meeting.id}
                  items={meeting.agendaItems.map((it) => ({ id: it.id, title: it.title }))}
                />
              </div>
            ) : null}

            {meeting.protocolDocumentId ? (
              <p className="mt-4 text-sm">
                <FilePreviewLink
                  src={`/api/files/dokument/${meeting.protocolDocumentId}`}
                  title={`Protokoll — ${meeting.title}`}
                  className="text-brand-green hover:underline"
                >
                  Protokoll (PDF) öffnen
                </FilePreviewLink>
              </p>
            ) : null}
          </Card>
        </div>

        {isVerwalter ? (
          <div className="space-y-4">
            {closed ? (
              <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Diese Versammlung ist {statusLabel[meeting.status].toLowerCase()} – Tagesordnung
                und Einladung sind gesperrt.
              </p>
            ) : null}
            {canEditAgenda ? (
            <Card title="Tagesordnungspunkt hinzufügen">
              <form action={addAgendaFromTemplate} className="mb-4 space-y-2 border-b border-gray-100 pb-4">
                <input type="hidden" name="meetingId" value={meeting.id} />
                <VorlagenWahl />
                <PendingButton className={buttonSecondaryClass}>Vorlage übernehmen</PendingButton>
                <p className="text-xs text-gray-500">
                  Übernimmt den oben gezeigten TOP inkl. Beschlussvorschlag; danach frei
                  anpassbar.
                </p>
              </form>
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
                <PendingButton className={buttonClass}>Hinzufügen</PendingButton>
                <p className="text-xs text-gray-500">
                  Beschluss-TOPs erzeugen automatisch eine Abstimmung im Bereich Beschlüsse.
                </p>
              </form>
            </Card>
            ) : null}

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
                <Field label="Ort">
                  <input
                    type="text"
                    name="location"
                    required
                    defaultValue={meeting.location ?? ""}
                    placeholder="z. B. Gemeindesaal, Musterstr. 1 – oder Online / Videokonferenz"
                    className={inputClass}
                  />
                </Field>
                <Field label="Link zur Video-Zuschaltung (optional)">
                  <input
                    type="text"
                    name="videoLink"
                    defaultValue={meeting.videoLink ?? ""}
                    placeholder="nur Abdruck in der Einladung – kein Streaming/keine Live-Abstimmung"
                    className={inputClass}
                  />
                </Field>
                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input type="checkbox" name="saveVideoDefault" className="mt-0.5" />
                  <span>Link als Standard für dieses Objekt speichern (künftige Versammlungen).</span>
                </label>
                <PendingButton className={buttonSecondaryClass}>Eckdaten speichern</PendingButton>
              </form>

              <form action={updateAttendance} className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                <input type="hidden" name="meetingId" value={meeting.id} />
                <Field label="Anwesenheit / Vertretung (fürs Protokoll)">
                  <textarea
                    name="attendanceNote"
                    defaultValue={meeting.attendanceNote ?? ""}
                    rows={2}
                    placeholder="z. B. 4 in Präsenz, 2 online zugeschaltet (§ 23 Abs. 1a WEG), 1 per Vollmacht vertreten"
                    className={inputClass}
                  />
                </Field>
                <PendingButton className="text-xs text-brand-green hover:underline">Anwesenheit speichern</PendingButton>
              </form>
            </Card>

            {!closed ? (
              <Card title="Einladung & Fristen">
                {/* Fristenrechner: warnt bei Unterschreitung der 3-Wochen-Frist. */}
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    deadline.meets
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-red-300 bg-red-50 text-red-800"
                  }`}
                >
                  {meeting.invitationSentAt ? (
                    <p className="font-medium">
                      Versendet am {formatDateOnly(meeting.invitationSentAt)} · {deadline.leadDays} Tage bis
                      zur Versammlung.
                    </p>
                  ) : (
                    <p className="font-medium">
                      Bei Versand heute: {deadline.leadDays} Tage bis zur Versammlung.
                    </p>
                  )}
                  {deadline.meets ? (
                    <p className="mt-1 text-xs">
                      Mindestladefrist von {INVITATION_MIN_WEEKS} Wochen (§ 24 Abs. 4 WEG) gewahrt.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs">
                      ⚠ Ladefrist von {INVITATION_MIN_WEEKS} Wochen unterschritten (es fehlen{" "}
                      {deadline.shortfallDays} Tag(e)). Spätestes Versanddatum:{" "}
                      {formatDateOnly(latestSend)}. Ein Beschluss kann bei zu kurzer Ladung
                      anfechtbar sein.
                    </p>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {/* Einladungs-PDF (Vorlage + je Empfänger) – Zero-Key-Selbstdruck. */}
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-600">Einladungs-PDF</p>
                    <FilePreviewLink
                      src={`/versammlungen/${meeting.id}/einladung/pdf`}
                      title={`Einladung — ${meeting.title}`}
                      className={`${buttonSecondaryClass} w-full justify-center`}
                    >
                      PDF „An alle Eigentümer&ldquo;
                    </FilePreviewLink>
                    {owners.length > 0 ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                          Einzeln je Empfänger ({owners.length})
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {owners.map((o) => (
                            <li key={o.user.id}>
                              <a
                                href={`/versammlungen/${meeting.id}/einladung/pdf?owner=${o.user.id}`}
                                target="_blank"
                                rel="noopener"
                                className="text-sm text-brand-green hover:underline"
                              >
                                {o.user.name} – PDF
                              </a>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>

                  {/* Versand per E-Mail-Adapter ODER „als versendet markieren". */}
                  {isMailEnabled() ? (
                    <form action={sendInvitation}>
                      <input type="hidden" name="meetingId" value={meeting.id} />
                      <button type="submit" className={`${buttonClass} w-full`}>
                        {meeting.invitationSentAt
                          ? "Einladung erneut per E-Mail senden"
                          : "Einladung per E-Mail senden"}
                      </button>
                    </form>
                  ) : (
                    <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
                      Kein E-Mail-Versand eingerichtet – bitte die PDFs herunterladen, versenden
                      und anschließend „als versendet markieren&ldquo;.
                    </p>
                  )}
                  <form action={markInvitationSent}>
                    <input type="hidden" name="meetingId" value={meeting.id} />
                    <button type="submit" className={`${buttonSecondaryClass} w-full`}>
                      {meeting.invitationSentAt
                        ? "Versanddatum aktualisieren"
                        : "Als versendet markieren"}
                    </button>
                  </form>
                </div>
              </Card>
            ) : null}

            <Card title="Aktionen">
              <div className="space-y-3">
                {/* Protokoll nicht für abgesagte Versammlungen. */}
                {meeting.status !== "ABGESAGT" ? (
                  <form action={generateProtocol}>
                    <input type="hidden" name="meetingId" value={meeting.id} />
                    <button type="submit" className={`${buttonSecondaryClass} w-full`}>
                      {meeting.protocolDocumentId ? "Protokoll neu erstellen (PDF)" : "Protokoll erstellen (PDF)"}
                    </button>
                  </form>
                ) : null}
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  {meeting.status === "GEPLANT" || meeting.status === "EINBERUFEN" ? (
                    <form action={cancelMeeting}>
                      <input type="hidden" name="meetingId" value={meeting.id} />
                      <ConfirmActionButton
                        className="text-xs text-amber-700 hover:underline"
                        confirmLabel="Wirklich absagen?"
                        pendingLabel="Wird ausgeführt…"
                      >
                        Versammlung absagen
                      </ConfirmActionButton>
                    </form>
                  ) : (
                    <span className="text-xs text-gray-400">{statusLabel[meeting.status]}</span>
                  )}
                  <form action={deleteMeeting}>
                    <input type="hidden" name="meetingId" value={meeting.id} />
                    <ConfirmActionButton
                      className="text-xs text-red-600 hover:underline"
                      confirmLabel="Wirklich löschen?"
                      pendingLabel="Wird gelöscht…"
                    >
                      Löschen
                    </ConfirmActionButton>
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
