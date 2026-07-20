import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Alert,
  Card,
  Field,
  PageTitle,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { distributionKeyLabels, formatDateOnly } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { computeUnitAdvances, monthlyInstallments } from "@/lib/weg/economic-plan";
import { requireWegProperty } from "@/lib/weg/scope";
import { deletePlan, resolvePlan, updatePlanItems } from "../actions";

export const dynamic = "force-dynamic";

const FEHLER_TEXTE: Record<string, string> = {
  beschlossen: "Der Plan ist bereits beschlossen und kann nicht mehr geändert werden.",
  betrag: "Ein Planwert konnte nicht gelesen werden (Format: 1.234,56).",
  datum: "Das Beschlussdatum konnte nicht gelesen werden.",
  einheiten: "Dieses Objekt hat keine Einheiten.",
  stammdaten:
    "Die Verteilung ist nicht möglich — bitte in den Stammdaten die Miteigentumsanteile (MEA) aller Einheiten vervollständigen.",
  leer: "Alle Planwerte sind 0 € — es gibt nichts zu beschließen.",
};

export default async function WirtschaftsplanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string; planId: string }>;
  searchParams: Promise<{ gespeichert?: string; beschlossen?: string; fehler?: string }>;
}) {
  const { propertyId, planId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const [plan, units] = await Promise.all([
    db.economicPlan.findFirst({
      where: { id: planId, propertyId: property.id },
      include: {
        items: { include: { costType: true }, orderBy: { costType: { orderIndex: "asc" } } },
        _count: { select: { duePostings: true } },
      },
    }),
    db.unit.findMany({
      where: { propertyId: property.id },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
    }),
  ]);
  if (!plan) notFound();

  const isDraft = plan.status === "ENTWURF";
  const totalCents = plan.items.reduce((sum, i) => sum + i.amountCents, 0);

  // Einzelwirtschaftspläne (Vorschau) — Fehler (z. B. MEA unvollständig) abfangen
  let advances: ReturnType<typeof computeUnitAdvances> | null = null;
  let advanceError: string | null = null;
  try {
    advances = computeUnitAdvances(
      plan.items.map((i) => ({
        costTypeId: i.costTypeId,
        distributionKey: i.costType.distributionKey,
        amountCents: i.amountCents,
      })),
      units,
    );
  } catch (e) {
    advanceError = e instanceof Error ? e.message : "Verteilung nicht möglich.";
  }

  // Beschlussvorlage (Mustertext)
  const vorlage = `Beschlussvorschlag (TOP): Wirtschaftsplan ${plan.year}

Die Gemeinschaft der Wohnungseigentümer beschließt gemäß § 28 Abs. 1 WEG auf
Grundlage des vorgelegten Wirtschaftsplans für das Wirtschaftsjahr ${plan.year}
die Vorschüsse zur Kostentragung und zur Zuführung zur Erhaltungsrücklage in
Höhe von insgesamt ${formatCents(totalCents)}. Die monatlichen Hausgeld-
Vorschüsse je Einheit ergeben sich aus den beigefügten Einzelwirtschaftsplänen
und sind jeweils zum 1. eines Monats fällig.

Muster — ersetzt keine Rechtsberatung.`;

  return (
    <>
      <PageTitle
        action={
          <div className="flex gap-2">
            {!advanceError ? (
              <a
                href={`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className={buttonSecondaryClass}
              >
                Als PDF
              </a>
            ) : null}
            <Link href={`/verwaltung/weg/${property.id}/wirtschaftsplan`} className={buttonSecondaryClass}>
              ← Wirtschaftspläne
            </Link>
          </div>
        }
      >
        Wirtschaftsplan {plan.year} · {property.name}
      </PageTitle>

      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">
          Planwerte gespeichert.
        </Alert>
      ) : null}
      {sp.beschlossen ? (
        <Alert variant="success" className="mb-4">
          Wirtschaftsplan beschlossen — {plan._count.duePostings} monatliche Sollstellungen wurden
          erzeugt. Die offenen Posten finden Sie unter{" "}
          <Link href={`/verwaltung/weg/${property.id}/hausgeld`} className="underline">
            Hausgeld
          </Link>
          .
        </Alert>
      ) : null}
      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {FEHLER_TEXTE[sp.fehler] ?? "Die Eingabe konnte nicht gespeichert werden."}
        </Alert>
      ) : null}

      {plan.beiratReviewStatus ? (
        <Alert
          variant={plan.beiratReviewStatus === "GEPRUEFT" ? "success" : "warning"}
          title={`Beirat: ${plan.beiratReviewStatus === "GEPRUEFT" ? "geprüft" : "mit Anmerkungen"}`}
          className="mb-4"
        >
          {plan.beiratReviewNote ?? "Prüfvermerk des Verwaltungsbeirats (§ 29 III WEG)."}
        </Alert>
      ) : null}

      {!isDraft ? (
        <Alert variant="info" className="mb-4">
          Beschlossen am {plan.resolvedAt ? formatDateOnly(plan.resolvedAt) : "—"}
          {plan.resolutionNote ? ` (${plan.resolutionNote})` : ""} — der Plan ist unveränderlich;{" "}
          {plan._count.duePostings} Sollstellungen aktiv.
        </Alert>
      ) : null}

      <div className="grid gap-4">
        {/* Planwerte */}
        <Card title={`Planwerte (Jahresbeträge) — gesamt ${formatCents(totalCents)}`}>
          <form action={updatePlanItems}>
            <input type="hidden" name="propertyId" value={property.id} />
            <input type="hidden" name="planId" value={plan.id} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Kostenart</th>
                    <th className="py-2 pr-3">Umlageschlüssel</th>
                    <th className="py-2 pr-3 text-right">Vorjahr (Ist)</th>
                    <th className="py-2 pr-3 text-right">Planwert (€/Jahr)</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium text-gray-900">{item.costType.name}</td>
                      <td className="py-2 pr-3 text-gray-600">
                        {distributionKeyLabels[item.costType.distributionKey]}
                        {["VERBRAUCH", "FESTBETRAG", "INDIVIDUELL"].includes(
                          item.costType.distributionKey,
                        ) ? (
                          <span className="block text-xs text-gray-400">
                            Vorschuss nach MEA; Abrechnung korrigiert centgenau
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-500">
                        {item.previousActualCents != null ? formatCents(item.previousActualCents) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {isDraft ? (
                          <input
                            name={`item_${item.id}`}
                            defaultValue={(item.amountCents / 100).toFixed(2).replace(".", ",")}
                            inputMode="decimal"
                            className={`${inputClass} w-32 text-right`}
                            aria-label={`Planwert ${item.costType.name}`}
                          />
                        ) : (
                          <span className="font-medium text-gray-900">
                            {formatCents(item.amountCents)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isDraft ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" className={buttonClass}>
                  Planwerte speichern
                </button>
              </div>
            ) : null}
          </form>
          {isDraft ? (
            <form
              action={deletePlan}
              className="mt-2 border-t border-gray-100 pt-3"
            >
              <input type="hidden" name="propertyId" value={property.id} />
              <input type="hidden" name="planId" value={plan.id} />
              <button type="submit" className="text-sm text-red-600 underline">
                Entwurf löschen
              </button>
            </form>
          ) : null}
        </Card>

        {/* Einzelwirtschaftspläne / Hausgeld-Tabelle */}
        <Card title="Hausgeld je Einheit (Einzelwirtschaftspläne)">
          {advanceError ? (
            <Alert variant="warning" title="Verteilung noch nicht möglich">
              {advanceError} — bitte die{" "}
              <Link href={`/verwaltung/weg/${property.id}/stammdaten`} className="underline">
                Stammdaten
              </Link>{" "}
              vervollständigen.
            </Alert>
          ) : advances ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Einheit</th>
                    <th className="py-2 pr-3 text-right">Jahres-Vorschuss</th>
                    <th className="py-2 pr-3 text-right">monatliches Hausgeld</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => {
                    const annual = advances!.perUnit.get(u.id) ?? 0;
                    const rates = monthlyInstallments(annual);
                    const min = Math.min(...rates);
                    const max = Math.max(...rates);
                    return (
                      <tr key={u.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-900">{u.label}</td>
                        <td className="py-2 pr-3 text-right">{formatCents(annual)}</td>
                        <td className="py-2 pr-3 text-right text-gray-700">
                          {min === max
                            ? formatCents(max)
                            : `${formatCents(min)} – ${formatCents(max)}`}
                          <span className="block text-xs text-gray-400">
                            12 Raten, centgenau
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-gray-900">Summe</td>
                    <td className="py-2 pr-3 text-right font-semibold text-gray-900">
                      {formatCents(advances.totalCents)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>

        {/* Beschlussvorlage + Beschluss */}
        <Card title="Beschlussvorlage & Beschluss">
          <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
            {vorlage}
          </pre>
          {isDraft ? (
            <form action={resolvePlan} className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="propertyId" value={property.id} />
              <input type="hidden" name="planId" value={plan.id} />
              <Field label="Beschlossen am">
                <input name="resolvedAt" type="date" className={`${inputClass} w-auto`} required />
              </Field>
              <Field label="Verweis (optional, z. B. „ETV 12.03.2026, TOP 4“)">
                <input name="resolutionNote" className={`${inputClass} w-72`} maxLength={300} />
              </Field>
              <button type="submit" className={buttonClass} disabled={Boolean(advanceError)}>
                Als beschlossen markieren & Sollstellungen erzeugen
              </button>
            </form>
          ) : null}
          <p className="mt-3 text-xs text-gray-400">
            Der Beschluss erzeugt für jede Einheit 12 monatliche Sollstellungen (fällig zum 1. des
            Monats). Den Beschluss selbst fassen Sie in der Versammlung oder im Umlaufverfahren —
            z. B. über{" "}
            <Link href="/versammlungen" className="underline">
              Versammlungen
            </Link>{" "}
            oder{" "}
            <Link href="/beschluesse" className="underline">
              Beschlüsse
            </Link>
            .
          </p>
        </Card>
      </div>
    </>
  );
}
