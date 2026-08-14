import Link from "next/link";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import { notFound } from "next/navigation";
import { Alert, Card, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { Badge } from "@/components/data-display";
import { Tipp } from "@/components/tipp";
import { db } from "@/lib/db";
import {
  distributionKeyLabels,
  formatDateOnly,
  formatMonatJahr,
  hausgeldRoundingLabels,
} from "@/lib/labels";
import { formatCents } from "@/lib/money";
import {
  computeUnitAdvances,
  einheitenOhneFeld,
  monthlyInstallmentPlan,
  PositionNichtVerteilbar,
  rundungFuerPlan,
} from "@/lib/weg/economic-plan";

// Wie das fehlende Feld in der Oberfläche heißt — dieselben Worte wie im
// Stammdaten-Formular, damit man beim Hinspringen wiedererkennt, was gemeint ist.
const FELD_TEXT: Record<"flaeche" | "personen" | "mea", string> = {
  flaeche: "Die Wohn-/Nutzfläche",
  personen: "Die Personenzahl",
  mea: "Der Miteigentumsanteil (MEA)",
};
import { requireWegProperty } from "@/lib/weg/scope";
import { DateField } from "@/components/fields";
import { faelligkeitsText } from "@/lib/weg/plan-validity";
import {
  deletePlan,
  planZurAbstimmung,
  resolvePlan,
  updatePlanItems,
  wiederholeAblage,
} from "../actions";
import { FilePreviewLink } from "@/components/file-preview-link";

export const dynamic = "force-dynamic";

const FEHLER_TEXTE: Record<string, string> = {
  beschlossen: "Der Plan ist bereits beschlossen und kann nicht mehr geändert werden.",
  betrag: "Ein Planwert konnte nicht gelesen werden (Format: 1.234,56).",
  datum: "Das Beschlussdatum konnte nicht gelesen werden.",
  einheiten: "Dieses Objekt hat keine Einheiten.",
  stammdaten:
    "Die Verteilung ist nicht möglich — bitte in den Stammdaten die Miteigentumsanteile (MEA) aller Einheiten vervollständigen.",
  leer: "Alle Planwerte sind 0 € — es gibt nichts zu beschließen.",
  nichtbeschlossen:
    "Einzelwirtschaftspläne lassen sich erst ablegen, wenn der Plan beschlossen ist.",
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
    /** Bei `fehler=betrag`: die Positionen, deren Wert unlesbar war. */
    positionen?: string;
    abgelegt?: string;
    ablage?: string;
    /** Bei `ablage=fehler`: der Grund im Klartext (siehe `ablageFehlerText`). */
    grund?: string;
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

  // Bis zu welchem Monat Sollstellungen bestehen. Ohne diese Angabe wirkt die
  // Anzahl unplausibel: Bei neun Einheiten und einem Jahresplan erwartet man
  // 108, es sind aber 90 — weil bewusst nur bis zum laufenden Monat plus zwei
  // erzeugt wird (`sollHorizont`). Eine Forderung, die erst in zwei Jahren
  // fällig wird, hat in den offenen Posten nichts zu suchen. Der Rechenkern
  // stimmt also; es fehlte nur der Satz, der die Zahl erklärt.
  const letzteSollstellung = await db.duePosting.findFirst({
    where: { planId: plan.id },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    select: { periodYear: true, periodMonth: true },
  });

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
  // Einmal gebaut, an drei Stellen gezeigt: bei fehlgeschlagener Ablage, bei
  // übersprungenen Einheiten und dauerhaft im Hinweis zum beschlossenen Plan.
  const ablageWiederholen = (
    <form action={wiederholeAblage} className="mt-2">
      <input type="hidden" name="propertyId" value={property.id} />
      <input type="hidden" name="planId" value={plan.id} />
      <PendingButton className={buttonSecondaryClass}>
        Ablage erneut versuchen
      </PendingButton>
    </form>
  );

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
  // Rundung der Monatsraten: Ein beschlossener Plan trägt seine eigene, ein
  // Entwurf zeigt die aktuelle Objekt-Einstellung — also das, was der Beschluss
  // festschreiben wird. Eine Umstellung in den Stammdaten verschiebt damit
  // nichts an einem Plan, der bereits gilt.
  const rundung = rundungFuerPlan(plan, property);

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
      // Nicht nur *was* fehlt, sondern *bei wem*: Das ist der Unterschied
      // zwischen Suchen und Hingehen. Der Anker führt auf die erste betroffene
      // Zeile, nicht bloß auf die Tabelle.
      const betroffen = e.fehlendesFeld ? einheitenOhneFeld(units, e.fehlendesFeld) : [];
      const namen = betroffen.map((b) => b.label);
      advanceError = {
        titel: `„${kostenart ?? "Eine Position"}“ lässt sich noch nicht verteilen`,
        grund:
          namen.length > 0
            ? `${FELD_TEXT[e.fehlendesFeld!]} fehlt bei ${namen.length === 1 ? "" : `${namen.length} Einheiten: `}${namen.join(", ")}. Diese Kostenart wird nach ${distributionKeyLabels[e.distributionKey]} verteilt.`
            : `${e.message} Diese Kostenart wird nach ${distributionKeyLabels[e.distributionKey]} verteilt.`,
        anker: betroffen[0] ? `zeile-${betroffen[0].id}` : "einheiten",
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

  // Was durch die Rundung tatsächlich gestellt wird — Σ über alle Einheiten.
  const ratenJeEinheit = advances
    ? units.map((u) => monthlyInstallmentPlan(advances!.perUnit.get(u.id) ?? 0, rundung))
    : [];
  const gestelltCents = ratenJeEinheit.reduce((s, r) => s + r.billedCents, 0);
  const ueberdeckungGesamt = ratenJeEinheit.reduce((s, r) => s + r.overpayCents, 0);

  // Beschlussvorlage — der Wortlaut für den Tagesordnungspunkt, zum Kopieren.
  //
  // Ohne die Fußnote „Muster — ersetzt keine Rechtsberatung": Sie stand unter
  // einem Text, der die echten Zahlen dieser Gemeinschaft trägt und so in die
  // Einladung wandert. Als „Muster" gekennzeichnet entwertet er sich selbst.
  // Am Textbaustein-Katalog (`lib/weg/meeting-agenda-templates.ts`) bleibt der
  // Hinweis stehen — dort ist er zutreffend, weil dort nichts ausgerechnet ist.
  const vorlage = `Beschlussvorschlag (TOP): Wirtschaftsplan ${plan.year}

Die Gemeinschaft der Wohnungseigentümer beschließt gemäß § 28 Abs. 1 WEG auf
Grundlage des vorgelegten Wirtschaftsplans für das Wirtschaftsjahr ${plan.year}
die Vorschüsse zur Kostentragung und zur Zuführung zur Erhaltungsrücklage in
Höhe von insgesamt ${formatCents(totalCents)}. Die monatlichen Hausgeld-
Vorschüsse je Einheit ergeben sich aus den beigefügten Einzelwirtschaftsplänen
und sind jeweils zum 1. eines Monats fällig.${
    ueberdeckungGesamt > 0
      ? ` Die Monatsraten werden
${hausgeldRoundingLabels[rundung]} aufgerundet, sodass alle zwölf Raten gleich hoch
sind; die dadurch entstehende Überdeckung von ${formatCents(ueberdeckungGesamt)} wird
mit der Jahresabrechnung verrechnet.`
      : ""
  }`;

  return (
    <>
      <PageTitle
        back={{ href: `/verwaltung/weg/${property.id}/wirtschaftsplan`, label: "Wirtschaftspläne" }}
        action={
          <div className="flex gap-2">
            {!advanceError ? (
              <>
                <FilePreviewLink
                  src={`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}/pdf`}
                  title={`Wirtschaftsplan ${plan.year} — ${property.name}`}
                  className={buttonSecondaryClass}
                >
                  Gesamtplan als PDF
                </FilePreviewLink>
                <FilePreviewLink
                  src={`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}/pdf?dokument=einzelplan`}
                  title={`Einzelwirtschaftspläne ${plan.year} — ${property.name}`}
                  className={buttonSecondaryClass}
                >
                  Einzelpläne (alle)
                </FilePreviewLink>
              </>
            ) : null}
          </div>
        }
      >
        Wirtschaftsplan {plan.year} · {property.name}{" "}
        {/* Der Unterschied zwischen „gespeichert" und „beschlossen" ist der
            zwischen einer Tabelle und einer Zahlungspflicht. Er stand bisher
            nur im Hinweistext unter dem Knopf — und der ist abschaltbar. */}
        <Badge tone={isDraft ? "warning" : "success"}>
          {isDraft
            ? "Entwurf — noch nicht bindend"
            : `Beschlossen${plan.resolvedAt ? ` am ${formatDateOnly(plan.resolvedAt)}` : ""}`}
        </Badge>
      </PageTitle>

      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">
          Planwerte gespeichert.
        </Alert>
      ) : null}
      {/* Der Grund gehört sichtbar dazu: Ohne ihn weiß der Verwalter nicht, ob
          er etwas nachtragen muss oder ob das System hakt — und ohne den Knopf
          gäbe es keinen Weg zurück, weil `resolvePlan` nur für Entwürfe läuft. */}
      {sp.ablage === "fehler" ? (
        <Alert variant="warning" title="Dokumente nicht abgelegt" className="mb-4">
          Der Plan ist beschlossen und die Sollstellungen sind erzeugt, aber die
          Einzelwirtschaftspläne konnten nicht in den Dokumenten abgelegt werden.
          {sp.grund ? <> Grund: {sp.grund}</> : null} Die PDFs sind weiterhin über die
          Tabelle unten abrufbar.
          {ablageWiederholen}
        </Alert>
      ) : null}
      {sp.beschlossen ? (
        <Alert variant="success" className="mb-4">
          Wirtschaftsplan beschlossen — {plan._count.duePostings} monatliche Sollstellungen wurden
          erzeugt
          {letzteSollstellung
            ? `, zunächst bis ${formatMonatJahr(letzteSollstellung.periodYear, letzteSollstellung.periodMonth)}`
            : ""}
          {sp.abgelegt ? `, ${sp.abgelegt} Einzelwirtschaftspläne für die Eigentümer abgelegt` : ""}.
          {letzteSollstellung
            ? " Die weiteren Monate des Geltungszeitraums entstehen laufend nach — offene Posten sollen erst kurz vor ihrer Fälligkeit in der Liste stehen."
            : ""}
          {sp.ohne && sp.ohne !== "0"
            ? ` Für ${sp.ohne} ${sp.ohne === "1" ? "Einheit" : "Einheiten"} ist kein Eigentümer erfasst — dort wurde nichts abgelegt.`
            : ""} Die offenen Posten finden Sie unter{" "}
          <Link href={`/verwaltung/weg/${property.id}/hausgeld`} className="underline">
            Hausgeld
          </Link>
          .
        </Alert>
      ) : sp.abgelegt ? (
        /* Rückmeldung der Wiederholung — dort gibt es kein `beschlossen=1`. */
        <Alert variant={sp.ohne && sp.ohne !== "0" ? "warning" : "success"} className="mb-4">
          {sp.abgelegt}{" "}
          {sp.abgelegt === "1" ? "Einzelwirtschaftsplan wurde" : "Einzelwirtschaftspläne wurden"} den
          jeweiligen Eigentümern unter &bdquo;Dokumente&ldquo; bereitgestellt.
          {sp.ohne && sp.ohne !== "0" ? (
            <>
              {` Für ${sp.ohne} ${sp.ohne === "1" ? "Einheit" : "Einheiten"} ist kein Eigentümer erfasst — dort wurde nichts abgelegt, damit der Plan nicht für alle sichtbar wird. Eigentümer in den Stammdaten nachtragen, dann hier erneut ablegen.`}
              {ablageWiederholen}
            </>
          ) : null}
        </Alert>
      ) : null}
      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {/* Beim unlesbaren Betrag sind die übrigen Werte gespeichert. Das
              gehört dazugesagt: Sonst tippt man aus Sorge um den Verlust alles
              noch einmal ab. */}
          {sp.fehler === "betrag" && sp.positionen
            ? `Diese Planwerte konnten nicht gelesen werden: ${sp.positionen}. Alle übrigen Eingaben wurden gespeichert — bitte nur die genannten Zeilen im Format 1.234,56 nachtragen.`
            : (FEHLER_TEXTE[sp.fehler] ?? "Die Eingabe konnte nicht gespeichert werden.")}
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
          {letzteSollstellung
            ? ` Sollstellungen bestehen bis ${formatMonatJahr(letzteSollstellung.periodYear, letzteSollstellung.periodMonth)}; die folgenden Monate entstehen laufend nach.`
            : "."}{" "}
          Die Einzelwirtschaftspläne liegen bei den jeweiligen Eigentümern unter
          &bdquo;Dokumente&ldquo;; sie lassen sich jederzeit erneut ablegen — etwa nach einem
          Eigentümerwechsel oder wenn ein Eigentümer nachgetragen wurde. Vorhandene Dokumente
          werden dabei ersetzt, nicht verdoppelt.
          {ablageWiederholen}
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
                    const raten = monthlyInstallmentPlan(
                      advances!.perUnit.get(u.id) ?? 0,
                      rundung,
                    );
                    const min = Math.min(...raten.rates);
                    const max = Math.max(...raten.rates);
                    return (
                      <tr key={u.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-900">{u.label}</td>
                        <td className="py-2 pr-3 text-right">{formatCents(raten.annualCents)}</td>
                        <td className="py-2 pr-3 text-right text-gray-700">
                          {min === max
                            ? formatCents(max)
                            : `${formatCents(min)} – ${formatCents(max)}`}
                          {/* Die Überdeckung steht in derselben Zelle wie die
                              Rate — dort entsteht die Frage, ob zwölf mal diese
                              Zahl den Jahresvorschuss ergibt. Sie tut es nicht,
                              und das gehört hin, nicht in eine Fußnote. */}
                          <span className="block text-xs text-gray-400">
                            {raten.overpayCents > 0
                              ? `12 × ${formatCents(max)} = ${formatCents(raten.billedCents)}, Überdeckung ${formatCents(raten.overpayCents)}`
                              : raten.uniform
                                ? "12 gleiche Raten"
                                : "12 Raten, centgenau"}
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
                    <td className="py-2 pr-3 text-right text-gray-700">
                      {ueberdeckungGesamt > 0 ? (
                        <span className="block text-xs text-gray-500">
                          {formatCents(gestelltCents)} werden gestellt
                        </span>
                      ) : null}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
          {/* Der Ausweis gehört unter die Tabelle, nicht in eine Fußnote am
              Seitenende: Wer die Raten liest, soll im selben Blick sehen, dass
              die Gemeinschaft mehr einzieht als der Plan vorsieht — und wohin
              der Unterschied wandert. */}
          {advances && ueberdeckungGesamt > 0 ? (
            <Tipp className="mt-3">
              Die Monatsraten sind <strong>{hausgeldRoundingLabels[rundung]} aufgerundet</strong>,
              damit alle zwölf Raten gleich hoch sind und ein Dauerauftrag das ganze Jahr passt.
              Über alle Einheiten werden dadurch {formatCents(gestelltCents)} gestellt statt der
              geplanten {formatCents(advances.totalCents)}. Die Überdeckung von{" "}
              {formatCents(ueberdeckungGesamt)} ist ein Guthaben der Eigentümer und wird über die
              Abrechnungsspitze der Jahresabrechnung verrechnet (§ 28 Abs. 2 WEG).
              {isDraft ? (
                <>
                  {" "}
                  Die Stufe kommt aus den{" "}
                  <Link href={`/verwaltung/weg/${property.id}/stammdaten`} className="underline">
                    Objekt-Stammdaten
                  </Link>{" "}
                  und wird mit dem Beschluss festgeschrieben.
                </>
              ) : null}
            </Tipp>
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
                {/* Rückfrage, weil der Klick echte Forderungen an jeden
                    Eigentümer erzeugt und sich nicht zurücknehmen lässt. */}
                {advanceError ? (
                  <PendingButton className={buttonClass} disabled>
                    Als beschlossen markieren &amp; Sollstellungen erzeugen
                  </PendingButton>
                ) : (
                  <ConfirmActionButton
                    className={buttonClass}
                    confirmLabel="Wurde der Plan in der Versammlung beschlossen? Dies erzeugt Zahlungsforderungen an alle Eigentümer."
                    pendingLabel="Wird eingetragen…"
                  >
                    Als beschlossen markieren &amp; Sollstellungen erzeugen
                  </ConfirmActionButton>
                )}
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
                  <Tipp className="mt-3">
                    Keine geplante Versammlung vorhanden —{" "}
                    <Link href="/versammlungen" className="underline">
                      zuerst eine Versammlung anlegen
                    </Link>
                    .
                  </Tipp>
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
