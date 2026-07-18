import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Card, EmptyState, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { ownedProperties, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { createMeeting } from "./actions";

export const dynamic = "force-dynamic";

const statusTone: Record<string, string> = {
  GEPLANT: "bg-blue-100 text-blue-800",
  EINBERUFEN: "bg-amber-100 text-amber-800",
  DURCHGEFUEHRT: "bg-green-100 text-green-800",
  ABGESAGT: "bg-gray-200 text-gray-700",
};
const statusLabel: Record<string, string> = {
  GEPLANT: "Geplant",
  EINBERUFEN: "Einberufen",
  DURCHGEFUEHRT: "Durchgeführt",
  ABGESAGT: "Abgesagt",
};

export default async function VersammlungenPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "VERWALTER" && user.role !== "EIGENTUEMER") redirect("/dashboard");
  const { fehler } = await searchParams;
  const isVerwalter = user.role === "VERWALTER";

  // Zugängliche WEG-Objekte.
  let propWhere;
  if (isVerwalter) {
    propWhere = { ...(await propertyWhereForVerwalter(user)), managementType: "WEG" as const };
  } else {
    const owned = (await ownedProperties(user.id)).filter(
      (p) => p.organizationId === user.organizationId,
    );
    propWhere = { id: { in: owned.map((p) => p.id) }, managementType: "WEG" as const };
  }
  const properties = await db.property.findMany({
    where: propWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const propIds = properties.map((p) => p.id);

  const meetings = await db.ownersMeeting.findMany({
    where: { propertyId: { in: propIds } },
    orderBy: { scheduledAt: "desc" },
    include: { property: { select: { name: true } }, _count: { select: { agendaItems: true } } },
  });

  return (
    <>
      <PageTitle>Eigentümerversammlungen</PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "keinweg"
            ? "Versammlungen sind nur für WEG-Objekte möglich."
            : "Bitte Objekt, Titel und Termin ausfüllen."}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {meetings.length === 0 ? (
            <EmptyState>Noch keine Versammlungen angelegt.</EmptyState>
          ) : (
            meetings.map((m) => (
              <Link
                key={m.id}
                href={`/versammlungen/${m.id}`}
                className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{m.title}</h3>
                    <p className="text-xs text-gray-500">
                      {m.property.name} · {formatDate(m.scheduledAt)} · {m._count.agendaItems} TOP
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[m.status]}`}>
                    {statusLabel[m.status]}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        {isVerwalter ? (
          <Card title="Versammlung anlegen">
            {properties.length === 0 ? (
              <p className="text-sm text-gray-500">
                Keine WEG-Objekte vorhanden. Legen Sie ein Objekt mit Verwaltungsart WEG an.
              </p>
            ) : (
              <form action={createMeeting} className="space-y-3">
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
                  <input
                    type="text"
                    name="title"
                    required
                    minLength={3}
                    placeholder="z. B. Ordentliche Eigentümerversammlung 2026"
                    className={inputClass}
                  />
                </Field>
                <Field label="Termin">
                  <input type="datetime-local" name="scheduledAt" required className={inputClass} />
                </Field>
                <Field label="Ort">
                  <input
                    type="text"
                    name="location"
                    required
                    placeholder="z. B. Gemeindesaal, Musterstr. 1 – oder Online / Videokonferenz"
                    className={inputClass}
                  />
                </Field>
                <Field label="Link zur Video-Zuschaltung (optional)">
                  <input
                    type="text"
                    name="videoLink"
                    placeholder="z. B. https://meet.example.org/weg — nur Abdruck in der Einladung"
                    className={inputClass}
                  />
                </Field>
                <button type="submit" className={buttonClass}>
                  Versammlung anlegen
                </button>
              </form>
            )}
          </Card>
        ) : (
          <Card title="Hinweis">
            <p className="text-sm text-gray-600">
              Hier sehen Sie die Einladungen, Tagesordnungen und Protokolle der Versammlungen
              Ihrer Eigentümergemeinschaft.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
