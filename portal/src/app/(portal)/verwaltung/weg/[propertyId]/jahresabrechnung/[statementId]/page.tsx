import { notFound } from "next/navigation";
import { FileInput } from "@/components/file-input";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import { Alert, Card, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { Tipp } from "@/components/tipp";
import { db } from "@/lib/db";
import { distributionKeyLabels, formatDateOnly, ledgerAccountKindLabels } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { MANUAL_KEYS } from "@/lib/weg/annual-statement";
import { computeStatementView, type StatementView } from "@/lib/weg/statement-service";
import { requireWegProperty } from "@/lib/weg/scope";
import {
  deleteStatement,
  finalizeStatement,
  importHeatingAmounts,
  saveAccountChecks,
  distributeByMeters,
  saveManualAmounts,
  wiederholeAblage,
} from "../actions";
import {
  HEATING_CONSUMPTION_DEFAULT,
  HEATING_CONSUMPTION_MAX,
  HEATING_CONSUMPTION_MIN,
} from "@/lib/weg/heating-costs";

export const dynamic = "force-dynamic";

const FEHLER_TEXTE: Record<string, string> = {
  fertig: "Die Abrechnung ist fertiggestellt und unveränderlich.",
  betrag: "Ein Betrag konnte nicht gelesen werden (Format: 1.234,56).",
  kostenart: "Unbekannte Kostenart.",
  zaehlerart: "Bitte eine gültige Zählerart wählen.",
  nichtfertig:
    "Dokumente lassen sich erst bereitstellen, wenn die Abrechnung fertiggestellt ist.",
  ablage:
    "Die Dokumente konnten nicht bereitgestellt werden. Bitte später erneut versuchen — die Abrechnung selbst bleibt unverändert.",
  heizanteil:
    "Der Verbrauchsanteil muss zwischen 50 und 70 Prozent liegen (§§ 7, 8 HeizkostenV). Der Rest wird als Grundkosten nach Wohnfläche verteilt.",
  flaeche:
    "Für die Grundkosten fehlt bei mindestens einer Einheit die Wohnfläche. Bitte in den Stammdaten nachtragen.",
  keinekosten: "Für diese Kostenart sind im Wirtschaftsjahr keine Ausgaben gebucht.",
  keinverbrauch:
    "Keine Zählerstände für diese Art gefunden — bitte Einzelzähler und Ablesungen erfassen.",
  pruefung: "Die Prüfliste enthält noch offene Punkte — Fertigstellen nicht möglich.",
  kontenpruefung:
    "Kontenprüfung fehlgeschlagen: Der Endbestand laut Kontoauszug muss für jedes Konto exakt dem rechnerischen Endbestand entsprechen.",
  datei: "Die Datei konnte nicht gelesen werden (CSV, max. 2 MB).",
  import_spalten:
    "In der Datei wurden keine Spalten für Einheit und Betrag erkannt. Erwartet werden Spaltenüberschriften wie Einheit/Wohnung/Nr. und Betrag/Kosten/Summe.",
  import_leer: "Die Datei enthält keine lesbaren Beträge.",
};

export default async function JahresabrechnungDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string; statementId: string }>;
  searchParams: Promise<{
    gespeichert?: string;
    fertig?: string;
    fehler?: string;
    importiert?: string;
    offen?: string;
    abgelegt?: string;
    ablage?: string;
    ohne?: string;
  }>;
}) {
  const { propertyId, statementId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const statement = await db.annualStatement.findFirst({
    where: { id: statementId, propertyId: property.id },
  });
  if (!statement) notFound();
  const isDraft = statement.status === "ENTWURF";
  // Einmal gebaut, an drei Stellen gezeigt: bei fehlgeschlagener Ablage, bei
  // übersprungenen Einheiten und dauerhaft im Hinweis zur fertigen Abrechnung.
  const ablageWiederholen = (
    <form action={wiederholeAblage} className="mt-2">
      <input type="hidden" name="propertyId" value={property.id} />
      <input type="hidden" name="statementId" value={statement.id} />
      <PendingButton className={buttonSecondaryClass}>
        Dokumente erneut bereitstellen
      </PendingButton>
    </form>
  );

  // ENTWURF: live rechnen. FERTIG: eingefrorenen Snapshot rendern.
  const view: StatementView =
    !isDraft && statement.snapshot
      ? (statement.snapshot as unknown as StatementView)
      : await computeStatementView(property, statement.year, statement.id);

  const [units, manualRows, checks] = await Promise.all([
    db.unit.findMany({
      where: { propertyId: property.id },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    }),
    db.statementUnitAmount.findMany({ where: { statementId: statement.id } }),
    db.statementAccountCheck.findMany({ where: { statementId: statement.id } }),
  ]);
  const manualByCostType = new Map<string, Map<string, number>>();
  for (const row of manualRows) {
    const inner = manualByCostType.get(row.costTypeId) ?? new Map<string, number>();
    inner.set(row.unitId, row.amountCents);
    manualByCostType.set(row.costTypeId, inner);
  }
  const reportedByAccount = new Map(checks.map((c) => [c.accountId, c.reportedEndCents]));

  const manualPending = view.rows.filter(
    (r) => MANUAL_KEYS.includes(r.distributionKey) && r.totalCents > 0,
  );
  const checksOk =
    view.accounts.length > 0 &&
    view.accounts.every((a) => reportedByAccount.get(a.id) === a.endCents);
  const readyToFinalize = view.errors.length === 0 && checksOk;

  const euro = (cents: number | undefined) => formatCents(cents ?? 0);
  const cellInput = (cents: number | undefined) =>
    cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",");

  const spitzeVorlage = `Beschlussvorschlag (TOP): Jahresabrechnung ${view.year}

Die Gemeinschaft der Wohnungseigentümer beschließt gemäß § 28 Abs. 2 WEG auf
Grundlage der vorgelegten Jahresabrechnung ${view.year} die Einforderung von
Nachschüssen bzw. die Anpassung der beschlossenen Vorschüsse
(Abrechnungsspitzen) entsprechend den Einzelabrechnungen. Guthaben werden mit
künftigen Hausgeldzahlungen verrechnet bzw. erstattet.

Muster — ersetzt keine Rechtsberatung.`;

  return (
    <>
      <PageTitle
        back={{ href: `/verwaltung/weg/${property.id}/jahresabrechnung`, label: "Abrechnungen" }}
      >
        Jahresabrechnung {view.year} · {property.name}
      </PageTitle>

      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">
          {sp.gespeichert === "zaehler"
            ? "Verbrauch aus den Zählern übernommen — bitte die Einzelbeträge prüfen."
            : "Gespeichert."}
        </Alert>
      ) : null}
      {sp.fertig ? (
        <Alert variant="success" className="mb-4">
          Abrechnung fertiggestellt und eingefroren — sie ist jetzt unveränderlich.
        </Alert>
      ) : null}
      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {FEHLER_TEXTE[sp.fehler] ?? "Die Eingabe konnte nicht gespeichert werden."}
        </Alert>
      ) : null}
      {sp.importiert !== undefined ? (
        <Alert variant={sp.offen && sp.offen !== "0" ? "warning" : "success"} className="mb-4">
          Messdienst-Import: {sp.importiert} Einheit(en) übernommen
          {sp.offen && sp.offen !== "0"
            ? ` · ${sp.offen} Zeile(n) ohne eindeutige Einheit — bitte Bezeichnungen prüfen oder diese Beträge manuell erfassen.`
            : "."}
        </Alert>
      ) : null}

      {statement.beiratReviewStatus ? (
        <Alert
          variant={statement.beiratReviewStatus === "GEPRUEFT" ? "success" : "warning"}
          title={`Beirat: ${statement.beiratReviewStatus === "GEPRUEFT" ? "geprüft" : "mit Anmerkungen"}`}
          className="mb-4"
        >
          {statement.beiratReviewNote ?? "Prüfvermerk des Verwaltungsbeirats (§ 29 III WEG)."}
        </Alert>
      ) : null}

      {/* Wiederholung der Ablage. Rechnet aus dem Snapshot, ersetzt vorhandene
          Dokumente statt sie zu verdoppeln — deshalb gefahrlos wiederholbar. */}
      {sp.ablage === "fehler" ? (
        <Alert variant="warning" title="Dokumente nicht abgelegt" className="mb-4">
          Die Abrechnung ist fertiggestellt, aber die Einzelabrechnungen konnten nicht in den
          Dokumenten abgelegt werden. Die PDFs sind weiterhin über die Tabelle unten abrufbar.
          {ablageWiederholen}
        </Alert>
      ) : sp.abgelegt ? (
        <Alert
          variant={sp.ohne && sp.ohne !== "0" ? "warning" : "success"}
          className="mb-4"
        >
          {sp.abgelegt} {sp.abgelegt === "1" ? "Einzelabrechnung wurde" : "Einzelabrechnungen wurden"}{" "}
          den jeweiligen Eigentümern unter &bdquo;Dokumente&ldquo; bereitgestellt.
          {sp.ohne && sp.ohne !== "0" ? (
            <>
              {` Für ${sp.ohne} ${sp.ohne === "1" ? "Einheit" : "Einheiten"} ist kein Eigentümer erfasst — dort wurde nichts abgelegt, damit die Abrechnung nicht für alle sichtbar wird. Eigentümer in den Stammdaten nachtragen, dann hier erneut ablegen.`}
              {ablageWiederholen}
            </>
          ) : null}
        </Alert>
      ) : null}

      {!isDraft ? (
        <Alert variant="info" className="mb-4">
          Fertiggestellt am {statement.finalizedAt ? formatDateOnly(statement.finalizedAt) : "—"} —
          alle Zahlen sind als Snapshot eingefroren (revisionssicher). Über die
          Abrechnungsspitze beschließt die Eigentümerversammlung; erst damit wird ein
          Nachschuss fällig. Die Einzelabrechnungen liegen bei den jeweiligen Eigentümern
          unter &bdquo;Dokumente&ldquo;; sie lassen sich jederzeit erneut bereitstellen —
          etwa nach einem Eigentümerwechsel oder wenn ein Eigentümer nachgetragen wurde.
          Vorhandene Dokumente werden dabei ersetzt, nicht verdoppelt.
          {ablageWiederholen}
        </Alert>
      ) : view.errors.length > 0 ? (
        <Alert variant="warning" title="Prüfliste — vor dem Fertigstellen zu klären" className="mb-4">
          <ul className="list-disc pl-4">
            {view.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert variant="success" className="mb-4">
          Verteilung vollständig und centgenau — Summe der Einzelabrechnungen entspricht der
          Gesamtabrechnung.
        </Alert>
      )}

      {/* Hinweise halten das Fertigstellen nicht auf — sie zeigen etwas, das
          richtig sein kann, aber geprüft gehört. */}
      {isDraft && view.warnings.length > 0 ? (
        <Alert variant="info" title="Zur Kenntnis" className="mb-4">
          <ul className="list-disc pl-4">
            {view.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="grid gap-4">
        {/* Gesamtabrechnung */}
        <Card
          title={`Gesamtabrechnung ${view.fyStart.split("-").reverse().join(".")} – ${new Date(new Date(view.fyEnd).getTime() - 86400000).toISOString().slice(0, 10).split("-").reverse().join(".")}`}
        >
          <dl className="mb-4 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Einnahmen</dt>
              <dd className="text-lg font-semibold text-green-700">{euro(view.incomeCents)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Ausgaben (umgelegt)</dt>
              <dd className="text-lg font-semibold text-red-700">{euro(view.totalExpenseCents)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Rücklagenzuführung (Ist)
              </dt>
              <dd className="text-lg font-semibold text-gray-900">
                {euro(view.reserveTransferCents)}
              </dd>
            </div>
            {view.reserveWithdrawalCents > 0 ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">
                  Aus der Rücklage bezahlt
                </dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {euro(view.reserveWithdrawalCents)}
                </dd>
                <dd className="mt-0.5 text-xs text-gray-500">
                  Wird nicht erneut umgelegt — dafür wurde in früheren Jahren schon eingezahlt.
                </dd>
              </div>
            ) : null}
          </dl>

          <form action={saveAccountChecks}>
            <input type="hidden" name="propertyId" value={property.id} />
            <input type="hidden" name="statementId" value={statement.id} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Konto</th>
                    <th className="py-2 pr-3 text-right">Anfangsbestand</th>
                    <th className="py-2 pr-3 text-right">Einnahmen</th>
                    <th className="py-2 pr-3 text-right">Ausgaben</th>
                    <th className="py-2 pr-3 text-right">Umbuchungen</th>
                    <th className="py-2 pr-3 text-right">Endbestand (rechn.)</th>
                    <th className="py-2 pr-3 text-right">laut Kontoauszug</th>
                  </tr>
                </thead>
                <tbody>
                  {view.accounts.map((a) => {
                    const reported = reportedByAccount.get(a.id);
                    const match = reported === a.endCents;
                    return (
                      <tr key={a.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-900">
                          {a.name}
                          <span className="block text-xs text-gray-400">
                            {ledgerAccountKindLabels[a.kind]}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right">{euro(a.startCents)}</td>
                        <td className="py-2 pr-3 text-right">{euro(a.inCents)}</td>
                        <td className="py-2 pr-3 text-right">{euro(a.outCents)}</td>
                        <td className="py-2 pr-3 text-right">
                          {a.transferNetCents === 0
                            ? "—"
                            : `${a.transferNetCents < 0 ? "−" : "+"}${euro(Math.abs(a.transferNetCents))}`}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold">{euro(a.endCents)}</td>
                        <td className="py-2 pr-3 text-right">
                          {isDraft ? (
                            <span className="inline-flex items-center gap-1.5">
                              <input
                                name={`check_${a.id}`}
                                defaultValue={cellInput(reported)}
                                inputMode="decimal"
                                placeholder="0,00"
                                className={`${inputClass} w-28 text-right`}
                                aria-label={`Endbestand laut Kontoauszug für ${a.name}`}
                              />
                              <span aria-hidden>
                                {reported === undefined ? "" : match ? "✓" : "✗"}
                              </span>
                            </span>
                          ) : (
                            <span>
                              {euro(reported)} {match ? "✓" : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {isDraft ? (
              <div className="mt-3 flex items-center gap-3">
                <PendingButton className={buttonSecondaryClass}>Kontenprüfung speichern</PendingButton>
                <span className={`text-sm ${checksOk ? "text-green-700" : "text-amber-700"}`}>
                  {checksOk
                    ? "Alle Endbestände stimmen mit den Kontoauszügen überein."
                    : "Endbestand je Konto laut Kontoauszug eintragen — Pflicht fürs Fertigstellen (Anfangsbestand + Einnahmen − Ausgaben ± Umbuchungen = Endbestand)."}
                </span>
              </div>
            ) : null}
          </form>
        </Card>

        {/* Manuelle Verteilungen (Heizkosten etc.) */}
        {manualPending.map((row) => {
          const saved = manualByCostType.get(row.costTypeId) ?? new Map<string, number>();
          const savedSum = [...saved.values()].reduce((a, b) => a + b, 0);
          // Zielsumme ist der umlagefähige Teil: Was aus der Rücklage bezahlt
          // wurde, wird nicht verteilt und darf hier nicht mitgezählt werden.
          const zielCents = row.totalCents - (row.reserveFundedCents ?? 0);
          return (
            <Card
              key={row.costTypeId}
              title={`Verteilung je Einheit: ${row.name} — ${euro(zielCents)} (${distributionKeyLabels[row.distributionKey]})`}
            >
              <p className="mb-3 text-sm text-gray-600">
                Ergebnisse je Einheit erfassen (z. B. aus der Messdienst-Abrechnung). Die Summe
                muss exakt {euro(zielCents)} ergeben — aktuell erfasst: {euro(savedSum)}.
              </p>
              {isDraft && row.distributionKey === "VERBRAUCH" ? (
                <form
                  action={distributeByMeters}
                  className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="statementId" value={statement.id} />
                  <input type="hidden" name="costTypeId" value={row.costTypeId} />
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-700">
                      Automatisch aus Zählern verteilen — Zählerart
                    </span>
                    <select name="meterType" defaultValue="WASSER_KALT" className={`${inputClass} w-auto`}>
                      <option value="STROM">Strom</option>
                      <option value="GAS">Gas</option>
                      <option value="WASSER_KALT">Wasser (kalt)</option>
                      <option value="WASSER_WARM">Wasser (warm)</option>
                      <option value="HEIZUNG">Heizung</option>
                      <option value="SONSTIGES">Sonstiges</option>
                    </select>
                  </label>
                  {/* HeizkostenV: 50–70 % nach Verbrauch, der Rest nach Fläche
                      (§§ 7 Abs. 1, 8 Abs. 1). Eine Verteilung zu 100 % nach
                      Verbrauch ist formell fehlerhaft und gibt jedem
                      Eigentümer 15 % Kürzungsrecht (§ 12 Abs. 1). */}
                  {row.heatingCost ? (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-gray-700">
                        Verbrauchsanteil (50–70 %)
                      </span>
                      <input
                        name="consumptionPercent"
                        type="number"
                        min={HEATING_CONSUMPTION_MIN}
                        max={HEATING_CONSUMPTION_MAX}
                        defaultValue={HEATING_CONSUMPTION_DEFAULT}
                        className={`${inputClass} w-24`}
                        required
                      />
                    </label>
                  ) : null}
                  <PendingButton className={buttonSecondaryClass}>Aus Zählern übernehmen</PendingButton>
                  {row.heatingCost ? (
                    <p className="w-full text-xs text-gray-500">
                      Heiz- und Warmwasserkosten dürfen nicht vollständig nach Verbrauch verteilt
                      werden: {HEATING_CONSUMPTION_MIN}–{HEATING_CONSUMPTION_MAX} % nach Verbrauch,
                      der Rest als Grundkosten nach Wohnfläche (§§ 7, 8 HeizkostenV). Sonst kann
                      jeder Eigentümer seinen Anteil um 15 % kürzen (§ 12 Abs. 1 HeizkostenV) — die
                      Differenz trägt die Gemeinschaft. <strong>Besser ist der Weg über den
                      Messdienst</strong> (unten): Er rechnet die Rohrwärme (§ 9 HeizkostenV) und
                      die Trennung von Heizung und Warmwasser bereits ein, was diese Funktion nicht
                      leisten kann.
                    </p>
                  ) : null}
                </form>
              ) : null}
              <form action={saveManualAmounts} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="propertyId" value={property.id} />
                <input type="hidden" name="statementId" value={statement.id} />
                <input type="hidden" name="costTypeId" value={row.costTypeId} />
                {units.map((u) => (
                  <label key={u.id} className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-700">{u.label}</span>
                    <input
                      name={`amount_${u.id}`}
                      defaultValue={cellInput(saved.get(u.id))}
                      inputMode="decimal"
                      placeholder="0,00"
                      className={`${inputClass} w-24 text-right`}
                      disabled={!isDraft}
                    />
                  </label>
                ))}
                {isDraft ? (
                  <PendingButton className={buttonSecondaryClass}>Speichern</PendingButton>
                ) : null}
              </form>

              {isDraft ? (
                <form
                  action={importHeatingAmounts}
                  className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4"
                >
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="statementId" value={statement.id} />
                  <input type="hidden" name="costTypeId" value={row.costTypeId} />
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-700">
                      Messdienst-Datei importieren (CSV: Einheit + Betrag)
                    </span>
                    <FileInput
                      name="file"
                      accept=".csv,text/csv,text/plain"
                    />
                  </label>
                  <PendingButton className={buttonSecondaryClass}>Importieren</PendingButton>
                  <Tipp className="w-full">
                    Beträge je Einheit aus der Abrechnung von ista/Techem/Minol/Brunata. Einheiten
                    werden über Bezeichnung oder Nummer zugeordnet; nicht Zuordenbares wird gemeldet.
                  </Tipp>
                </form>
              ) : null}
            </Card>
          );
        })}

        {/* Kostenverteilung */}
        <Card title="Kostenverteilung (Gesamt → Schlüssel)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-3">Position</th>
                  <th className="py-2 pr-3">Umlageschlüssel</th>
                  <th className="py-2 pr-3 text-right">Gesamt</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.costTypeId} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-900">{r.name}</td>
                    <td className="py-2 pr-3 text-gray-600">
                      {distributionKeyLabels[r.distributionKey]}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {euro(r.totalCents)}
                      {r.reserveFundedCents ? (
                        <span className="block text-xs text-gray-500">
                          davon {euro(r.reserveFundedCents)} aus der Rücklage
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2">
                      {r.costTypeId === "__ruecklagenentnahme__" ? (
                        <span className="text-gray-500">Gegenposition</span>
                      ) : r.error ? (
                        <span className="text-amber-700">offen</span>
                      ) : (
                        <span className="text-green-700">verteilt ✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Einzelabrechnungen */}
        <Card title="Einzelabrechnungen & Abrechnungsspitze (§ 28 Abs. 2 WEG)">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-500">
              Jede Einzelabrechnung lässt sich als druckfertiges PDF (DIN A4) an den jeweiligen
              Eigentümer geben.
            </p>
            <a
              href={`/verwaltung/weg/${property.id}/jahresabrechnung/${statement.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className={buttonSecondaryClass}
            >
              Alle Einzelabrechnungen als PDF
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-3">Einheit</th>
                  <th className="py-2 pr-3 text-right">Kostenanteil (Ist)</th>
                  <th className="py-2 pr-3 text-right">Soll-Vorschüsse</th>
                  <th className="py-2 pr-3 text-right">Abrechnungsspitze</th>
                  <th className="py-2 pr-3 text-right">§35a haushaltsnah</th>
                  <th className="py-2 pr-3 text-right">§35a Handwerker</th>
                  <th className="py-2 pr-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const total = view.perUnitTotal[u.id] ?? 0;
                  const due = view.duePerUnit[u.id] ?? 0;
                  const peak = view.peak[u.id] ?? 0;
                  const labor = view.labor[u.id];
                  const split = view.ownerSplit[u.id];
                  return (
                    <tr key={u.id} className="border-b border-gray-100 align-top">
                      <td className="py-2 pr-3">
                        <span className="font-medium text-gray-900">{u.label}</span>
                        {split && (split.shares.length > 0 || split.uncoveredCents > 0) ? (
                          <span className="block text-xs text-gray-500">
                            {split.shares
                              .map((s) => `${s.userName}: ${euro(s.cents)} (${s.days} Tage)`)
                              .join(" · ")}
                            {split.uncoveredCents > 0
                              ? `${split.shares.length > 0 ? " · " : ""}ohne Eigentümer: ${euro(split.uncoveredCents)}`
                              : ""}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-right">{euro(total)}</td>
                      <td className="py-2 pr-3 text-right">{euro(due)}</td>
                      <td
                        className={`py-2 pr-3 text-right font-semibold ${
                          peak > 0 ? "text-red-700" : peak < 0 ? "text-green-700" : "text-gray-700"
                        }`}
                      >
                        {peak > 0 ? "Nachschuss " : peak < 0 ? "Guthaben " : ""}
                        {euro(Math.abs(peak))}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-600">
                        {euro(labor?.haushaltsnah)}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-600">
                        {euro(labor?.handwerker)}
                        {labor && labor.unerfasst > 0 ? (
                          <span className="block text-xs text-amber-600">
                            {euro(labor.unerfasst)} ohne Lohnanteil
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <a
                          href={`/verwaltung/weg/${property.id}/jahresabrechnung/${statement.id}/pdf?einheit=${u.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm underline"
                        >
                          PDF
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Tipp className="mt-3">
            §35a: ausgewiesen ist der Lohn-, Fahrt- und Maschinenkostenanteil — nur er ist
            begünstigt, Material nicht. Quelle ist der Lohnanteil an der Buchung; fehlt er, greift
            der Erfahrungswert der Kostenart. Ist beides nicht hinterlegt, erscheint der Betrag als
            „ohne Lohnanteil&ldquo;: Er ist bewusst nicht ausgewiesen, weil eine geschätzte Zahl der
            Rückfrage des Finanzamts nicht standhielte. Nachtragen lässt er sich in der
            Buchhaltung. Muster — ersetzt keine Steuerberatung.
          </Tipp>
        </Card>

        {/* Vermögensbericht */}
        <Card title={`Vermögensbericht zum ${new Date(new Date(view.fyEnd).getTime() - 86400000).toISOString().slice(0, 10).split("-").reverse().join(".")} (§ 28 Abs. 4 WEG)`}>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Stand Erhaltungsrücklage
              </dt>
              <dd className="text-lg font-semibold text-gray-900">
                {euro(
                  view.accounts
                    .filter((a) => a.kind === "RUECKLAGE")
                    .reduce((sum, a) => sum + a.endCents, 0),
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Kontostände (laufend)
              </dt>
              <dd className="text-lg font-semibold text-gray-900">
                {euro(
                  view.accounts
                    .filter((a) => a.kind === "GIRO")
                    .reduce((sum, a) => sum + a.endCents, 0),
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Forderungen (Hausgeldrückstände)
              </dt>
              <dd className="text-lg font-semibold text-gray-900">{euro(view.receivablesCents)}</dd>
            </div>
          </dl>
          <Tipp className="mt-3">
            Verbindlichkeiten und weitere Vermögensgegenstände werden derzeit nicht erfasst und
            sind bei Bedarf manuell zu ergänzen.
          </Tipp>
        </Card>

        {/* Beschlussvorlage + Fertigstellen */}
        <Card title="Beschlussvorlage & Fertigstellen">
          <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
            {spitzeVorlage}
          </pre>
          {isDraft ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <form action={finalizeStatement}>
                <input type="hidden" name="propertyId" value={property.id} />
                <input type="hidden" name="statementId" value={statement.id} />
                <button type="submit" className={buttonClass} disabled={!readyToFinalize}>
                  Abrechnung fertigstellen (einfrieren)
                </button>
              </form>
              {!readyToFinalize ? (
                <span className="text-sm text-amber-700">
                  Fertigstellen erst möglich, wenn die Prüfliste leer ist und alle
                  Konto-Endbestände bestätigt sind.
                </span>
              ) : null}
              <form action={deleteStatement}>
                <input type="hidden" name="propertyId" value={property.id} />
                <input type="hidden" name="statementId" value={statement.id} />
                <ConfirmActionButton
                  className="text-sm text-red-600 underline"
                  confirmLabel="Wirklich löschen?"
                  pendingLabel="Wird gelöscht…"
                >
                  Entwurf löschen
                </ConfirmActionButton>
              </form>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
