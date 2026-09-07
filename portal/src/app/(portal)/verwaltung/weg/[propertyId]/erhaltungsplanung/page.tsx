import Link from "next/link";
import { KeyFigure } from "@/components/data-display";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import { Alert, Card, EmptyState, Field, PageTitle, buttonSecondaryClass, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { projectReserve } from "@/lib/weg/reserve-plan";
import { requireWegProperty } from "@/lib/weg/scope";
import { deleteMeasure, saveMeasure, toggleMeasureDone } from "./actions";

export const dynamic = "force-dynamic";

const FEHLER: Record<string, string> = {
  betrag: "Die Kostenschätzung konnte nicht gelesen werden (Format: 12.500,00).",
  nichtgefunden: "Die Maßnahme wurde nicht gefunden.",
};
const OK: Record<string, string> = {
  massnahme: "Maßnahme gespeichert.",
  status: "Status geändert.",
  geloescht: "Maßnahme gelöscht.",
};

export default async function ErhaltungsplanungPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ gespeichert?: string; fehler?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  // Rücklagenstand aus der Buchhaltung: Anfangsbestand + Σ Einnahmen − Σ Ausgaben
  // ± Umbuchungen über alle Erhaltungsrücklage-Konten.
  const reserveAccounts = await db.ledgerAccount.findMany({
    where: { propertyId: property.id, kind: "RUECKLAGE", active: true },
    select: { id: true, openingBalanceCents: true },
  });
  const reserveIds = reserveAccounts.map((a) => a.id);
  const sums = reserveIds.length
    ? await db.booking.groupBy({
        by: ["accountId", "kind", "transferOut"],
        where: { propertyId: property.id, accountId: { in: reserveIds } },
        _sum: { amountCents: true },
      })
    : [];
  let currentReserveCents = reserveAccounts.reduce((s, a) => s + a.openingBalanceCents, 0);
  for (const g of sums) {
    const amount = g._sum.amountCents ?? 0;
    if (g.kind === "EINNAHME") currentReserveCents += amount;
    else if (g.kind === "AUSGABE") currentReserveCents -= amount;
    else if (g.kind === "UMBUCHUNG") currentReserveCents += g.transferOut ? -amount : amount;
  }

  // Jährliche Rücklagenzuführung aus dem zuletzt beschlossenen Wirtschaftsplan
  // (Summe der Positionen mit Kostenart-Kategorie RUECKLAGENZUFUEHRUNG).
  const plan = await db.economicPlan.findFirst({
    where: { propertyId: property.id, status: "BESCHLOSSEN" },
    orderBy: { year: "desc" },
    include: { items: { include: { costType: { select: { category: true } } } } },
  });
  const annualContributionCents = plan
    ? plan.items
        .filter((it) => it.costType.category === "RUECKLAGENZUFUEHRUNG")
        .reduce((s, it) => s + it.amountCents, 0)
    : 0;

  const measures = await db.maintenanceMeasure.findMany({
    where: { propertyId: property.id },
    orderBy: [{ done: "asc" }, { targetYear: "asc" }, { createdAt: "asc" }],
  });
  const openMeasures = measures.filter((m) => !m.done);

  const currentYear = new Date().getFullYear();
  const projection = projectReserve({
    currentReserveCents,
    annualContributionCents,
    currentYear,
    measures: openMeasures.map((m) => ({ targetYear: m.targetYear, estimatedCents: m.estimatedCents })),
  });

  const gap = projection.coverageGapCents;

  return (
    <>
      <PageTitle
        back={{ href: `/verwaltung/weg/${property.id}`, label: property.name }}
        action={
          <div className="flex gap-2">
            <Link href={`/verwaltung/weg/${property.id}/buchhaltung`} className={buttonSecondaryClass}>
              Buchhaltung
            </Link>
          </div>
        }
      >
        Erhaltungsplanung · {property.name}
      </PageTitle>

      <p className="mb-4 max-w-3xl text-sm text-gray-300">
        Langfristige Maßnahmenliste (§ 19 Abs. 2 Nr. 2 WEG). Aus den geplanten
        Maßnahmen wird der Rücklagenbedarf hergeleitet und dem aktuellen
        Rücklagenstand aus der Buchhaltung gegenübergestellt. Zieljahr und
        Kostenschätzung sind Annahmen dieser Gemeinschaft — maßgeblich sind
        Zustandsbewertung, eingeholte Angebote und der Beschluss über die
        Rücklagenzuführung.
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

      {/* ── Gegenüberstellung ─────────────────────────────────────────────── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <KeyFigure
            label="Rücklagenstand aktuell"
            value={formatCents(currentReserveCents)}
            hint={
              annualContributionCents > 0
                ? `+ ${formatCents(annualContributionCents)}/Jahr Zuführung (Wirtschaftsplan)`
                : "keine beschlossene Zuführung hinterlegt"
            }
          />
        </Card>
        <Card>
          <KeyFigure
            label="Geplanter Bedarf gesamt"
            value={formatCents(projection.totalPlannedCents)}
            hint={`${openMeasures.length} offene Maßnahme(n)`}
          />
        </Card>
        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            gap > 0 ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {gap > 0 ? "Unterdeckung" : "Deckung"}
          </p>
          <p className={`mt-1 text-2xl font-bold ${gap > 0 ? "text-red-700" : "text-green-700"}`}>
            {formatCents(Math.abs(gap))}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {gap > 0
              ? "Bedarf übersteigt den heutigen Rücklagenstand"
              : "Rücklagenstand deckt den geplanten Bedarf"}
          </p>
        </div>
      </div>

      {projection.firstShortfallYear !== null ? (
        <Alert variant="warning" className="mb-6">
          Nach heutiger Prognose (inkl. jährlicher Zuführung) reicht die Rücklage ab{" "}
          <strong>{projection.firstShortfallYear}</strong> nicht mehr aus. Prüfen Sie eine höhere
          Zuführung oder eine Sonderumlage.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ── Jahresprognose ──────────────────────────────────────────── */}
          {projection.rows.length > 0 ? (
            <Card title="Prognose je Jahr">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-2 pr-3">Jahr</th>
                      <th className="py-2 pr-3 text-right">Maßnahmen</th>
                      <th className="py-2 pr-3 text-right">Zuführung</th>
                      <th className="py-2 text-right">Prognose Rücklage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projection.rows.map((r) => (
                      <tr key={r.year} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-3 font-medium text-gray-800">{r.year}</td>
                        <td className="py-2 pr-3 text-right text-gray-700">
                          {r.plannedCents > 0 ? `− ${formatCents(r.plannedCents)}` : "–"}
                        </td>
                        <td className="py-2 pr-3 text-right text-gray-500">
                          {r.contributionCents > 0 ? `+ ${formatCents(r.contributionCents)}` : "–"}
                        </td>
                        <td className={`py-2 text-right font-semibold ${r.shortfall ? "text-red-700" : "text-gray-900"}`}>
                          {formatCents(r.projectedReserveCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {/* ── Maßnahmenliste ──────────────────────────────────────────── */}
          <Card title="Geplante Maßnahmen">
            {measures.length === 0 ? (
              <EmptyState>Noch keine Maßnahmen geplant.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {measures.map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-xl border p-3 ${m.done ? "border-gray-100 bg-gray-50 opacity-70" : "border-gray-200 bg-white"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {m.title}
                          {m.done ? <span className="ml-2 text-xs text-green-700">erledigt</span> : null}
                        </p>
                        <p className="text-xs text-gray-500">
                          Zieljahr {m.targetYear}
                          {m.trade ? ` · ${m.trade}` : ""} · Schätzung {formatCents(m.estimatedCents)}
                        </p>
                        {m.note ? <p className="mt-1 text-sm text-gray-600">{m.note}</p> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <form action={toggleMeasureDone}>
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="id" value={m.id} />
                          <button type="submit" className="text-xs text-brand-green hover:underline">
                            {m.done ? "wieder offen" : "erledigt"}
                          </button>
                        </form>
                        <form action={deleteMeasure}>
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="id" value={m.id} />
                          <ConfirmActionButton
                            className="text-xs text-red-600 hover:underline"
                            confirmLabel="Wirklich löschen?"
                            pendingLabel="Wird gelöscht…"
                          >
                            löschen
                          </ConfirmActionButton>
                        </form>
                      </div>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                        bearbeiten
                      </summary>
                      <form action={saveMeasure} className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input type="hidden" name="propertyId" value={property.id} />
                        <input type="hidden" name="measureId" value={m.id} />
                        <input type="text" name="title" defaultValue={m.title} required className={inputClass} />
                        <input type="text" name="trade" defaultValue={m.trade ?? ""} placeholder="Gewerk" className={inputClass} />
                        <input type="number" name="targetYear" defaultValue={m.targetYear} required className={inputClass} />
                        <input type="text" inputMode="decimal" name="estimate" defaultValue={(m.estimatedCents / 100).toFixed(2).replace(".", ",")} required className={inputClass} />
                        <textarea name="note" defaultValue={m.note ?? ""} rows={2} className={`${inputClass} sm:col-span-2`} />
                        <PendingButton className="text-xs text-brand-green hover:underline">Speichern</PendingButton>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Maßnahme hinzufügen">
          <form action={saveMeasure} className="space-y-3">
            <input type="hidden" name="propertyId" value={property.id} />
            <Field label="Titel">
              <input type="text" name="title" required minLength={2} placeholder="z. B. Dachsanierung" className={inputClass} />
            </Field>
            <Field label="Gewerk (optional)">
              <input type="text" name="trade" placeholder="z. B. Dach, Fassade, Heizung" className={inputClass} />
            </Field>
            <Field label="Zieljahr">
              <input type="number" name="targetYear" required min={currentYear} max={2200} defaultValue={currentYear + 1} className={inputClass} />
            </Field>
            <Field label="Kostenschätzung (€)">
              <input type="text" inputMode="decimal" name="estimate" required placeholder="12.500,00" className={inputClass} />
            </Field>
            <Field label="Notiz (optional)">
              <textarea name="note" rows={2} className={inputClass} />
            </Field>
            <SubmitButton pendingLabel="Wird gespeichert…">Maßnahme hinzufügen</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
