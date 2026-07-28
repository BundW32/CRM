import Link from "next/link";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import { notFound } from "next/navigation";
import { Alert, Card, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { Tipp } from "@/components/tipp";
import { db } from "@/lib/db";
import { distributionKeyLabels, formatDateOnly } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { computeUnitAdvances, monthlyInstallments, PositionNichtVerteilbar } from "@/lib/weg/economic-plan";
import { requireWegProperty } from "@/lib/weg/scope";
import { DateField } from "@/components/fields";
import { faelligkeitsText } from "@/lib/weg/plan-validity";
import { deletePlan, planZurAbstimmung, resolvePlan, updatePlanItems } from "../actions";

export const dynamic = "force-dynamic";

const FEHLER_TEXTE: Record<string, string> = {
  beschlossen: "Der Plan ist bereits beschlossen und kann nicht mehr geändert werden.",
  betrag: "Ein Planwert konnte nicht gelesen werden (Format: 1.234,56).",
  datum: "Das Beschlussdatum konnte nicht gelesen werden.",
  einheiten: "Dieses Objekt hat keine Einheiten.",
  stammdaten:
    "Die Verteilung ist nicht möglich — bitte in den Stammdaten die Miteigentumsanteile (MEA) aller Einheiten vervollständigen.",
  leer: "Alle Planwerte sind 0 € — es gibt nichts zu beschließen.",
  versammlung:
    "Diese Versammlung gehört nicht zum Objekt oder ist bereits abgeschlossen — bitte erneut auswählen.",
  geltungsbeginn:
    "Der Geltungsbeginn muss auf einen Monatsersten fallen — das Hausgeld wird in Monatsraten geschuldet, ein Wechsel mitten im Monat hätte keine.",
  rueckwirkend:
    "Für diesen Zeitraum gilt bereits ein beschlossener Wirtschaftsplan. Ein geänderter Plan kann frühestens ab dem laufenden Monat greifen: Was ein Eigentümer in der Vergangenheit schuldete, lässt sich nicht rückwirkend ändern — es kann längst bezahlt oder gemahnt sein.",
};

export default async function WirtschaftsplanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string; planId: string }>;
  searchParams: Promise<{
    gespeichert?: string;
    beschlossen?: string;
    fehler?: string;
    abgelegt?: string;
    ablage?: string;
    ohne?: string;
  }>;
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

  // Versammlungen, in die sich der Plan noch als TOP eintragen lässt.
  const offeneVersammlungen =
    plan.status === "ENTWURF"
      ? await db.ownersMeeting.findMany({
          where: { propertyId: property.id, status: { in: ["GEPLANT", "EINBERUFEN"] } },
          orderBy: { scheduledAt: "asc" },
          select: { id: true, title: true, scheduledAt: true },
        })
      : [];

  const isDraft = plan.status === "ENTWURF";
  // Vorschussbedarf = geplante Ausgaben − geplante Einnahmen (§ 28 Abs. 1 WEG).
  // Die rohe Summe aller Positionen wäre falsch, sobald es Erträge gibt.
  const ausgabenCents = plan.items
    .filter((i) => i.costType.category !== "ERTRAG")
    .reduce((sum, i) => sum + i.amountCents, 0);
  const einnahmenCents = plan.items
    .filter((i) => i.costType.category === "ERTRAG")
    .reduce((sum, i) => sum + i.amountCents, 0);
  const totalCents = ausgabenCents - einnahmenCents;

  // Einzelwirtschaftspläne (Vorschau) — schlägt die Verteilung fehl, muss die
  // Meldung sagen, WELCHE Kostenart es ist und WAS fehlt. Ein „Verteilung nicht
  // möglich" allein schickt eine Gemeinschaft auf die Suche durch fünfzehn
  // Positionen.
  let advances: ReturnType<typeof computeUnitAdvances> | null = null;
  let advanceError: { titel: string; grund: string; anker: string } | null = null;
  try {
    advances = computeUnitAdvances(
      plan.items.map((i) => ({
        costTypeId: i.costTypeId,
        distributionKey: i.costType.distributionKey,
        amountCents: i.amountCents,
        category: i.costType.category,
      })),
      units,
    );
  } catch (e) {
    if (e instanceof PositionNichtVerteilbar) {
      const kostenart = plan.items.find((i) => i.costTypeId === e.costTypeId)?.costType.name;
      advanceError = {
        titel: `„${kostenart ?? "Eine Position"}“ lässt sich noch nicht verteilen`,
        grund: `${e.message} Diese Kostenart wird nach ${distributionKeyLabels[e.distributionKey]} verteilt.`,
        // Alle drei fehlenden Felder stehen in derselben Tabelle.
        anker: "einheiten",
      };
    } else {
      advanceError = {
        titel: "Verteilung noch nicht möglich",
        grund: e instanceof Error ? e.message : "Verteilung nicht möglich.",
        anker: "einheiten",
      };
    }
  }
  const stammdatenHref = `/verwaltung/weg/${property.id}/stammdaten#${advanceError?.anker ?? "einheiten"}`;

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
        back={{ href: `/verwaltung/weg/${property.id}/wirtschaftsplan`, label: "Wirtschaftspläne" }}
        action={
          <div className="flex gap-2">
            {!advanceError ? (
              <>
                <a
                  href={`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonSecondaryClass}
                >
                  Gesamtplan als PDF
                </a>
                <a
                  href={`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}/pdf?dokument=einzelplan`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonSecondaryClass}
                >
                  Einzelpläne (alle)
                </a>
              </>
            ) : null}
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
      {sp.ablage === "fehler" ? (
        <Alert variant="warning" title="Dokumente nicht abgelegt" className="mb-4">
          Der Plan ist beschlossen und die Sollstellungen sind erzeugt, aber die
          Einzelwirtschaftspläne konnten nicht in den Dokumenten abgelegt werden.
        </Alert>
      ) : null}
      {sp.beschlossen ? (
        <Alert variant="success" className="mb-4">
          Wirtschaftsplan beschlossen — {plan._count.duePostings} monatliche Sollstellungen wurden
          erzeugt{sp.abgelegt ? `, ${sp.abgelegt} Einzelwirtschaftspläne für die Eigentümer abgelegt` : ""}.
          {sp.ohne && sp.ohne !== "0"
            ? ` Für ${sp.ohne} ${sp.ohne === "1" ? "Einheit" : "Einheiten"} ist kein Eigentümer erfasst — dort wurde nichts abgelegt.`
            : ""} Die offenen Posten finden Sie unter{" "}
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
          {plan._count.duePostings} Sollstellungen aktiv. Geltung ab{" "}
          {plan.validFrom ? formatDateOnly(plan.validFrom) : "—"}
          {plan.validUntil
            ? ` bis ${formatDateOnly(new Date(plan.validUntil.getTime() - 86400000))}`
            : ", fortgeltend bis ein neuer Plan beschlossen ist (§ 28 Abs. 1 Satz 2 WEG)"}
          .
        </Alert>
      ) : null}

      <div className="grid gap-4">
        {/* Planwerte */}
        <Card
          title={
            einnahmenCents > 0
              ? `Planwerte (Jahresbeträge) — ${formatCents(ausgabenCents)} Ausgaben − ${formatCents(einnahmenCents)} Einnahmen = ${formatCents(totalCents)} Vorschussbedarf`
              : `Planwerte (Jahresbeträge) — gesamt ${formatCents(totalCents)}`
          }
        >
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
                            {item.costType.category === "ERTRAG" ? "− " : ""}
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
                <PendingButton className={buttonClass}>Planwerte speichern</PendingButton>
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
              <ConfirmActionButton
                className="text-sm text-red-600 underline"
                confirmLabel="Wirklich löschen?"
                pendingLabel="Wird gelöscht…"
              >
                Entwurf löschen
              </ConfirmActionButton>
            </form>
          ) : null}
        </Card>

        {/* Einzelwirtschaftspläne / Hausgeld-Tabelle */}
        <Card title="Hausgeld je Einheit (Einzelwirtschaftspläne)">
          {advanceError ? (
            <Alert variant="warning" title={advanceError.titel}>
              {advanceError.grund}{" "}
              <Link href={stammdatenHref} className="underline">
                Bei den Einheiten nachtragen
              </Link>
              .
            </Alert>
          ) : advances ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Einheit</th>
                    <th className="py-2 pr-3 text-right">Jahres-Vorschuss</th>
                    <th className="py-2 pr-3 text-right">monatliches Hausgeld</th>
                    <th className="py-2" />
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
                        <td className="py-2 text-right whitespace-nowrap">
                          <a
                            href={`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}/pdf?dokument=einzelplan&einheit=${u.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm underline"
                          >
                            Einzelplan
                          </a>
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
            <>
              {/* Der Grund für einen gesperrten Knopf gehört an den Knopf. Er stand
                  bisher nur oben in der Karte „Hausgeld je Einheit" – zwei
                  Bildschirmhöhen entfernt. Wer hier unten klickte, sah nur, dass
                  nichts geschieht. */}
              {advanceError ? (
                <Alert variant="warning" title={advanceError.titel} className="mt-4">
                  {advanceError.grund} Solange das offen ist, lässt sich der Plan weder
                  beschließen noch zur Abstimmung stellen —{" "}
                  <Link href={stammdatenHref} className="underline">
                    bei den Einheiten nachtragen
                  </Link>
                  .
                </Alert>
              ) : null}
              <form action={resolvePlan} className="mt-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="propertyId" value={property.id} />
                <input type="hidden" name="planId" value={plan.id} />
                <DateField
                  label="Beschlossen am"
                  name="resolvedAt"
                  required
                  className="w-auto"
                />
                <Field label="Verweis (optional, z. B. „ETV 12.03.2026, TOP 4“)">
                  <input name="resolutionNote" className={`${inputClass} w-72`} maxLength={300} />
                </Field>
                {/* Nur für den unterjährig geänderten Wirtschaftsplan. Leer
                    lassen heißt: ab Beginn des Wirtschaftsjahres — der
                    Normalfall, auch wenn die Versammlung erst im April tagt. */}
                <DateField
                  label="Gilt ab (optional, nur bei geändertem Plan)"
                  name="validFrom"
                  className="w-auto"
                  hint="Muss ein Monatserster sein. Leer = Beginn des Wirtschaftsjahres."
                />
                <PendingButton className={buttonClass} disabled={Boolean(advanceError)}>
                  Als beschlossen markieren &amp; Sollstellungen erzeugen
                </PendingButton>
              </form>
            </>
          ) : null}
          <Tipp className="mt-3">
            „Als beschlossen markieren“ trägt einen Beschluss nach, der bereits gefasst wurde, und
            erzeugt für jede Einheit die monatlichen Sollstellungen — fällig{" "}
            {faelligkeitsText(property.dueDayRule, property.dueDayOfMonth)} (änderbar in den
            Stammdaten). Tagt die Versammlung erst im Laufe des Jahres, entstehen die Forderungen
            der zurückliegenden Monate mit: Der Plan gilt ab Beginn des Wirtschaftsjahres. Soll
            erst noch abgestimmt werden, nutzen Sie die Wege darunter.
          </Tipp>
        </Card>

        {/* Weg nach vorn: abstimmen lassen, statt nur nachzutragen. Bisher gab es
            hier ausschließlich „beschlossen am …" — wer den Plan erst noch zur
            Abstimmung bringen wollte, musste den Text von Hand in eine Versammlung
            oder einen Umlaufbeschluss übertragen. */}
        {isDraft ? (
          <Card title="Zur Abstimmung bringen">
            {/* Auch hier sperren: Ein Plan, dessen Einzelwirtschaftspläne sich
                nicht rechnen lassen, ergäbe einen Beschluss über Beträge, die es
                nicht gibt. Beim Durchlauf ließ er sich genau so zur
                Umlaufabstimmung stellen. */}
            {advanceError ? (
              <Alert variant="warning" title={advanceError.titel} className="mb-4">
                {advanceError.grund} Erst danach lässt sich der Plan zur Abstimmung
                stellen —{" "}
                <Link href={stammdatenHref} className="underline">
                  bei den Einheiten nachtragen
                </Link>
                .
              </Alert>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Als Tagesordnungspunkt einer Versammlung
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Der übliche Weg. In der Versammlung genügt die einfache Mehrheit
                  (§ 28 Abs. 1 WEG). Der Punkt erscheint mit fertigem Beschlusstext in der
                  Tagesordnung.
                </p>
                {offeneVersammlungen.length === 0 ? (
                  <p className="mt-3 text-xs text-gray-500">
                    Keine geplante Versammlung vorhanden —{" "}
                    <Link href="/versammlungen" className="underline">
                      zuerst eine Versammlung anlegen
                    </Link>
                    .
                  </p>
                ) : (
                  <form action={planZurAbstimmung} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="propertyId" value={property.id} />
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="modus" value="versammlung" />
                    <Field label="Versammlung">
                      <select name="meetingId" required className={`${inputClass} w-auto`}>
                        {offeneVersammlungen.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title} · {formatDateOnly(m.scheduledAt)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <PendingButton className={buttonSecondaryClass} disabled={Boolean(advanceError)}>
                      Als TOP eintragen
                    </PendingButton>
                  </form>
                )}
              </div>

              <div className="sm:border-l sm:border-gray-100 sm:pl-5">
                <h3 className="text-sm font-semibold text-gray-900">Als Umlaufbeschluss</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Ohne Versammlung, in Textform. Dafür müssen{" "}
                  <strong className="font-semibold">alle</strong> Eigentümer zustimmen
                  (§ 23 Abs. 3 Satz 1 WEG) — wer nicht antwortet, blockiert. In kleinen
                  Gemeinschaften oft der schnellere Weg.
                </p>
                <form action={planZurAbstimmung} className="mt-3">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="modus" value="umlauf" />
                  <PendingButton className={buttonSecondaryClass} disabled={Boolean(advanceError)}>
                    Umlaufabstimmung starten
                  </PendingButton>
                </form>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
