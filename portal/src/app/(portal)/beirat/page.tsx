import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/data-display";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Card, EmptyState, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { boardPropertiesFor, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { addBeiratTask, deleteBeiratTask, toggleBeiratTask } from "./actions";

export const dynamic = "force-dynamic";

export default async function BeiratPage() {
  const user = await requireUser();
  if (user.role !== "EIGENTUEMER" && user.role !== "VERWALTER") redirect("/dashboard");

  // Zugängliche Objekte: Beiratsmitglied (Eigentümer) bzw. WEG-Objekte im
  // Verwalter-Scope (der Verwalter unterstützt den Beirat).
  const properties =
    user.role === "VERWALTER"
      ? await db.property.findMany({
          where: { ...(await propertyWhereForVerwalter(user)), managementType: "WEG" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : await boardPropertiesFor(user.id);

  // Eigentümer ohne Beiratsmandat haben hier nichts zu suchen.
  if (user.role === "EIGENTUEMER" && properties.length === 0) redirect("/dashboard");

  const propIds = properties.map((p) => p.id);

  // Was der Beirat zu prüfen hat (§ 29 Abs. 2 Satz 1 WEG): beschlossene
  // Wirtschaftspläne und fertiggestellte Jahresabrechnungen.
  //
  // Diese Liste stand bisher nirgends. Der Prüfvermerk ließ sich zwar setzen —
  // aber nur, wenn man ihn auf der Finanzen-Seite zufällig fand. Ein Beirat, der
  // nicht weiß, dass etwas auf ihn wartet, prüft nichts.
  const [plaene, abrechnungen] = propIds.length
    ? await Promise.all([
        db.economicPlan.findMany({
          where: { propertyId: { in: propIds }, status: "BESCHLOSSEN" },
          orderBy: { year: "desc" },
          select: { id: true, year: true, propertyId: true, beiratReviewStatus: true },
        }),
        db.annualStatement.findMany({
          where: { propertyId: { in: propIds }, status: "FERTIG" },
          orderBy: { year: "desc" },
          select: { id: true, year: true, propertyId: true, beiratReviewStatus: true },
        }),
      ])
    : [[], []];
  type Pruefstueck = {
    art: "Wirtschaftsplan" | "Jahresabrechnung";
    jahr: number;
    propertyId: string;
    geprueft: "GEPRUEFT" | "ANMERKUNGEN" | null;
  };
  const pruefstuecke: Pruefstueck[] = [
    ...plaene.map((x) => ({
      art: "Wirtschaftsplan" as const,
      jahr: x.year,
      propertyId: x.propertyId,
      geprueft: x.beiratReviewStatus,
    })),
    ...abrechnungen.map((x) => ({
      art: "Jahresabrechnung" as const,
      jahr: x.year,
      propertyId: x.propertyId,
      geprueft: x.beiratReviewStatus,
    })),
  ].sort((a, b) => b.jahr - a.jahr);
  const tasks = propIds.length
    ? await db.beiratTask.findMany({
        where: { propertyId: { in: propIds } },
        orderBy: [{ done: "asc" }, { createdAt: "desc" }],
        include: { createdBy: { select: { name: true } } },
      })
    : [];
  const tasksByProp = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByProp.get(t.propertyId) ?? [];
    list.push(t);
    tasksByProp.set(t.propertyId, list);
  }

  return (
    <>
      <PageTitle>Verwaltungsbeirat</PageTitle>
      <p className="mb-6 max-w-3xl text-sm text-gray-300">
        Interner Bereich des Verwaltungsbeirats (§ 29 WEG): Aufgaben und Notizen zur
        Unterstützung der Verwaltung und zur Vorbereitung der Prüfung. Nur für
        Beiratsmitglieder und die Verwaltung sichtbar.
      </p>

      <div className="space-y-6">
        {properties.map((p) => {
          const list = tasksByProp.get(p.id) ?? [];
          return (
            <Card key={p.id} title={p.name}>
              {list.length === 0 ? (
                <EmptyState>Noch keine Aufgaben erfasst.</EmptyState>
              ) : (
                <ul className="mb-4 divide-y divide-gray-100">
                  {list.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <form action={toggleBeiratTask}>
                            <input type="hidden" name="id" value={t.id} />
                            <button
                              type="submit"
                              aria-label={t.done ? "Als offen markieren" : "Als erledigt markieren"}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                t.done
                                  ? "border-brand-green bg-brand-green text-white"
                                  : "border-gray-300 bg-white text-transparent hover:border-brand-green"
                              }`}
                            >
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </form>
                          <span className={`text-sm font-medium ${t.done ? "text-gray-400 line-through" : "text-gray-900"}`}>
                            {t.title}
                          </span>
                        </div>
                        {t.description ? (
                          <p className="ml-7 mt-0.5 whitespace-pre-wrap text-xs text-gray-500">{t.description}</p>
                        ) : null}
                        <p className="ml-7 mt-0.5 text-[11px] text-gray-400">
                          {t.createdBy.name} · {formatDate(t.createdAt)}
                        </p>
                      </div>
                      <form action={deleteBeiratTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <ConfirmActionButton
                          className="shrink-0 text-xs text-red-600 hover:underline"
                          confirmLabel="Wirklich löschen?"
                          pendingLabel="Wird gelöscht…"
                        >
                          Löschen
                        </ConfirmActionButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              {user.role === "EIGENTUEMER" ? (
                <div className="mb-4 border-t border-gray-100 pt-3">
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    Rechnungsprüfung (§ 29 Abs. 2 WEG)
                  </h3>
                  {pruefstuecke.filter((x) => x.propertyId === p.id).length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Zurzeit liegt nichts zur Prüfung vor.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {pruefstuecke
                        .filter((x) => x.propertyId === p.id)
                        .map((x) => (
                          <li
                            key={`${x.art}-${x.jahr}`}
                            className="flex flex-wrap items-center gap-2 text-sm"
                          >
                            <span className="text-gray-800">
                              {x.art} {x.jahr}
                            </span>
                            {x.geprueft === "GEPRUEFT" ? (
                              <Badge tone="success">geprüft</Badge>
                            ) : x.geprueft === "ANMERKUNGEN" ? (
                              <Badge tone="warning">mit Anmerkungen</Badge>
                            ) : (
                              <Badge tone="neutral">noch nicht geprüft</Badge>
                            )}
                            {/*
                              Der Beleg-Link trägt das Jahr mit: Wer die
                              Abrechnung 2025 prüft, will die Buchungen von 2025
                              sehen und nicht erst einen Filter suchen.
                            */}
                            <Link
                              href={`/finanzen?objekt=${encodeURIComponent(p.id)}&bjahr=${x.jahr}`}
                              className="text-brand-green underline-offset-2 hover:underline"
                            >
                              Belege {x.jahr} ansehen
                            </Link>
                          </li>
                        ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    Den Prüfvermerk setzen Sie unter „Finanzen“ beim jeweiligen Dokument.
                    Ihr Einsichtsrecht in die Buchhaltung folgt aus § 18 Abs. 4 WEG und
                    gilt unabhängig davon, ob etwas zur Prüfung ansteht.
                  </p>
                </div>
              ) : null}

              <form action={addBeiratTask} className="space-y-2 border-t border-gray-100 pt-3">
                <input type="hidden" name="propertyId" value={p.id} />
                <Field label="Neue Aufgabe / Notiz">
                  <input type="text" name="title" required maxLength={200} placeholder="z. B. Belege 2025 sichten" className={inputClass} />
                </Field>
                <textarea name="description" rows={2} placeholder="Details (optional)" className={inputClass} />
                <SubmitButton className={buttonClass} pendingLabel="Wird gespeichert…">
                  Hinzufügen
                </SubmitButton>
              </form>
            </Card>
          );
        })}
        {properties.length === 0 ? (
          <EmptyState>Keine WEG-Objekte mit Beirat vorhanden.</EmptyState>
        ) : null}
      </div>
    </>
  );
}
