import type { ReactNode } from "react";
import { AblageAlert } from "@/components/ablage-alert";
import { FileInput } from "@/components/file-input";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import { ComboField } from "@/components/combo-field";
import { SelectMitSonstiges } from "@/components/select-sonstiges";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageSquare, Phone } from "lucide-react";
import {
  Alert,
  Card,
  CollapsibleCard,
  EmptyState,
  Field,
  PageTitle,
  StatusBadge,
  buttonClass,
  buttonDangerClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { Badge } from "@/components/data-display";
import {
  canViewTicket,
  craftsmanWhereForVerwalter,
  propertyWhereForVerwalter,
  userWhereForVerwalter,
} from "@/lib/access";
import { loadUnitsForProperty, type UnitOption } from "@/app/(portal)/unit-options";
import type { Prisma } from "@/generated/prisma/client";
import { supportedCertificate } from "@/lib/documents/bescheinigungen";
import { db } from "@/lib/db";
import {
  contactMethodLabels,
  documentCategoryLabels,
  formatDate,
  roleLabels,
  ticketPriorityLabels,
  ticketStatusLabels,
  ticketTypeLabels,
  tradeLabels,
} from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { requireUser } from "@/lib/session";
import {
  acceptInvoice,
  addComment,
  assignCraftsman,
  confirmAppointment,
  confirmCompletion,
  declineAppointment,
  deleteTicket,
  releaseExternalCraftsman,
  generateCertificate,
  notifyCraftsman,
  rejectInvoice,
  reopenTicket,
  reportCompletion,
  setOwnTicketStatus,
  updateTicket,
  uploadRequestedDocument,
} from "../actions";
import { AssignTargetPicker } from "./assign-target-picker";
import { FilePreviewLink } from "@/components/file-preview-link";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    beauftragt?: string;
    bereitgestellt?: string;
    zugeordnet?: string;
    freigegeben?: string;
    termin?: string;
    abschluss?: string;
    fehler?: string;
    msg?: string;
    /** `fehler`: was schiefging; `ablage=fehler`: es lag an der Dateiablage. */
    ablage?: string;
    /** Bei `fehler=ablage`/`dateien`: Grund im Klartext (`ablageFehlerText`). */
    grund?: string;
  }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const {
    beauftragt,
    bereitgestellt,
    zugeordnet,
    freigegeben,
    termin,
    abschluss,
    fehler,
    msg,
    ablage,
    grund,
  } = await searchParams;

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      property: true,
      unit: true,
      createdBy: true,
      assignedTo: true,
      craftsman: true,
      invoice: true,
      attachments: { where: { commentId: null } },
      comments: {
        include: { author: true, craftsmanAuthor: true, attachments: true },
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
        // Nur Verwalter/Handwerker der EIGENEN Org als Zuweisungs-Kandidaten.
        where: {
          role: { in: ["VERWALTER", "HANDWERKER"] },
          active: true,
          organizationId: user.organizationId,
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      })
    : [];
  // Handwerker für die Zuordnung. Interne (Eigenleistung) werden zuerst angeboten;
  // bei den externen kommt das passende Gewerk vor den übrigen.
  const craftsmen = isVerwalter
    ? await db.craftsman.findMany({
        where: { active: true, ...(await craftsmanWhereForVerwalter(user)) },
        orderBy: [{ isInternal: "desc" }, { trade: "asc" }, { name: "asc" }],
      })
    : [];
  const internal = craftsmen.filter((c) => c.isInternal);
  const external = craftsmen.filter((c) => !c.isInternal);
  const suggested = ticket.trade ? external.filter((c) => c.trade === ticket.trade) : [];
  const others = ticket.trade ? external.filter((c) => c.trade !== ticket.trade) : external;

  // Nicht zugeordneter Vorgang (z. B. von unbekanntem E-Mail-Absender): Zuordnung + Vorschlag.
  // Nur die Objektliste laden; Einheiten kommen on demand. Für den Vorschlag werden
  // die Einheiten des vorgeschlagenen Objekts vorab serverseitig geladen.
  const needsAssignment = isVerwalter && !ticket.propertyId;
  const assignProperties = needsAssignment
    ? await db.property.findMany({
        where: await propertyWhereForVerwalter(user),
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  const assignSuggestion = needsAssignment ? await suggestTarget(user, ticket) : null;
  const suggestedPropertyId = assignSuggestion ? assignSuggestion.target.split("|")[0] : "";
  const suggestedUnits: UnitOption[] = suggestedPropertyId
    ? await loadUnitsForProperty(suggestedPropertyId)
    : [];
  // Zeitpunkt einmal beim Rendern bestimmen (kein Date.now() direkt im JSX).
  const now = new Date().getTime();

  return (
    <>
      <PageTitle
        back={{ href: "/vorgaenge", label: "Vorgänge" }}
        action={<StatusBadge status={ticket.status} />}
      >
        #{ticket.number} · {ticket.title}
      </PageTitle>

      {beauftragt ? (
        <Alert variant="success" className="mb-4">
          Der Handwerker wurde per E-Mail beauftragt.
        </Alert>
      ) : null}
      {bereitgestellt ? (
        <Alert variant="success" className="mb-4">
          Dokument hochgeladen und für den Anfragenden bereitgestellt. Der Vorgang wurde
          als erledigt markiert.
        </Alert>
      ) : null}
      {zugeordnet ? (
        <Alert variant="success" className="mb-4">
          Vorgang wurde dem Objekt/der Einheit zugeordnet.
        </Alert>
      ) : null}
      {freigegeben ? (
        <Alert variant="success" className="mb-4">
          Externe Beauftragung freigegeben. Sie können den externen Handwerker jetzt
          beauftragen.
        </Alert>
      ) : null}
      {termin === "bestaetigt" ? (
        <Alert variant="success" className="mb-4">
          Termin bestätigt. Der Handwerker wurde informiert.
        </Alert>
      ) : null}
      {termin === "abgelehnt" ? (
        <Alert variant="warning" className="mb-4">
          Terminvorschlag abgelehnt. Der Handwerker wurde um einen neuen Termin gebeten.
        </Alert>
      ) : null}
      {abschluss === "gemeldet" ? (
        <Alert variant="warning" className="mb-4">
          Erledigung dokumentiert. Der Vorgang wartet jetzt auf Ihre Abschluss-Bestätigung.
        </Alert>
      ) : null}
      {abschluss === "bestaetigt" ? (
        <Alert variant="success" className="mb-4">
          Abschluss bestätigt – der Vorgang ist geschlossen.
        </Alert>
      ) : null}
      {abschluss === "geoeffnet" ? (
        <Alert variant="warning" className="mb-4">
          Vorgang wieder geöffnet. Der Handwerker wurde über die Nacharbeit informiert.
        </Alert>
      ) : null}
      {fehler === "freigabe" ? (
        <Alert variant="warning" className="mb-4">
          Externe Handwerker dürfen erst nach Freigabe beauftragt werden. Bitte zuerst
          prüfen, ob die Arbeit intern (Eigenleistung) erledigt werden kann, und dann
          „Externe Beauftragung freigeben“ wählen.
        </Alert>
      ) : null}
      {fehler === "keine_email" ? (
        <Alert variant="error" className="mb-4">
          Für diesen Handwerker ist keine E-Mail-Adresse hinterlegt. Bitte im Kontaktbuch
          ergänzen oder telefonisch beauftragen.
        </Alert>
      ) : null}
      {/* Die Ablage nennt ihren Grund selbst — der Vorgang bleibt bestehen, der
          Knopf lässt sich unmittelbar erneut betätigen. */}
      {fehler === "ablage" ? (
        <AblageAlert grund={grund}>
          Der Vorgang ist unverändert — bitte erneut versuchen.
        </AblageAlert>
      ) : null}
      {ablage === "fehler" ? (
        <AblageAlert titel="Die Fotos wurden nicht abgelegt." grund={grund}>
          Der Kommentar wurde deshalb nicht gespeichert — bitte erneut absenden.
        </AblageAlert>
      ) : fehler === "dateien" ? (
        <Alert variant="error" className="mb-4">
          Bitte nur Bilder oder Videos bis 100 MB anhängen, höchstens zehn Stück.
        </Alert>
      ) : null}
      {fehler === "datei" || fehler === "titel" ? (
        <Alert variant="error" className="mb-4">
          {fehler === "datei"
            ? "Bitte eine gültige Datei (PDF, Bild oder Video, max. 100 MB) wählen."
            : "Bitte einen Titel für das Dokument angeben."}
        </Alert>
      ) : null}
      {fehler === "vollmacht" ? (
        <Alert variant="warning" className="mb-4">
          Der Eigentümer hat noch keine Vollmacht erteilt. Bescheinigungen dürfen nur mit
          seiner Ermächtigung in seinem Namen erstellt werden (§ 19 Abs. 5 BMG). Der
          Eigentümer erteilt sie selbst im Portal unter &bdquo;Konto → Unterschrift &amp;
          Vollmacht&ldquo;. Alternativ ein unterschriebenes Dokument hochladen.
        </Alert>
      ) : null}
      {fehler === "keine_vermietung" ? (
        <Alert variant="warning" className="mb-4">
          Für diese Einheit ist kein aktives Mietverhältnis hinterlegt. Eine
          Wohnungsgeber- oder Mietbescheinigung setzt eine Vermietung voraus – bitte
          zuerst das Mietverhältnis erfassen.
        </Alert>
      ) : null}
      {fehler === "cert" ? (
        <Alert variant="error" className="mb-4">
          Die Bescheinigung konnte nicht automatisch erstellt werden. Bitte prüfen Sie, ob
          dem Vorgang ein Objekt zugeordnet ist.
          {msg ? <span className="mt-1 block text-xs text-red-500">Details: {msg}</span> : null}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Beschreibung">
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {ticket.description}
            </p>
            {ticket.attachments.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ticket.attachments.map((a) =>
                  a.mimeType.startsWith("video/") ? (
                    <div key={a.id} className="overflow-hidden rounded-md border border-gray-200">
                      <video
                        src={`/api/files/anhang/${a.id}`}
                        controls
                        preload="metadata"
                        className="h-32 w-full object-cover"
                      />
                    </div>
                  ) : (
                    <FilePreviewLink
                      key={a.id}
                      src={`/api/files/anhang/${a.id}`}
                      title={a.fileName}
                      className="block overflow-hidden rounded-md border border-gray-200"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/files/anhang/${a.id}`}
                        alt={a.fileName}
                        className="h-32 w-full object-cover"
                      />
                    </FilePreviewLink>
                  )
                )}
              </div>
            ) : null}
          </Card>

          <Card title="Verlauf">
            {comments.length === 0 ? (
              <EmptyState>Noch keine Kommentare.</EmptyState>
            ) : (
              <ul className="space-y-4">
                {comments.map((c) => (
                  <li
                    key={c.id}
                    className={`rounded-md p-3 ${c.internal ? "bg-amber-50" : "bg-gray-50"}`}
                  >
                    <p className="text-xs text-gray-500">
                      {c.author
                        ? `${c.author.name} (${roleLabels[c.author.role]})`
                        : c.craftsmanAuthor
                          ? `${c.craftsmanAuthor.name} (Handwerker)`
                          : "System"}{" "}
                      · {formatDate(c.createdAt)}
                      {c.internal ? " · Interne Notiz" : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                      {c.body}
                    </p>
                    {c.attachments.length > 0 ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {c.attachments.map((a) =>
                          a.mimeType.startsWith("video/") ? (
                            <div key={a.id} className="overflow-hidden rounded-md border border-gray-200">
                              <video
                                src={`/api/files/anhang/${a.id}`}
                                controls
                                preload="metadata"
                                className="h-24 w-full object-cover"
                              />
                            </div>
                          ) : (
                            <FilePreviewLink
                              key={a.id}
                              src={`/api/files/anhang/${a.id}`}
                              title={a.fileName}
                              className="block overflow-hidden rounded-md border border-gray-200"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/files/anhang/${a.id}`}
                                alt={a.fileName}
                                className="h-24 w-full object-cover"
                              />
                            </FilePreviewLink>
                          )
                        )}
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
              <Field label="Fotos / Videos anhängen (optional)">
                <FileInput
                  name="photos"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
                />
              </Field>
              {isVerwalter ? (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="internal" />
                  Interne Notiz (für Mieter/Eigentümer nicht sichtbar)
                </label>
              ) : null}
              <PendingButton className={buttonClass}>Senden</PendingButton>
            </form>
          </Card>
        </div>

        <div className="space-y-5">
          {needsAssignment ? (
            <Card title="Vorgang zuordnen">
              {ticket.senderEmail ? (
                <p className="mb-3 text-xs text-gray-500">
                  Eingegangen per E-Mail von{" "}
                  {ticket.senderName ? `${ticket.senderName} ` : ""}
                  &lt;{ticket.senderEmail}&gt; – dieser Absender ist noch keinem Nutzer
                  zugeordnet.
                </p>
              ) : null}
              {assignSuggestion ? (
                <p className="mb-3 rounded-md bg-brand-orange-light px-3 py-2 text-xs text-brand-green-dark">
                  Vorschlag: <strong>{assignSuggestion.label}</strong>
                </p>
              ) : null}
              <AssignTargetPicker
                ticketId={ticket.id}
                properties={assignProperties}
                initialPropertyId={suggestedPropertyId}
                initialTarget={assignSuggestion?.target ?? ""}
                initialUnits={suggestedUnits}
              />
            </Card>
          ) : null}

          <Card title="Details">
            <dl className="space-y-2 text-sm">
              <Detail label="Art" value={ticketTypeLabels[ticket.type]} />
              {ticket.category ? <Detail label="Kategorie" value={ticket.category} /> : null}
              <Detail
                label="Objekt"
                value={
                  ticket.property
                    ? `${ticket.property.name}, ${ticket.property.street}, ${ticket.property.zip} ${ticket.property.city}`
                    : "– noch nicht zugeordnet –"
                }
              />
              {ticket.unit ? <Detail label="Einheit" value={ticket.unit.label} /> : null}
              {ticket.location ? <Detail label="Ort" value={ticket.location} /> : null}
              {ticket.trade ? <Detail label="Gewerk" value={tradeLabels[ticket.trade]} /> : null}
              <Detail label="Priorität" value={ticketPriorityLabels[ticket.priority]} />
              {isVerwalter && ticket.dueAt && ticket.status !== "GESCHLOSSEN" ? (
                <Detail
                  label="Fällig bis"
                  value={
                    <span
                      className={
                        ticket.dueAt.getTime() < now
                          ? "font-semibold text-red-600"
                          : ""
                      }
                    >
                      {formatDate(ticket.dueAt)}
                      {ticket.dueAt.getTime() < now ? " · überfällig" : ""}
                    </span>
                  }
                />
              ) : null}
              {isVerwalter && (ticket.costCents != null || ticket.costNote) ? (
                <Detail
                  label="Kosten"
                  value={
                    <>
                      {ticket.costCents != null ? formatCents(ticket.costCents) : ""}
                      {ticket.costCents != null && ticket.costNote ? " · " : ""}
                      {ticket.costNote ?? ""}
                    </>
                  }
                />
              ) : null}
              <Detail
                label="Gemeldet von"
                value={
                  ticket.senderEmail
                    ? `${ticket.senderName ? `${ticket.senderName} ` : ""}<${ticket.senderEmail}> · per E-Mail`
                    : ticket.createdBy.name
                }
              />
              <Detail
                label="Zugewiesen an"
                value={ticket.assignedTo?.name ?? "– noch niemand –"}
              />
              {ticket.craftsman ? (
                <Detail
                  label="Handwerker"
                  value={
                    (ticket.craftsman.company ? `${ticket.craftsman.company} / ` : "") +
                    `${ticket.craftsman.name} (${tradeLabels[ticket.craftsman.trade]})`
                  }
                />
              ) : null}
              <Detail label="Erstellt am" value={formatDate(ticket.createdAt)} />
              <Detail label="Aktualisiert" value={formatDate(ticket.updatedAt)} />
            </dl>
          </Card>

          {isVerwalter ? (
            <CollapsibleCard title="Bearbeiten">
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
                <ComboField
                  label="Zugewiesen an"
                  name="assignedToId"
                  defaultValue={ticket.assignedToId ?? ""}
                  placeholder="Person suchen …"
                  clearOption="– niemand –"
                  options={assignableUsers.map((v) => ({
                    value: v.id,
                    label: v.name,
                    sublabel: roleLabels[v.role],
                  }))}
                />
                <Field label="Kosten (optional, €)">
                  <input
                    type="text"
                    name="cost"
                    inputMode="decimal"
                    defaultValue={
                      ticket.costCents != null
                        ? (ticket.costCents / 100).toFixed(2).replace(".", ",")
                        : ""
                    }
                    placeholder="z. B. 480,00"
                    className={inputClass}
                  />
                </Field>
                <Field label="Kostennotiz (optional)">
                  <input
                    type="text"
                    name="costNote"
                    defaultValue={ticket.costNote ?? ""}
                    placeholder="z. B. Sanitär GmbH, netto"
                    maxLength={300}
                    className={inputClass}
                  />
                </Field>
                <PendingButton className={buttonClass}>Speichern</PendingButton>
              </form>
            </CollapsibleCard>
          ) : null}

          {isVerwalter && user.isSuperAdmin ? (
            <CollapsibleCard title="Vorgang löschen">
              <p className="mb-2 text-xs text-gray-500">
                Endgültiges Löschen (mit Kommentaren, Anhängen und Rechnung) – nur für Test-/
                Fehleinträge. Der Regelweg ist „Schließen“: ein geschlossener Vorgang bleibt als
                Beleg erhalten.
              </p>
              <form action={deleteTicket}>
                <input type="hidden" name="ticketId" value={ticket.id} />
                <ConfirmActionButton
                  className={`${buttonDangerClass} w-full`}
                  confirmLabel="Wirklich löschen?"
                  pendingLabel="Wird gelöscht…"
                >
                  Vorgang endgültig löschen
                </ConfirmActionButton>
              </form>
            </CollapsibleCard>
          ) : null}

          {isVerwalter && ticket.invoice ? (
            <CollapsibleCard
              title="Handwerker-Rechnung"
              defaultOpen={ticket.invoice.status === "EINGEREICHT"}
            >
              <div className="space-y-2">
                <p className="text-sm text-gray-800">
                  <span className="font-semibold">{formatCents(ticket.invoice.amountCents)}</span>
                  {ticket.invoice.invoiceNumber ? ` · Nr. ${ticket.invoice.invoiceNumber}` : ""}
                  {ticket.invoice.invoiceDate ? ` · ${formatDate(ticket.invoice.invoiceDate)}` : ""}
                </p>
                {ticket.invoice.note ? <p className="text-xs text-gray-500">{ticket.invoice.note}</p> : null}
                <FilePreviewLink
                  src={`/api/files/rechnung/${ticket.invoice.id}`}
                  title="Handwerker-Rechnung"
                  className="inline-block text-sm text-brand-green underline"
                >
                  Rechnungsdatei öffnen
                </FilePreviewLink>
                {ticket.invoice.status === "EINGEREICHT" ? (
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    <form action={acceptInvoice}>
                      <input type="hidden" name="ticketId" value={ticket.id} />
                      <PendingButton className={`${buttonClass} w-full`}>Rechnung akzeptieren &amp; als Kosten übernehmen</PendingButton>
                    </form>
                    <form action={rejectInvoice} className="space-y-2">
                      <input type="hidden" name="ticketId" value={ticket.id} />
                      <textarea name="reason" rows={2} placeholder="Ablehnungsgrund (optional) …" className={inputClass} />
                      <PendingButton className={`${buttonDangerClass} w-full`}>Rechnung ablehnen</PendingButton>
                    </form>
                  </div>
                ) : (
                  <Badge tone={ticket.invoice.status === "AKZEPTIERT" ? "success" : "danger"}>
                    {ticket.invoice.status === "AKZEPTIERT"
                      ? "akzeptiert und als Kosten übernommen"
                      : "abgelehnt"}
                  </Badge>
                )}
              </div>
            </CollapsibleCard>
          ) : null}

          {isVerwalter && ticket.type !== "DOKUMENT_ANFRAGE" ? (
            <CollapsibleCard
              title="Abschluss"
              defaultOpen={ticket.status === "ERLEDIGT" || ticket.status === "GESCHLOSSEN"}
            >
              {ticket.status === "GESCHLOSSEN" ? (
                <div className="space-y-3">
                  <Alert variant="success" title="Abschluss bestätigt">
                    {ticket.closedAt ? `geschlossen am ${formatDate(ticket.closedAt)}` : null}
                  </Alert>
                  <form action={reopenTicket} className="space-y-2">
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <textarea
                      name="note"
                      rows={2}
                      placeholder="Grund der Wiedereröffnung (optional) …"
                      className={inputClass}
                    />
                    <PendingButton className={`${buttonSecondaryClass} w-full`}>Vorgang wieder öffnen</PendingButton>
                  </form>
                </div>
              ) : ticket.status === "ERLEDIGT" ? (
                <div className="space-y-3">
                  <Alert variant="warning" title="Erledigung gemeldet – bitte prüfen und abnehmen">
                    {ticket.completionReportedVia ? `Kanal: ${ticket.completionReportedVia}` : ""}
                    {ticket.completionReportedAt
                      ? `${ticket.completionReportedVia ? " · " : ""}gemeldet am ${formatDate(ticket.completionReportedAt)}`
                      : ""}
                  </Alert>
                  <form action={confirmCompletion}>
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <PendingButton className={`${buttonClass} w-full`}>Abschluss bestätigen &amp; schließen</PendingButton>
                  </form>
                  <form action={reopenTicket} className="space-y-2 border-t border-gray-100 pt-3">
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <textarea
                      name="note"
                      rows={2}
                      placeholder="Was muss nachgearbeitet werden? (optional) …"
                      className={inputClass}
                    />
                    <PendingButton className={`${buttonSecondaryClass} w-full`}>Nacharbeit nötig – wieder öffnen</PendingButton>
                  </form>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Hat der Handwerker die Erledigung gemeldet (z. B. telefonisch oder per
                    WhatsApp)? Hier dokumentieren – der Vorgang wartet danach auf Ihre
                    Abschluss-Bestätigung.
                  </p>
                  <form action={reportCompletion} className="space-y-2">
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <Field label="Gemeldet über">
                      <select name="via" defaultValue="Telefon" className={inputClass}>
                        <option value="Telefon">Telefon</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="E-Mail">E-Mail</option>
                        <option value="persönlich">persönlich</option>
                      </select>
                    </Field>
                    <textarea
                      name="note"
                      rows={2}
                      placeholder="Notiz zur Erledigung (optional) …"
                      className={inputClass}
                    />
                    <PendingButton className={`${buttonClass} w-full`}>Erledigung melden</PendingButton>
                  </form>
                  <form action={confirmCompletion} className="border-t border-gray-100 pt-3">
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <PendingButton className={`${buttonSecondaryClass} w-full`}>Direkt als erledigt abschließen</PendingButton>
                  </form>
                </div>
              )}
            </CollapsibleCard>
          ) : null}

          {isVerwalter && ticket.type === "DOKUMENT_ANFRAGE" ? (
            <Card title="Dokument bereitstellen">
              {supportedCertificate(ticket.title) ? (
                <div className="mb-4 rounded-lg border border-brand-orange/40 bg-brand-orange-light p-3">
                  <p className="mb-2 text-xs text-brand-green-dark">
                    Diese Bescheinigung kann <strong>automatisch</strong> aus den hinterlegten
                    Daten erstellt werden. Voraussetzung: Der Eigentümer hat die Vollmacht
                    erteilt und die Einheit ist vermietet.
                  </p>
                  <form action={generateCertificate}>
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <button type="submit" className={`${buttonClass} w-full`}>
                      {supportedCertificate(ticket.title) === "wohnungsgeber"
                        ? "Wohnungsgeberbescheinigung"
                        : "Mietbescheinigung"}{" "}
                      automatisch erstellen
                    </button>
                  </form>
                </div>
              ) : null}
              <p className="mb-3 text-xs text-gray-500">
                … oder ein vorhandenes Dokument hochladen — es wird automatisch für{" "}
                {ticket.createdBy.name} unter „Dokumente“ sichtbar und der Vorgang
                als erledigt markiert.
              </p>
              <form action={uploadRequestedDocument} className="space-y-3">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <Field label="Titel">
                  <input
                    type="text"
                    name="title"
                    required
                    defaultValue={
                      ticket.title.replace(/^Dokumentanforderung:\s*/i, "").trim() ||
                      ticket.title
                    }
                    className={inputClass}
                  />
                </Field>
                <SelectMitSonstiges
                  label="Kategorie"
                  name="category"
                  defaultValue="BESCHEINIGUNG"
                  options={Object.entries(documentCategoryLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  freitextName="categoryOther"
                  freitextLabel="Welche Art Dokument?"
                />
                <Field label="Datei (PDF oder Bild, max. 10 MB)">
                  <FileInput
                    name="file"
                    required
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                  />
                </Field>
                <PendingButton className={buttonClass}>Hochladen &amp; bereitstellen</PendingButton>
              </form>
            </Card>
          ) : null}

          {isVerwalter ? (
            <CollapsibleCard title="Handwerker beauftragen" defaultOpen={!!ticket.craftsman}>
              <form action={assignCraftsman} className="space-y-3">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <Field label="Gewerk">
                  <select name="trade" defaultValue={ticket.trade ?? ""} className={inputClass}>
                    <option value="">– kein Gewerk –</option>
                    {Object.entries(tradeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                {/* Tippbar statt Aufklappliste: Das Kontaktbuch wächst mit jedem
                    Auftrag. Die Gruppierung des früheren `optgroup` bleibt als
                    Zusatzzeile je Eintrag erhalten — „intern zuerst prüfen" ist
                    eine Aussage, die nicht verlorengehen darf; die Reihenfolge
                    (intern, passendes Gewerk, Rest) trägt sie zusätzlich. */}
                <ComboField
                  label="Handwerker"
                  name="craftsmanId"
                  defaultValue={ticket.craftsmanId ?? ""}
                  placeholder="Handwerker suchen …"
                  clearOption="– keiner –"
                  options={[
                    ...internal.map((c) => ({
                      value: c.id,
                      label: `${c.company ? `${c.company} / ` : ""}${c.name}`,
                      sublabel: `Intern (Eigenleistung) · ${tradeLabels[c.trade]}`,
                    })),
                    ...suggested.map((c) => ({
                      value: c.id,
                      label: `${c.company ? `${c.company} / ` : ""}${c.name}`,
                      sublabel: `Passendes Gewerk · ${tradeLabels[c.trade]}`,
                    })),
                    ...others.map((c) => ({
                      value: c.id,
                      label: `${c.company ? `${c.company} / ` : ""}${c.name}`,
                      sublabel: tradeLabels[c.trade],
                    })),
                  ]}
                />
                {craftsmen.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Noch keine Handwerker im{" "}
                    <Link href="/verwaltung/kontakte" className="text-brand-green hover:underline">
                      Kontaktbuch
                    </Link>
                    .
                  </p>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="setBeauftragt" defaultChecked />
                  Status auf „Beauftragt“ setzen
                </label>
                <PendingButton className={buttonClass}>Zuordnen</PendingButton>
              </form>

              {ticket.craftsman ? (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-900">
                    {ticket.craftsman.company ? `${ticket.craftsman.company} · ` : ""}
                    {ticket.craftsman.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {ticket.craftsman.phone ? (
                      <a href={`tel:${ticket.craftsman.phone}`} className="hover:text-brand-orange hover:underline">
                        {ticket.craftsman.phone}
                      </a>
                    ) : null}
                    {ticket.craftsman.phone && ticket.craftsman.email ? " · " : ""}
                    {ticket.craftsman.email ? (
                      <a href={`mailto:${ticket.craftsman.email}`} className="hover:text-brand-orange hover:underline">
                        {ticket.craftsman.email}
                      </a>
                    ) : null}
                    <span className="block">
                      Bevorzugter Kontakt: {contactMethodLabels[ticket.craftsman.preferredContact]}
                    </span>
                  </p>

                  {/* Direktkontakt mit vorbefülltem Text */}
                  {(() => {
                    const c = ticket.craftsman!;
                    const text =
                      `Guten Tag ${c.name}, bezüglich Auftrag #${ticket.number} „${ticket.title}" ` +
                      (ticket.property ? `am Objekt ${ticket.property.name}` : "") +
                      (ticket.unit ? `, ${ticket.unit.label}` : "") +
                      (ticket.location ? ` (${ticket.location})` : "") +
                      `. Bitte melden Sie sich zur Terminabstimmung. ` +
                      `Mit freundlichen Grüßen, B&W Immobilien Management UG`;
                    const enc = encodeURIComponent(text);
                    const wa = waNumber(c.phone);
                    const pill =
                      "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50";
                    return (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className={pill}>
                            <Phone className="h-3.5 w-3.5" />
                            Anrufen
                          </a>
                        ) : null}
                        {c.phone ? (
                          <a href={`sms:${c.phone}?body=${enc}`} className={pill}>
                            <MessageSquare className="h-3.5 w-3.5" />
                            SMS
                          </a>
                        ) : null}
                        {wa ? (
                          <a
                            href={`https://wa.me/${wa}?text=${enc}`}
                            target="_blank"
                            className={pill}
                          >
                            WhatsApp
                          </a>
                        ) : null}
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}?subject=${encodeURIComponent(
                              `Auftrag #${ticket.number}: ${ticket.title}`
                            )}&body=${enc}`}
                            className={pill}
                          >
                            <Mail className="h-3.5 w-3.5" />
                            E-Mail
                          </a>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Beauftragung: interne Eigenleistung jederzeit; externe Handwerker
                      erst nach ausdrücklicher Freigabe (serverseitig erzwungen). */}
                  {ticket.craftsman.isInternal ? (
                    <div className="mt-3">
                      <p className="mb-2 rounded-md bg-brand-green/10 px-3 py-2 text-xs text-brand-green">
                        Interner Handwerker (Eigenleistung) – keine externe Freigabe nötig.
                      </p>
                      {ticket.craftsman.email ? (
                        <form action={notifyCraftsman}>
                          <input type="hidden" name="ticketId" value={ticket.id} />
                          <PendingButton className={`${buttonClass} w-full`}>Auftrag intern per E-Mail senden</PendingButton>
                        </form>
                      ) : null}
                    </div>
                  ) : ticket.externalReleasedAt ? (
                    <div className="mt-3">
                      <Alert variant="success" className="mb-2">
                        Externe Beauftragung freigegeben am {formatDate(ticket.externalReleasedAt)}.
                      </Alert>
                      {ticket.craftsman.email ? (
                        <form action={notifyCraftsman}>
                          <input type="hidden" name="ticketId" value={ticket.id} />
                          <PendingButton className={`${buttonClass} w-full`}>Auftrag per E-Mail senden (mit Portal-Link)</PendingButton>
                        </form>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <Alert variant="warning" title="Externer Handwerker.">
                        Bitte zuerst prüfen, ob die Arbeit intern (Eigenleistung) erledigt werden
                        kann. Erst nach Freigabe kann extern beauftragt werden.
                      </Alert>
                      <form action={releaseExternalCraftsman}>
                        <input type="hidden" name="ticketId" value={ticket.id} />
                        <PendingButton className={`${buttonSecondaryClass} w-full`}>
                          Externe Beauftragung freigeben
                        </PendingButton>
                      </form>
                    </div>
                  )}

                  {/* Terminvorschlag des Handwerkers – wird erst mit Bestätigung wirksam */}
                  {ticket.appointmentNote ? (
                    ticket.appointmentConfirmedAt ? (
                      <Alert variant="success" title="Termin bestätigt" className="mt-4">
                        {ticket.appointmentNote} · bestätigt am{" "}
                        {formatDate(ticket.appointmentConfirmedAt)}
                      </Alert>
                    ) : (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-800">
                          Terminvorschlag des Handwerkers – bitte bestätigen
                        </p>
                        <p className="mt-0.5 text-sm text-amber-900">{ticket.appointmentNote}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <form action={confirmAppointment}>
                            <input type="hidden" name="ticketId" value={ticket.id} />
                            <PendingButton className={buttonClass}>Termin bestätigen</PendingButton>
                          </form>
                          <form action={declineAppointment}>
                            <input type="hidden" name="ticketId" value={ticket.id} />
                            <PendingButton className={buttonSecondaryClass}>Ablehnen / neuen Termin anfragen</PendingButton>
                          </form>
                        </div>
                      </div>
                    )
                  ) : null}
                </div>
              ) : null}
            </CollapsibleCard>
          ) : null}

          {isAssignedHandwerker ? (
            <Card title="Auftragsstatus melden">
              <div className="flex flex-col gap-2">
                <form action={setOwnTicketStatus}>
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input type="hidden" name="status" value="IN_BEARBEITUNG" />
                  <PendingButton className={`${buttonClass} w-full`}>Arbeit begonnen</PendingButton>
                </form>
                <form action={setOwnTicketStatus}>
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input type="hidden" name="status" value="ERLEDIGT" />
                  <PendingButton className={`${buttonClass} w-full`}>Auftrag erledigt</PendingButton>
                </form>
                <p className="text-xs text-gray-500">
                  Bitte dokumentieren Sie die Ausführung mit Fotos über das
                  Kommentarfeld.
                </p>
              </div>
            </Card>
          ) : null}

        </div>
      </div>
    </>
  );
}

// Zuordnungs-Vorschlag für nicht zugeordnete Vorgänge (Name/Einheit/Adresse aus der Mail).
// Best-effort-Heuristik: alle Abfragen sind auf den Scope des Verwalters begrenzt und
// gedeckelt (SUGGEST_SCAN_LIMIT), damit kein voller Tabellen-Scan über große Bestände
// nötig ist. Die finale Zuordnung wird ohnehin serverseitig geprüft.
const SUGGEST_SCAN_LIMIT = 2000;

async function suggestTarget(
  user: Parameters<typeof userWhereForVerwalter>[0],
  ticket: { senderName: string | null; description: string }
): Promise<{ target: string; label: string } | null> {
  const name = (ticket.senderName ?? "").trim();
  const text = (ticket.description ?? "").toLowerCase();
  const propWhere: Prisma.PropertyWhereInput = await propertyWhereForVerwalter(user);

  // 1) Absendername stimmt mit einem Mieter/Eigentümer (im Scope) überein
  if (name.length >= 3) {
    const u = await db.user.findFirst({
      where: {
        AND: [
          { role: { in: ["MIETER", "EIGENTUEMER"] }, name: { contains: name, mode: "insensitive" } },
          await userWhereForVerwalter(user),
        ],
      },
      include: {
        tenancies: {
          where: { active: true },
          include: { unit: { include: { property: true } } },
        },
        ownerships: { include: { property: true } },
      },
    });
    if (u) {
      const t = u.tenancies[0];
      if (t) {
        return {
          target: `${t.unit.propertyId}|${t.unit.id}`,
          label: `${u.name} – ${t.unit.property.name}, ${t.unit.label}`,
        };
      }
      const o = u.ownerships[0];
      if (o) return { target: `${o.propertyId}|`, label: `${u.name} – ${o.property.name}` };
    }
  }

  // 2) Eine Einheiten-Bezeichnung kommt im Mailtext vor (nur Einheiten im Scope)
  if (text.length > 0) {
    const units = await db.unit.findMany({
      where: { property: propWhere },
      take: SUGGEST_SCAN_LIMIT,
      select: { id: true, label: true, propertyId: true, property: { select: { name: true } } },
    });
    const unitHit = units.find(
      (un) => un.label.length >= 3 && text.includes(un.label.toLowerCase())
    );
    if (unitHit) {
      return {
        target: `${unitHit.propertyId}|${unitHit.id}`,
        label: `${unitHit.property.name}, ${unitHit.label}`,
      };
    }
    // 3) Objektname oder Straße kommt im Mailtext vor (nur Objekte im Scope)
    const props = await db.property.findMany({
      where: propWhere,
      take: SUGGEST_SCAN_LIMIT,
      select: { id: true, name: true, street: true },
    });
    const propHit = props.find(
      (p) => text.includes(p.name.toLowerCase()) || text.includes(p.street.toLowerCase())
    );
    if (propHit) return { target: `${propHit.id}|`, label: propHit.name };
  }

  return null;
}

// Telefonnummer für wa.me normalisieren (internationale Ziffern ohne +/0)
function waNumber(phone: string | null): string {
  if (!phone) return "";
  let p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  else if (p.startsWith("00")) p = p.slice(2);
  else if (p.startsWith("0")) p = "49" + p.slice(1);
  return p.length >= 8 ? p : "";
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}
