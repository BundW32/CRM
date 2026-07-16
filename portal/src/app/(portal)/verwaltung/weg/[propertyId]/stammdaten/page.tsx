import Link from "next/link";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  PageTitle,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import {
  costCategoryLabels,
  distributionKeyLabels,
  laborShareTypeLabels,
  ledgerAccountKindLabels,
  unitTypeLabels,
} from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { requireWegProperty } from "@/lib/weg/scope";
import { adoptCostCatalog, saveAccount, saveCostType, saveFinanceSettings, saveUnitFinanceData } from "./actions";

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

  const [units, costTypes, accounts] = await Promise.all([
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
  ]);

  // MEA-Summenprüfung: Σ Zähler der Einheiten muss den Nenner ergeben.
  const meaSum = units.reduce((sum, u) => sum + (u.mea ?? 0), 0);
  const unitsWithoutMea = units.filter((u) => u.mea == null).length;
  const meaOk = property.meaTotal != null && meaSum === property.meaTotal && unitsWithoutMea === 0;

  return (
    <>
      <PageTitle
        action={
          <div className="flex gap-2">
            <Link href={`/verwaltung/weg/${property.id}/buchhaltung`} className={buttonSecondaryClass}>
              Buchhaltung
            </Link>
            <Link href="/verwaltung/weg" className={buttonSecondaryClass}>
              ← WEG-Finanzen
            </Link>
          </div>
        }
      >
        Stammdaten · {property.name}
      </PageTitle>

      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">
          Änderungen gespeichert.
        </Alert>
      ) : null}
      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {sp.fehler === "betrag"
            ? "Der Betrag konnte nicht gelesen werden (Format: 1.234,56)."
            : "Die Eingabe konnte nicht gespeichert werden."}
        </Alert>
      ) : null}

      <div className="grid gap-4">
        {/* Objekt-Finanzeinstellungen */}
        <Card title="Objekt-Einstellungen">
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
            <div className="flex items-end">
              <button type="submit" className={buttonClass}>
                Speichern
              </button>
            </div>
          </form>
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
        <Card title="Einheiten (MEA, Fläche, Personen)">
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
                  {units.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100 align-top">
                      <td className="py-2 pr-3 font-medium text-gray-900">{u.label}</td>
                      <td className="py-2 pr-3" colSpan={5}>
                        <form
                          action={saveUnitFinanceData}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="unitId" value={u.id} />
                          <select
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
                          <input
                            name="mea"
                            type="number"
                            min={0}
                            defaultValue={u.mea ?? ""}
                            placeholder="MEA"
                            className={`${inputClass} w-24`}
                            aria-label={`MEA-Zähler der Einheit ${u.label}`}
                          />
                          <input
                            name="livingArea"
                            defaultValue={u.livingArea ?? ""}
                            placeholder="m²"
                            inputMode="decimal"
                            className={`${inputClass} w-24`}
                            aria-label={`Wohnfläche der Einheit ${u.label}`}
                          />
                          <input
                            name="personCount"
                            type="number"
                            min={0}
                            defaultValue={u.personCount ?? ""}
                            placeholder="Pers."
                            className={`${inputClass} w-20`}
                            aria-label={`Personenzahl der Einheit ${u.label}`}
                          />
                          <button type="submit" className={buttonSecondaryClass}>
                            Speichern
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Kostenarten */}
        <Card title="Kostenarten & Umlageschlüssel">
          {costTypes.length === 0 ? (
            <EmptyState
              action={
                <form action={adoptCostCatalog}>
                  <input type="hidden" name="propertyId" value={property.id} />
                  <button type="submit" className={buttonClass}>
                    WEG-Standardkatalog übernehmen
                  </button>
                </form>
              }
            >
              Noch keine Kostenarten. Übernehmen Sie den vorbefüllten
              WEG-Standardkatalog (danach frei anpassbar).
            </EmptyState>
          ) : (
            <>
              <div className="mb-4">
                <form action={adoptCostCatalog}>
                  <input type="hidden" name="propertyId" value={property.id} />
                  <button type="submit" className={buttonSecondaryClass}>
                    Fehlende Standard-Kostenarten ergänzen
                  </button>
                </form>
              </div>
              <div className="grid gap-3">
                {costTypes.map((c) => (
                  <form
                    key={c.id}
                    action={saveCostType}
                    className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${
                      c.active ? "border-gray-200" : "border-gray-100 bg-gray-50 opacity-70"
                    }`}
                  >
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
                    <button type="submit" className={buttonSecondaryClass}>
                      Speichern
                    </button>
                  </form>
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
              <label className="flex items-center gap-1.5 pb-2 text-sm text-gray-700">
                <input type="checkbox" name="recoverableBetrKV" />
                umlagefähig (BetrKV)
              </label>
              <input type="hidden" name="active" value="on" />
              <button type="submit" className={buttonClass}>
                Anlegen
              </button>
            </form>
          </details>
        </Card>

        {/* Konten */}
        <Card title="Konten (Girokonto & Erhaltungsrücklage)">
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
                  action={saveAccount}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-3"
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
                    className={`${inputClass} w-28`}
                    aria-label="Anfangsbestand in Euro"
                  />
                  <input
                    name="openingBalanceDate"
                    type="date"
                    defaultValue={a.openingBalanceDate?.toISOString().slice(0, 10) ?? ""}
                    className={`${inputClass} w-auto`}
                    aria-label="Stichtag des Anfangsbestands"
                  />
                  <span className="text-sm text-gray-500">
                    Anfangsbestand: {formatCents(a.openingBalanceCents)}
                  </span>
                  <button type="submit" className={buttonSecondaryClass}>
                    Speichern
                  </button>
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
                  className={`${inputClass} w-28`}
                  placeholder="0,00"
                />
              </Field>
              <Field label="Stichtag">
                <input name="openingBalanceDate" type="date" className={`${inputClass} w-auto`} />
              </Field>
              <button type="submit" className={buttonClass}>
                Anlegen
              </button>
            </form>
          </details>
        </Card>
      </div>
    </>
  );
}
