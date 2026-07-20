import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Alert,
  Card,
  PageTitle,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { distributionKeyLabels, formatDateOnly, ledgerAccountKindLabels } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { MANUAL_KEYS } from "@/lib/weg/annual-statement";
import { computeStatementView, type StatementView } from "@/lib/weg/statement-service";
import { requireWegProperty } from "@/lib/weg/scope";
import {
  deleteStatement,
  finalizeStatement,
  saveAccountChecks,
  distributeByMeters,
  saveManualAmounts,
} from "../actions";

export const dynamic = "force-dynamic";

const FEHLER_TEXTE: Record<string, string> = {
  fertig: "Die Abrechnung ist fertiggestellt und unveränderlich.",
  betrag: "Ein Betrag konnte nicht gelesen werden (Format: 1.234,56).",
  kostenart: "Unbekannte Kostenart.",
  zaehlerart: "Bitte eine gültige Zählerart wählen.",
  keinekosten: "Für diese Kostenart sind im Wirtschaftsjahr keine Ausgaben gebucht.",
  keinverbrauch:
    "Keine Zählerstände für diese Art gefunden — bitte Einzelzähler und Ablesungen erfassen.",
  pruefung: "Die Prüfliste enthält noch offene Punkte — Fertigstellen nicht möglich.",
  kontenpruefung:
    "Kontenprüfung fehlgeschlagen: Der Endbestand laut Kontoauszug muss für jedes Konto exakt dem rechnerischen Endbestand entsprechen.",
};

export default async function JahresabrechnungDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string; statementId: string }>;
  searchParams: Promise<{ gespeichert?: string; fertig?: string; fehler?: string }>;
}) {
  const { propertyId, statementId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const statement = await db.annualStatement.findFirst({
    where: { id: statementId, propertyId: property.id },
  });
  if (!statement) notFound();
  const isDraft = statement.status === "ENTWURF";

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
        action={
          <Link
            href={`/verwaltung/weg/${property.id}/jahresabrechnung`}
            className={buttonSecondaryClass}
          >
            ← Abrechnungen
          </Link>
        }
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

      {statement.beiratReviewStatus ? (
        <Alert
          variant={statement.beiratReviewStatus === "GEPRUEFT" ? "success" : "warning"}
          title={`Beirat: ${statement.beiratReviewStatus === "GEPRUEFT" ? "geprüft" : "mit Anmerkungen"}`}
          className="mb-4"
        >
          {statement.beiratReviewNote ?? "Prüfvermerk des Verwaltungsbeirats (§ 29 III WEG)."}
        </Alert>
      ) : null}

      {!isDraft ? (
        <Alert variant="info" className="mb-4">
          Fertiggestellt am {statement.finalizedAt ? formatDateOnly(statement.finalizedAt) : "—"} —
          alle Zahlen sind als Snapshot eingefroren (revisionssicher).
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
                <button type="submit" className={buttonSecondaryClass}>
                  Kontenprüfung speichern
                </button>
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
          return (
            <Card
              key={row.costTypeId}
              title={`Verteilung je Einheit: ${row.name} — ${euro(row.totalCents)} (${distributionKeyLabels[row.distributionKey]})`}
            >
              <p className="mb-3 text-sm text-gray-600">
                Ergebnisse je Einheit erfassen (z. B. aus der Messdienst-Abrechnung). Die Summe
                muss exakt {euro(row.totalCents)} ergeben — aktuell erfasst: {euro(savedSum)}.
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
                  <button type="submit" className={buttonSecondaryClass}>
                    Aus Zählern übernehmen
                  </button>
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
                  <button type="submit" className={buttonSecondaryClass}>
                    Speichern
                  </button>
                ) : null}
              </form>
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
                    <td className="py-2 pr-3 text-right">{euro(r.totalCents)}</td>
                    <td className="py-2">
                      {r.error ? (
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
          <p className="mt-3 text-xs text-gray-400">
            §35a: ausgewiesen sind die begünstigten Aufwendungen der geflaggten Kostenarten je
            Einheit; steuerlich maßgeblich ist der Lohn-/Fahrtkostenanteil laut Rechnung. Muster —
            ersetzt keine Steuerberatung.
          </p>
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
          <p className="mt-3 text-xs text-gray-400">
            Verbindlichkeiten und weitere Vermögensgegenstände werden derzeit nicht erfasst und
            sind bei Bedarf manuell zu ergänzen.
          </p>
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
                <button type="submit" className="text-sm text-red-600 underline">
                  Entwurf löschen
                </button>
              </form>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
