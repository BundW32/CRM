import { BwLogo } from "@/components/logo";
import { db } from "@/lib/db";
import { formatDate, ticketStatusLabels, tradeLabels } from "@/lib/labels";
import {
  craftsmanAccept,
  craftsmanAppointment,
  craftsmanComment,
  craftsmanDecline,
  craftsmanDone,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AuftraegePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const craftsman = await db.craftsman.findUnique({ where: { accessToken: token } });

  if (!craftsman || !craftsman.active) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 text-center shadow-2xl shadow-black/30">
          <BwLogo className="mx-auto mb-4 h-16 w-auto" />
          <p className="text-sm text-gray-600">
            Dieser Auftrags-Link ist ungültig oder nicht mehr aktiv. Bitte wenden Sie sich
            an die B&amp;W Immobilien Management UG.
          </p>
        </div>
      </main>
    );
  }

  const tickets = await db.ticket.findMany({
    where: { craftsmanId: craftsman.id, status: { not: "GESCHLOSSEN" } },
    orderBy: { updatedAt: "desc" },
    include: {
      property: true,
      unit: true,
      attachments: { where: { commentId: null } },
      comments: {
        where: { internal: false },
        include: { author: true, craftsmanAuthor: true, attachments: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/95 px-4 py-3 shadow-xl shadow-black/20">
        <BwLogo className="h-10 w-auto" />
        <div>
          <p className="text-sm font-semibold text-gray-900">Auftragsportal</p>
          <p className="text-xs text-gray-500">
            {craftsman.company ? `${craftsman.company} · ` : ""}
            {craftsman.name} · {tradeLabels[craftsman.trade]}
          </p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600 shadow-sm">
          Aktuell sind Ihnen keine offenen Aufträge zugeordnet.
        </div>
      ) : (
        <div className="space-y-5">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900">
                  #{t.number} · {t.title}
                </h2>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                  {ticketStatusLabels[t.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {t.property
                  ? `${t.property.name}, ${t.property.street}, ${t.property.zip} ${t.property.city}`
                  : ""}
                {t.unit ? ` · ${t.unit.label}` : ""}
                {t.location ? ` · ${t.location}` : ""}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{t.description}</p>

              {t.attachments.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {t.attachments.map((a) =>
                    a.mimeType.startsWith("video/") ? (
                      <div key={a.id} className="overflow-hidden rounded-md border border-gray-200">
                        <video
                          src={`/api/files/anhang/${a.id}?token=${token}`}
                          controls
                          preload="metadata"
                          className="h-28 w-full object-cover"
                        />
                      </div>
                    ) : (
                      <a
                        key={a.id}
                        href={`/api/files/anhang/${a.id}?token=${token}`}
                        target="_blank"
                        className="block overflow-hidden rounded-md border border-gray-200"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/files/anhang/${a.id}?token=${token}`}
                          alt={a.fileName}
                          className="h-28 w-full object-cover"
                        />
                      </a>
                    )
                  )}
                </div>
              ) : null}

              {t.appointmentNote ? (
                t.appointmentConfirmedAt ? (
                  <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
                    ✓ Termin bestätigt: {t.appointmentNote}
                  </p>
                ) : (
                  <p className="mt-3 rounded-md bg-brand-orange-light px-3 py-2 text-xs text-brand-green-dark">
                    Ihr Terminvorschlag (wartet auf Bestätigung): {t.appointmentNote}
                  </p>
                )
              ) : null}

              {t.comments.length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                  {t.comments.map((c) => (
                    <div key={c.id} className="rounded-md bg-gray-50 px-3 py-2">
                      <p className="text-[11px] text-gray-500">
                        {c.author?.name ?? c.craftsmanAuthor?.name ?? "System"} ·{" "}
                        {formatDate(c.createdAt)}
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-gray-800">{c.body}</p>
                      {c.attachments.length > 0 ? (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {c.attachments.map((a) =>
                            a.mimeType.startsWith("video/") ? (
                              <div key={a.id} className="overflow-hidden rounded border border-gray-200">
                                <video
                                  src={`/api/files/anhang/${a.id}?token=${token}`}
                                  controls
                                  preload="metadata"
                                  className="h-20 w-full object-cover"
                                />
                              </div>
                            ) : (
                              <a
                                key={a.id}
                                href={`/api/files/anhang/${a.id}?token=${token}`}
                                target="_blank"
                                className="block overflow-hidden rounded border border-gray-200"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/api/files/anhang/${a.id}?token=${token}`}
                                  alt={a.fileName}
                                  className="h-20 w-full object-cover"
                                />
                              </a>
                            )
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Aktionen */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                <form action={craftsmanAccept}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="ticketId" value={t.id} />
                  <button className="rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold text-brand-green-dark hover:bg-brand-orange-dark">
                    Auftrag annehmen
                  </button>
                </form>
                <form action={craftsmanDone}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="ticketId" value={t.id} />
                  <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                    Als erledigt melden
                  </button>
                </form>
                <form action={craftsmanDecline}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="ticketId" value={t.id} />
                  <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                    Ablehnen
                  </button>
                </form>
              </div>

              <form action={craftsmanAppointment} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="ticketId" value={t.id} />
                <label className="flex-1">
                  <span className="mb-1 block text-xs text-gray-500">Termin vorschlagen</span>
                  <input
                    type="text"
                    name="note"
                    placeholder="z. B. Di, 18.06. vormittags"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <button className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  Senden
                </button>
              </form>

              <form action={craftsmanComment} className="mt-3 space-y-2">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="ticketId" value={t.id} />
                <textarea
                  name="body"
                  rows={2}
                  placeholder="Nachricht an die Verwaltung …"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  type="file"
                  name="photos"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
                  className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-orange-light file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-orange-dark"
                />
                <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  Nachricht / Foto senden
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-gray-400">
        B&amp;W Immobilien Management UG · info@bundwimmobilien.de
      </p>
    </main>
  );
}
