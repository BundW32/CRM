import Link from "next/link";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import { Alert, Card, EmptyState, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { Tipp } from "@/components/tipp";
import { db } from "@/lib/db";
import {
  costCategoryLabels,
  distributionKeyLabels,
  laborShareTypeLabels,
  ledgerAccountKindLabels,
  unitTypeLabels,
} from "@/lib/labels";
import { DateField, SelectField, toDateInputValue } from "@/components/fields";
import { formatCents } from "@/lib/money";
import { WEG_COST_CATALOG } from "@/lib/weg/cost-catalog";
import { requireWegProperty } from "@/lib/weg/scope";
import { formatDateOnly } from "@/lib/labels";
import {
  addUnitOwnership,
  adoptCostCatalog,
  endUnitOwnership,
  saveAccount,
  saveCostType,
  saveFinanceSettings,
  saveUnitFinanceData,
  updateOwnershipStart,
  deleteCostType,
} from "./actions";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export default async function WegStammdatenPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ gespeichert?: string; fehler?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const [units, costTypes, accounts, ownerships, ownerCandidates] = await Promise.all([
    db.unit.findMany({
      where: { propertyId: property.id },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
    }),
    db.costType.findMany({
      where: { propertyId: property.id },
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
    }),
    db.ledgerAccount.findMany({
      where: { propertyId: property.id },
      orderBy: { createdAt: "asc" },
    }),
    db.unitOwnership.findMany({
      where: { unit: { propertyId: property.id } },
      include: { user: { select: { name: true } }, unit: { select: { label: true } } },
      orderBy: [{ unit: { orderIndex: "asc" } }, { validFrom: "asc" }],
    }),
    // Kandidaten: Eigentümer der eigenen Organisation
    db.user.findMany({
      where: { organizationId: property.organizationId, role: "EIGENTUEMER", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const ownershipsByUnit = new Map<string, typeof ownerships>();
  for (const o of ownerships) {
    const list = ownershipsByUnit.get(o.unitId) ?? [];
    list.push(o);
    ownershipsByUnit.set(o.unitId, list);
  }

  // Wie viele Standard-Kostenarten fehlen noch? Entscheidet, ob der
  // Abgleich-Knopf überhaupt erscheint — im Normalfall gibt es nichts zu tun.
  const vorhandeneNamen = new Set(costTypes.map((c) => c.name.toLowerCase()));
  const fehlendeStandardarten = WEG_COST_CATALOG.filter(
    (e) => !vorhandeneNamen.has(e.name.toLowerCase()),
  ).length;

  // MEA-Summenprüfung: Σ Zähler der Einheiten muss den Nenner ergeben.
  const meaSum = units.reduce((sum, u) => sum + (u.mea ?? 0), 0);
  const unitsWithoutMea = units.filter((u) => u.mea == null).length;
  const meaOk = property.meaTotal != null && meaSum === property.meaTotal && unitsWithoutMea === 0;

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
        Stammdaten · {property.name}
      </PageTitle>

      {sp.gespeichert ? (
        // „deaktiviert" ist ein Erfolg mit Einschränkung: Die Kostenart ließ sich
        // nicht löschen, weil Buchungen oder Abrechnungen daran hängen. Das
        // stillschweigend als „gespeichert" zu melden, verschwiege den Grund.
        <Alert
          variant={sp.gespeichert === "deaktiviert" ? "warning" : "success"}
          className="mb-4"
        >
          {sp.gespeichert === "deaktiviert"
            ? "Die Kostenart wird bereits verwendet und wurde deshalb nur deaktiviert, nicht gelöscht — sonst verlören Buchungen und Abrechnungen ihre Zuordnung. Sie erscheint in neuen Plänen nicht mehr."
            : "Änderungen gespeichert."}
        </Alert>
      ) : null}
      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {sp.fehler === "betrag"
            ? "Der Betrag konnte nicht gelesen werden (Format: 1.234,56)."
            : sp.fehler === "bestand"
              ? "Bitte den Anfangsbestand angeben. Ein neu eröffnetes Konto trägt „0,00“ — leer lassen geht nicht, sonst rechnet die Buchhaltung mit einem Stand, den niemand geprüft hat."
              : sp.fehler === "stichtag"
                ? "Bitte den Stichtag des Anfangsbestands angeben. Ohne ihn sagt der Betrag nicht, wann er galt — und die Buchhaltung weiß nicht, ab wann sie mitrechnet."
                : sp.fehler === "zeitraum"
                  ? "Der Beginn darf nicht nach dem Ende der Eigentümerschaft liegen."
                  : sp.fehler === "datum"
                    ? "Das Datum konnte nicht gelesen werden."
                    : "Die Eingabe konnte nicht gespeichert werden."}
        </Alert>
      ) : null}

      <div className="grid gap-4">
        {/* Objekt-Finanzeinstellungen */}
        <Card id="objekt-einstellungen" title="Objekt-Einstellungen">
          <form action={saveFinanceSettings} className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="propertyId" value={property.id} />
            <Field label="MEA-Nenner (Summe aller Anteile, z. B. 1000)">
              <input
                name="meaTotal"
                type="number"
                min={1}
                defaultValue={property.meaTotal ?? ""}
                className={inputClass}
                placeholder="1000"
              />
            </Field>
            <Field label="Beginn des Wirtschaftsjahres">
              <select
                name="fiscalYearStartMonth"
                defaultValue={property.fiscalYearStartMonth}
                className={inputClass}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            {/* Fälligkeit der Vorschüsse. Steuert die Sollstellungen UND den
                Wortlaut der Beschlussvorlage — beides muss dasselbe sagen,
                sonst mahnt die Verwaltung zu einem Termin, den der Beschluss
                nicht nennt. */}
            <SelectField
              label="Hausgeld fällig"
              name="dueDayRule"
              defaultValue={property.dueDayRule}
              options={[
                { value: "MONATSERSTER", label: "zum Ersten des Monats" },
                { value: "DRITTER_WERKTAG", label: "zum dritten Werktag" },
                { value: "FREIER_TAG", label: "zu einem festen Tag im Monat" },
              ]}
            />
            <Field label="Fester Tag (1–28, nur bei fester Wahl)">
              <input
                name="dueDayOfMonth"
                type="number"
                min={1}
                max={28}
                defaultValue={property.dueDayOfMonth ?? ""}
                className={inputClass}
                placeholder="z. B. 15"
              />
            </Field>
            <div className="flex items-end">
              <PendingButton className={buttonClass}>Speichern</PendingButton>
            </div>
          </form>
          <Tipp className="mt-3">
            Die Fälligkeit bestimmt, ab wann ein Hausgeld als Rückstand gilt und wann Verzug
            eintritt (§ 286 BGB). Sie erscheint zugleich im Text der Beschlussvorlage zum
            Wirtschaftsplan — damit die Gemeinschaft genau das beschließt, wonach später
            gemahnt wird.
          </Tipp>
        </Card>

        {/* MEA-Summenprüfung */}
        {property.meaTotal == null ? (
          <Alert variant="warning" title="MEA-Nenner fehlt">
            Bitte den MEA-Nenner des Objekts eintragen (steht in der Teilungserklärung,
            häufig 1.000 oder 10.000). Ohne ihn ist keine Kostenverteilung nach
            Miteigentumsanteilen möglich.
          </Alert>
        ) : !meaOk ? (
          <Alert variant="warning" title="Miteigentumsanteile unvollständig">
            Summe der Anteile ({meaSum.toLocaleString("de-DE")}) ≠ Nenner (
            {property.meaTotal.toLocaleString("de-DE")})
            {unitsWithoutMea > 0
              ? ` — ${unitsWithoutMea} Einheit${unitsWithoutMea !== 1 ? "en" : ""} ohne MEA`
              : ""}
            . Die Anteile aller Einheiten müssen zusammen exakt den Nenner ergeben.
          </Alert>
        ) : (
          <Alert variant="success">
            Miteigentumsanteile vollständig: {meaSum.toLocaleString("de-DE")} /{" "}
            {property.meaTotal.toLocaleString("de-DE")}.
          </Alert>
        )}

        {/* Einheiten */}
        <Card id="einheiten" title="Einheiten (MEA, Fläche, Personen)">
          <Tipp className="mb-3">
            Der MEA-Zähler je Einheit ist die zentrale Angabe: Er steuert die Kostenverteilung in
            Abrechnung und Wirtschaftsplan und bestimmt zugleich das Stimmgewicht der Eigentümer
            (Wertprinzip). Er muss also nur hier gepflegt werden.
          </Tipp>
          {units.length === 0 ? (
            <EmptyState>Dieses Objekt hat noch keine Einheiten.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Einheit</th>
                    <th className="py-2 pr-3">Art</th>
                    <th className="py-2 pr-3">MEA-Zähler</th>
                    <th className="py-2 pr-3">Fläche (m²)</th>
                    <th className="py-2 pr-3">Personen</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {/* Ein Feld je Spalte, damit die Kopfzeile auch beschriftet, was
                      darunter steht. Zuvor lagen alle Felder in EINER Zelle
                      (`colSpan={5}`) als umbrechende Reihe – die Überschriften
                      zeigten damit ins Leere, sobald es eng wurde.

                      Das Formular steht in der letzten Zelle; die Felder gehören
                      über das `form`-Attribut dazu. Ein <form> darf in einer
                      Tabelle keine Zellen umspannen – so bleibt beides gültig:
                      ausgerichtete Spalten und ein Formular je Zeile. */}
                  {units.map((u) => {
                    const formId = `einheit-${u.id}`;
                    return (
                      <tr
                        key={u.id}
                        // Sprungziel für Fehlermeldungen („bei WE 03 fehlt die
                        // Wohnfläche"). Eigener Name, weil `einheit-…` schon
                        // die Formular-ID dieser Zeile ist — zwei gleiche IDs
                        // machen den `form`-Verweis mehrdeutig.
                        id={`zeile-${u.id}`}
                        className="scroll-mt-24 border-b border-gray-100 align-middle"
                      >
                        <td className="py-2 pr-3 font-medium text-gray-900">{u.label}</td>
                        <td className="py-2 pr-3">
                          <select
                            form={formId}
                            name="unitType"
                            defaultValue={u.unitType}
                            className={`${inputClass} w-auto`}
                            aria-label={`Art der Einheit ${u.label}`}
                          >
                            {Object.entries(unitTypeLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            form={formId}
                            name="mea"
                            type="number"
                            min={0}
                            defaultValue={u.mea ?? ""}
                            className={`${inputClass} w-24`}
                            aria-label={`MEA-Zähler der Einheit ${u.label}`}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            form={formId}
                            name="livingArea"
                            defaultValue={u.livingArea ?? ""}
                            inputMode="decimal"
                            className={`${inputClass} w-24`}
                            aria-label={`Wohnfläche der Einheit ${u.label}`}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            form={formId}
                            name="personCount"
                            type="number"
                            min={0}
                            defaultValue={u.personCount ?? ""}
                            className={`${inputClass} w-20`}
                            aria-label={`Personenzahl der Einheit ${u.label}`}
                          />
                        </td>
                        <td className="py-2">
                          <form id={formId} action={saveUnitFinanceData}>
                            <input type="hidden" name="propertyId" value={property.id} />
                            <input type="hidden" name="unitId" value={u.id} />
                            <PendingButton className={buttonSecondaryClass}>Speichern</PendingButton>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Eigentümerschaft je Einheit (tagesgenau) */}
        <Card id="eigentuemer" title="Eigentümer je Einheit (tagesgenau — Grundlage der Jahresabrechnung)">
          {units.length === 0 ? (
            <EmptyState>Dieses Objekt hat noch keine Einheiten.</EmptyState>
          ) : (
            <div className="grid gap-4">
              {units.map((u) => {
                const list = ownershipsByUnit.get(u.id) ?? [];
                return (
                  <div
                    key={u.id}
                    id={`eigentuemer-${u.id}`}
                    className="scroll-mt-24 rounded-xl border border-gray-200 p-3"
                  >
                    <h3 className="text-sm font-semibold text-gray-900">{u.label}</h3>
                    {list.length === 0 ? (
                      <p className="mt-1 text-sm text-amber-700">
                        Kein Eigentümer erfasst — für die zeitanteilige Abrechnung erforderlich.
                      </p>
                    ) : (
                      <ul className="mt-2 grid gap-1">
                        {list.map((o) => (
                          <li
                            key={o.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700"
                          >
                            {/* „seit" ist änderbar: Beim Anlegen des Objekts stand
                                hier zwangsläufig das Anlagedatum, und der Stichtag
                                entscheidet, wer bei einem Verkauf welchen Teil der
                                Jahresabrechnung trägt. */}
                            <form
                              action={updateOwnershipStart}
                              className="flex flex-wrap items-center gap-1.5"
                            >
                              <input type="hidden" name="propertyId" value={property.id} />
                              <input type="hidden" name="ownershipId" value={o.id} />
                              <span className="font-medium text-gray-900">
                                {o.user.name}
                                {o.sharePercent !== 100 ? ` (${o.sharePercent} %)` : ""}
                              </span>
                              <span className="text-xs text-gray-500">seit</span>
                              <DateField
                                name="validFrom"
                                required
                                defaultValue={toDateInputValue(o.validFrom)}
                                aria-label={`Beginn der Eigentümerschaft von ${o.user.name}`}
                                className="w-auto py-1 text-xs"
                              />
                              <PendingButton className="text-xs text-brand-green underline">
                                übernehmen
                              </PendingButton>
                              <span className="text-xs text-gray-400">
                                {o.validTo ? `bis ${formatDateOnly(o.validTo)}` : "(laufend)"}
                              </span>
                            </form>
                            {!o.validTo ? (
                              <form action={endUnitOwnership} className="flex items-center gap-1.5">
                                <input type="hidden" name="propertyId" value={property.id} />
                                <input type="hidden" name="ownershipId" value={o.id} />
                                {/* Sichtbare Beschriftung: In dieser Karte stehen
                                    zwei Datumsfelder – eines beendet die laufende
                                    Eigentümerschaft, eines beginnt eine neue.
                                    Ohne Beschriftung sagt keines, welches was tut. */}
                                <span className="text-xs text-gray-500">beenden zum</span>
                                <DateField
                                  name="validTo"
                                  aria-label={`Eigentümerschaft von ${o.user.name} beenden zum`}
                                  title={`Eigentümerschaft von ${o.user.name} zu diesem Tag beenden`}
                                  className="w-auto py-1 text-xs"
                                />
                                <ConfirmActionButton
                                  className="text-xs text-red-600 underline"
                                  confirmLabel="Wirklich löschen?"
                                  pendingLabel="Wird gelöscht…"
                                >
                                  beenden / löschen
                                </ConfirmActionButton>
                              </form>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* Steht ein Eigentümer, ist das Eintragen die Ausnahme (Verkauf,
                        Miteigentum) – ein immer offenes Formular liest sich dann wie
                        eine Pflicht, obwohl die Zuordnung längst da ist und darüber
                        steht. Als aufklappbarer Block bleibt beides wahr: Der Bestand
                        ist sichtbar, der Wechsel bleibt einen Klick entfernt.
                        Ist noch niemand erfasst, ist der Block offen. */}
                    <details className="mt-3 group" open={list.length === 0}>
                      <summary className="cursor-pointer list-none text-sm font-medium text-brand-green hover:underline">
                        {list.length === 0
                          ? "Eigentümer eintragen"
                          : "+ Eigentümerwechsel oder Miteigentümer eintragen"}
                      </summary>
                    <form action={addUnitOwnership} className="mt-3 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="propertyId" value={property.id} />
                      <input type="hidden" name="unitId" value={u.id} />
                      <Field label="Eigentümer">
                        <select name="userId" className={`${inputClass} w-auto`} required>
                          <option value="">— wählen —</option>
                          {ownerCandidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <DateField
                        label="Eigentümer seit"
                        name="validFrom"
                        required
                        className="w-auto"
                      />
                      <Field label="Anteil (%)">
                        <input
                          name="sharePercent"
                          type="number"
                          min={1}
                          max={100}
                          defaultValue={100}
                          className={`${inputClass} w-20`}
                        />
                      </Field>
                      <label className="flex items-center gap-1.5 pb-2 text-sm text-gray-700">
                        <input type="checkbox" name="endPrevious" />
                        Wechsel (Vor-Eigentümer zum Stichtag beenden)
                      </label>
                      <PendingButton className={buttonSecondaryClass}>Eintragen</PendingButton>
                    </form>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Kostenarten */}
        <Card id="kostenarten" title="Kostenarten & Umlageschlüssel">
          {costTypes.length === 0 ? (
            <EmptyState
              action={
                <form action={adoptCostCatalog}>
                  <input type="hidden" name="propertyId" value={property.id} />
                  <PendingButton className={buttonClass}>WEG-Standardkatalog übernehmen</PendingButton>
                </form>
              }
            >
              Noch keine Kostenarten. Übernehmen Sie den vorbefüllten
              WEG-Standardkatalog (danach frei anpassbar).
            </EmptyState>
          ) : (
            <>
              {/* Nur zeigen, wenn tatsächlich etwas fehlt. Zuvor stand der Knopf
                  dauerhaft und prominent da, obwohl er im Normalfall nichts tun
                  konnte – das war der Grund, warum sein Sinn sich niemandem
                  erschloss. Jetzt erscheint er genau dann, wenn er etwas
                  bewirkt, und sagt auch was. */}
              {fehlendeStandardarten > 0 ? (
                <div className="mb-4">
                  <form action={adoptCostCatalog}>
                    <input type="hidden" name="propertyId" value={property.id} />
                    <PendingButton className={buttonSecondaryClass}>
                      {fehlendeStandardarten} fehlende Standard-Kostenart
                      {fehlendeStandardarten === 1 ? "" : "en"} ergänzen
                    </PendingButton>
                  </form>
                  <Tipp className="mt-1.5">
                    Vorhandene Einträge bleiben unverändert – auch umbenannte.
                  </Tipp>
                </div>
              ) : null}
              <div className="grid gap-3">
                {costTypes.map((c) => (
                  // Zwei Formulare je Kostenart – bearbeiten und entfernen –,
                  // deshalb ein umschließender Block: Ein <form> darf kein
                  // zweites enthalten, und das Entfernen darf die Felder des
                  // Bearbeitens nicht mitschicken.
                  <div
                    key={c.id}
                    id={`kostenart-${c.id}`}
                    className={`scroll-mt-24 rounded-xl border p-3 ${
                      c.active ? "border-gray-200" : "border-gray-100 bg-gray-50 opacity-70"
                    }`}
                  >
                  <form action={saveCostType} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="propertyId" value={property.id} />
                    <input type="hidden" name="costTypeId" value={c.id} />
                    <input
                      name="name"
                      defaultValue={c.name}
                      className={`${inputClass} w-52`}
                      aria-label="Name der Kostenart"
                      required
                    />
                    <select
                      name="category"
                      defaultValue={c.category}
                      className={`${inputClass} w-auto`}
                      aria-label="Kategorie"
                    >
                      {Object.entries(costCategoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <select
                      name="distributionKey"
                      defaultValue={c.distributionKey}
                      className={`${inputClass} w-auto`}
                      aria-label="Umlageschlüssel"
                    >
                      {Object.entries(distributionKeyLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <select
                      name="laborShareType"
                      defaultValue={c.laborShareType}
                      className={`${inputClass} w-auto`}
                      aria-label="§35a-Einstufung"
                    >
                      {Object.entries(laborShareTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {/* Erfahrungswert für den Lohnanteil. Leer lassen ist die
                        ehrlichere Wahl: Ohne Angabe weist die Abrechnung die
                        Lücke aus, statt eine Zahl zu erfinden. */}
                    <input
                      name="laborSharePercent"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={c.laborSharePercent ?? ""}
                      placeholder="Lohn %"
                      className={`${inputClass} w-24`}
                      aria-label="Lohnanteil in Prozent (Schätzwert)"
                      title="Erfahrungswert für den Lohn-/Fahrt-/Maschinenkostenanteil. Greift nur, wenn an der Buchung nichts erfasst ist."
                    />
                    {/* Erzwingt bei der Zählerverteilung den Grundkostenanteil
                        (§§ 7, 8 HeizkostenV). */}
                    <label
                      className="flex items-center gap-1.5 text-sm text-gray-700"
                      title="Heiz- und Warmwasserkosten: 50–70 % nach Verbrauch, der Rest nach Wohnfläche."
                    >
                      <input type="checkbox" name="heatingCost" defaultChecked={c.heatingCost} />
                      HeizkostenV
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="recoverableBetrKV"
                        defaultChecked={c.recoverableBetrKV}
                      />
                      umlagefähig (BetrKV)
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-gray-700">
                      <input type="checkbox" name="active" defaultChecked={c.active} />
                      aktiv
                    </label>
                    <PendingButton className={buttonSecondaryClass}>Speichern</PendingButton>
                  </form>

                  {/* Entfernen als eigenes Formular: Es darf nicht die Felder des
                      Bearbeiten-Formulars mitschicken. Gelöscht wird nur, was
                      unbenutzt ist — hängt eine Buchung, ein Planwert oder eine
                      Abrechnungsposition daran, wird stattdessen deaktiviert und
                      die Meldung sagt warum. */}
                  <form action={deleteCostType} className="mt-2">
                    <input type="hidden" name="propertyId" value={property.id} />
                    <input type="hidden" name="costTypeId" value={c.id} />
                    <ConfirmActionButton
                      className="text-xs text-red-600 underline"
                      confirmLabel="Wirklich entfernen?"
                      pendingLabel="Wird entfernt…"
                    >
                      entfernen
                    </ConfirmActionButton>
                  </form>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Neue Kostenart */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Neue Kostenart anlegen
            </summary>
            <form action={saveCostType} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="propertyId" value={property.id} />
              <Field label="Name">
                <input name="name" className={`${inputClass} w-52`} required minLength={2} />
              </Field>
              <Field label="Kategorie">
                <select name="category" className={`${inputClass} w-auto`} defaultValue="BETRIEBSKOSTEN">
                  {Object.entries(costCategoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Umlageschlüssel">
                <select name="distributionKey" className={`${inputClass} w-auto`} defaultValue="MEA">
                  {Object.entries(distributionKeyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="§35a">
                <select name="laborShareType" className={`${inputClass} w-auto`} defaultValue="KEINE">
                  {Object.entries(laborShareTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lohnanteil %">
                <input
                  name="laborSharePercent"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="leer"
                  className={`${inputClass} w-24`}
                />
              </Field>
              <label className="flex items-center gap-1.5 pb-2 text-sm text-gray-700">
                <input type="checkbox" name="heatingCost" />
                HeizkostenV
              </label>
              <label className="flex items-center gap-1.5 pb-2 text-sm text-gray-700">
                <input type="checkbox" name="recoverableBetrKV" />
                umlagefähig (BetrKV)
              </label>
              <input type="hidden" name="active" value="on" />
              <PendingButton className={buttonClass}>Anlegen</PendingButton>
            </form>
          </details>
        </Card>

        {/* Konten */}
        <Card id="konten" title="Konten (Girokonto & Erhaltungsrücklage)">
          {accounts.length === 0 ? (
            <EmptyState>
              Noch keine Konten. Legen Sie das Girokonto der Gemeinschaft und das
              separate Rücklagenkonto an — die Erhaltungsrücklage wird strikt getrennt
              geführt.
            </EmptyState>
          ) : (
            <div className="mb-4 grid gap-3">
              {accounts.map((a) => (
                <form
                  key={a.id}
                  id={`konto-${a.id}`}
                  action={saveAccount}
                  className="scroll-mt-24 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-3"
                >
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="accountId" value={a.id} />
                  <input
                    name="name"
                    defaultValue={a.name}
                    className={`${inputClass} w-48`}
                    aria-label="Kontoname"
                    required
                  />
                  <select
                    name="kind"
                    defaultValue={a.kind}
                    className={`${inputClass} w-auto`}
                    aria-label="Kontoart"
                  >
                    {Object.entries(ledgerAccountKindLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    name="iban"
                    defaultValue={a.iban ?? ""}
                    placeholder="IBAN (optional)"
                    className={`${inputClass} w-64`}
                    aria-label="IBAN"
                  />
                  <input
                    name="openingBalance"
                    defaultValue={(a.openingBalanceCents / 100).toFixed(2).replace(".", ",")}
                    inputMode="decimal"
                    required
                    className={`${inputClass} w-28`}
                    aria-label="Anfangsbestand in Euro"
                  />
                  <DateField
                    name="openingBalanceDate"
                    defaultValue={toDateInputValue(a.openingBalanceDate)}
                    required
                    aria-label="Stichtag des Anfangsbestands"
                    className="w-auto"
                  />
                  <span className="text-sm text-gray-500">
                    Anfangsbestand: {formatCents(a.openingBalanceCents)}
                  </span>
                  <PendingButton className={buttonSecondaryClass}>Speichern</PendingButton>
                </form>
              ))}
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Neues Konto anlegen
            </summary>
            <form action={saveAccount} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="propertyId" value={property.id} />
              <Field label="Name">
                <input
                  name="name"
                  className={`${inputClass} w-48`}
                  placeholder="z. B. Girokonto WEG"
                  required
                  minLength={2}
                />
              </Field>
              <Field label="Kontoart">
                <select name="kind" className={`${inputClass} w-auto`} defaultValue="GIRO">
                  {Object.entries(ledgerAccountKindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="IBAN (optional)">
                <input name="iban" className={`${inputClass} w-64`} placeholder="DE.." />
              </Field>
              <Field label="Anfangsbestand (€)">
                <input
                  name="openingBalance"
                  inputMode="decimal"
                  required
                  className={`${inputClass} w-28`}
                  placeholder="0,00"
                />
              </Field>
              <DateField
                label="Stichtag"
                name="openingBalanceDate"
                required
                className="w-auto"
              />
              <PendingButton className={buttonClass}>Anlegen</PendingButton>
            </form>
          </details>
        </Card>
      </div>
    </>
  );
}
