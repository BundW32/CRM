import Link from "next/link";
import { Alert, Card, EmptyState, PageTitle, buttonSecondaryClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { formatDateOnly, maintenanceIntervalLabels } from "@/lib/labels";
import { isMailEnabled } from "@/lib/mailer";
import { classifyDue, dueLabel } from "@/lib/weg/compliance";
import { WEG_COMPLIANCE_CATALOG } from "@/lib/weg/compliance-catalog";
import { requireWegProperty } from "@/lib/weg/scope";
import {
  adoptComplianceCatalog,
  completeCompliance,
  deleteCompliance,
  updateComplianceDue,
} from "./actions";

export const dynamic = "force-dynamic";

const FEHLER: Record<string, string> = {
  datum: "Das Fälligkeitsdatum konnte nicht gelesen werden.",
  nichtgefunden: "Die Prüfpflicht wurde nicht gefunden.",
};
const OK: Record<string, string> = {
  katalog: "Prüfpflichten-Katalog übernommen.",
  erledigt: "Als erledigt markiert — nächste Fälligkeit gesetzt.",
  faelligkeit: "Fälligkeit gespeichert.",
  geloescht: "Prüfpflicht gelöscht.",
};

export default async function PruefpflichtenPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ gespeichert?: string; fehler?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const tasks = await db.maintenanceTask.findMany({
    where: { propertyId: property.id, catalogKey: { not: null }, active: true },
    orderBy: { dueDate: "asc" },
  });

  const adoptedKeys = new Set(tasks.map((t) => t.catalogKey));
  const notYetAdopted = WEG_COMPLIANCE_CATALOG.filter((d) => !adoptedKeys.has(d.key));
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  return (
    <>
      <PageTitle
        action={
          <Link href="/verwaltung/weg" className={buttonSecondaryClass}>
            ← WEG-Finanzen
          </Link>
        }
      >
        Prüfpflichten – {property.name}
      </PageTitle>

      <p className="mb-4 max-w-3xl text-sm text-gray-300">
        Wiederkehrende Prüf- und Verwaltungspflichten Ihrer Gemeinschaft mit
        Fälligkeit. Fällige und überfällige Pflichten erscheinen zusätzlich im
        Dashboard. Turnusse sind fachliche Richtwerte (TrinkwV, BetrSichV, GEG,
        DIN&nbsp;14676, WEG) — <strong>Muster, ersetzt keine Rechtsberatung</strong>;
        passen Sie die Fälligkeit an Ihre konkrete Anlage an.
      </p>

      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {FEHLER[sp.fehler] ?? "Eingabe konnte nicht verarbeitet werden."}
        </Alert>
      ) : null}
      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">
          {OK[sp.gespeichert] ?? "Gespeichert."}
        </Alert>
      ) : null}

      {!isMailEnabled() ? (
        <Alert variant="info" className="mb-4">
          E-Mail-Erinnerungen sind nicht eingerichtet (kein SMTP hinterlegt) —
          fällige Prüfpflichten werden ausschließlich im Dashboard angezeigt.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {tasks.length === 0 ? (
            <EmptyState>
              Für dieses Objekt sind noch keine Prüfpflichten übernommen.
            </EmptyState>
          ) : (
            tasks.map((t) => {
              const { days, status } = classifyDue(t.dueDate, now);
              const tone =
                status === "overdue"
                  ? "border-red-300 bg-red-50"
                  : status === "soon"
                    ? "border-orange-300 bg-orange-50"
                    : "border-gray-200 bg-white";
              return (
                <div key={t.id} className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                      <p className="text-xs text-gray-500">
                        {maintenanceIntervalLabels[t.interval]} · fällig am{" "}
                        {formatDateOnly(t.dueDate)} · {dueLabel(days)}
                        {t.lastDoneAt ? ` · zuletzt erledigt ${formatDateOnly(t.lastDoneAt)}` : ""}
                      </p>
                      {t.description ? (
                        <p className="mt-1 text-sm text-gray-700">{t.description}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={completeCompliance}>
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            className="rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold text-brand-green-dark hover:bg-brand-orange-dark"
                          >
                            Erledigt
                          </button>
                        </form>
                        <form action={deleteCompliance}>
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="id" value={t.id} />
                          <button type="submit" className="text-xs text-red-600 hover:underline">
                            Löschen
                          </button>
                        </form>
                      </div>
                      <form action={updateComplianceDue} className="flex items-center gap-1">
                        <input type="hidden" name="propertyId" value={property.id} />
                        <input type="hidden" name="id" value={t.id} />
                        <input
                          type="date"
                          name="dueDate"
                          defaultValue={t.dueDate.toISOString().slice(0, 10)}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700"
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Fälligkeit setzen
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card title="Katalog übernehmen">
            {notYetAdopted.length === 0 ? (
              <p className="text-sm text-gray-500">
                Alle Standard-Prüfpflichten sind bereits übernommen.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-gray-600">
                  Übernimmt {notYetAdopted.length} noch fehlende Standard-Pflicht(en)
                  für dieses Objekt. Bereits vorhandene bleiben unberührt.
                </p>
                <ul className="mb-3 space-y-1 text-xs text-gray-500">
                  {notYetAdopted.map((d) => (
                    <li key={d.key}>
                      • {d.title}{" "}
                      <span className="text-gray-400">
                        ({maintenanceIntervalLabels[d.interval]})
                      </span>
                    </li>
                  ))}
                </ul>
                <form action={adoptComplianceCatalog}>
                  <input type="hidden" name="propertyId" value={property.id} />
                  <SubmitButton pendingLabel="Wird übernommen…">
                    Katalog übernehmen
                  </SubmitButton>
                </form>
              </>
            )}
          </Card>

          <Card title="Hinweis">
            <p className="text-sm text-gray-600">
              Prüfpflichten sind wiederkehrende Wartungsaufgaben. Sie lassen sich
              auch unter{" "}
              <Link href="/verwaltung/wartung" className="text-brand-green underline">
                Wartung &amp; Prüfungen
              </Link>{" "}
              gemeinsam mit weiteren Terminen verwalten, dort auch mit Handwerker-
              zuordnung und Vorgangserstellung.
            </p>
          </Card>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Heute ist der {formatDateOnly(new Date(today))}.
      </p>
    </>
  );
}
