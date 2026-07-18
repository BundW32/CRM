import Link from "next/link";
import { Alert, Card, EmptyState, Field, PageTitle, buttonSecondaryClass, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { deriveOperatingCostStatement } from "@/lib/weg/operating-cost-service";
import { requireWegProperty } from "@/lib/weg/scope";
import { savePrepayment } from "./actions";

export const dynamic = "force-dynamic";

const FEHLER: Record<string, string> = {
  betrag: "Der Betrag konnte nicht gelesen werden (Format: 250,00).",
  mieter: "Für diese Einheit ist kein aktiver Mieter hinterlegt.",
};

export default async function BetriebskostenPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ statement?: string; unit?: string; gespeichert?: string; fehler?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const [statements, rentedUnits] = await Promise.all([
    db.annualStatement.findMany({
      where: { propertyId: property.id, status: "FERTIG" },
      orderBy: { year: "desc" },
      select: { id: true, year: true },
    }),
    db.unit.findMany({
      where: { propertyId: property.id, tenancies: { some: { active: true } } },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
      select: { id: true, label: true, tenancies: { where: { active: true }, select: { user: { select: { name: true } } }, take: 1 } },
    }),
  ]);

  const statementId = sp.statement ?? statements[0]?.id;
  const unitId = sp.unit ?? rentedUnits[0]?.id;

  const data =
    statementId && unitId
      ? await deriveOperatingCostStatement({
          organizationId: property.organizationId,
          propertyId: property.id,
          statementId,
          unitId,
        })
      : null;

  function href(next: { statement?: string; unit?: string }) {
    const s = next.statement ?? statementId ?? "";
    const u = next.unit ?? unitId ?? "";
    return `/verwaltung/weg/${property.id}/betriebskosten?statement=${s}&unit=${u}`;
  }

  const r = data?.result;

  return (
    <>
      <PageTitle
        action={
          <Link href="/verwaltung/weg" className={buttonSecondaryClass}>
            ← WEG-Finanzen
          </Link>
        }
      >
        Betriebskostenabrechnung · {property.name}
      </PageTitle>

      <p className="mb-4 max-w-3xl text-sm text-gray-300">
        Betriebskostenabrechnung für vermietete Einheiten — abgeleitet aus der
        WEG-Jahresabrechnung. Nur nach BetrKV umlagefähige Kosten werden weitergegeben; der
        Vermieter-CO₂-Anteil (CO2KostAufG) wird beim Mieter abgezogen.{" "}
        <strong>Muster — ersetzt keine Rechtsberatung.</strong>
      </p>

      {sp.fehler ? (
        <Alert variant="error" className="mb-4">{FEHLER[sp.fehler] ?? "Eingabe fehlerhaft."}</Alert>
      ) : null}
      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">Vorauszahlung gespeichert.</Alert>
      ) : null}

      {statements.length === 0 ? (
        <Alert variant="warning">
          Noch keine fertiggestellte Jahresabrechnung vorhanden — die Betriebskostenabrechnung
          leitet sich daraus ab.
        </Alert>
      ) : rentedUnits.length === 0 ? (
        <Alert variant="warning">
          Keine vermietete Einheit gefunden. Legen Sie ein Mietverhältnis (aktiver Mieter) für
          eine Einheit an.
        </Alert>
      ) : (
        <>
          {/* Auswahl */}
          <div className="mb-5 flex flex-wrap gap-4">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Abrechnungsjahr</p>
              <div className="flex flex-wrap gap-2">
                {statements.map((s) => (
                  <Link
                    key={s.id}
                    href={href({ statement: s.id })}
                    className={`rounded-full px-3 py-1 text-sm ${s.id === statementId ? "bg-brand-green text-white" : "bg-gray-100 text-gray-700"}`}
                  >
                    {s.year}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Vermietete Einheit</p>
              <div className="flex flex-wrap gap-2">
                {rentedUnits.map((u) => (
                  <Link
                    key={u.id}
                    href={href({ unit: u.id })}
                    className={`rounded-full px-3 py-1 text-sm ${u.id === unitId ? "bg-brand-green text-white" : "bg-gray-100 text-gray-700"}`}
                  >
                    {u.label}
                    {u.tenancies[0]?.user?.name ? ` · ${u.tenancies[0].user.name}` : ""}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              {data && r ? (
                <Card title={`Abrechnung ${data.year} — ${data.unitLabel}${data.tenantName ? ` (${data.tenantName})` : ""}`}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="py-2">Umlagefähige Kosten (BetrKV)</th>
                        <th className="py-2 text-right">Anteil Einheit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.recoverableRows.map((row) => (
                        <tr key={row.name} className="border-b border-gray-50">
                          <td className="py-1.5 text-gray-800">{row.name}</td>
                          <td className="py-1.5 text-right text-gray-900">{formatCents(row.cents)}</td>
                        </tr>
                      ))}
                      <tr className="border-b border-gray-100 font-medium">
                        <td className="py-2">Summe umlagefähig</td>
                        <td className="py-2 text-right">{formatCents(r.recoverableSumCents)}</td>
                      </tr>
                      {r.co2LandlordDeductionCents > 0 ? (
                        <tr className="border-b border-gray-100 text-green-700">
                          <td className="py-1.5">abzgl. Vermieter-CO₂-Anteil (CO2KostAufG)</td>
                          <td className="py-1.5 text-right">− {formatCents(r.co2LandlordDeductionCents)}</td>
                        </tr>
                      ) : null}
                      <tr className="border-b border-gray-200 font-semibold">
                        <td className="py-2">Auf den Mieter entfallende Kosten</td>
                        <td className="py-2 text-right">{formatCents(r.tenantCostsCents)}</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-1.5 text-gray-600">abzgl. Vorauszahlungen ({data.months} × {formatCents(data.prepaymentMonthlyCents)})</td>
                        <td className="py-1.5 text-right text-gray-600">− {formatCents(r.prepaymentCents)}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="text-base font-bold">
                        <td className="py-2">{r.balanceCents >= 0 ? "Nachzahlung" : "Guthaben"}</td>
                        <td className={`py-2 text-right ${r.balanceCents > 0 ? "text-red-700" : "text-green-700"}`}>
                          {formatCents(Math.abs(r.balanceCents))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {r.nonRecoverableRows.length > 0 ? (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                        Nicht umlagefähig (trägt der Eigentümer)
                      </p>
                      <ul className="text-xs text-gray-500">
                        {r.nonRecoverableRows.map((row) => (
                          <li key={row.name} className="flex justify-between">
                            <span>{row.name}</span>
                            <span>{formatCents(row.cents)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <a
                      href={`/verwaltung/weg/${property.id}/betriebskosten/pdf?statement=${statementId}&unit=${unitId}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonSecondaryClass}
                    >
                      Abrechnung als PDF
                    </a>
                  </div>
                </Card>
              ) : (
                <Card><EmptyState>Bitte Jahr und Einheit auswählen.</EmptyState></Card>
              )}
            </div>

            <div>
              <Card title="Vorauszahlung des Mieters">
                <form action={savePrepayment} className="space-y-3">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="unitId" value={unitId ?? ""} />
                  <input type="hidden" name="statementId" value={statementId ?? ""} />
                  <Field label="Monatliche Betriebskosten-Vorauszahlung (€)">
                    <input
                      type="text"
                      inputMode="decimal"
                      name="amount"
                      defaultValue={data && data.prepaymentMonthlyCents > 0 ? (data.prepaymentMonthlyCents / 100).toFixed(2).replace(".", ",") : ""}
                      placeholder="z. B. 150,00"
                      className={inputClass}
                    />
                  </Field>
                  <SubmitButton pendingLabel="Wird gespeichert…">Speichern</SubmitButton>
                  <p className="text-xs text-gray-500">
                    Die Jahres-Vorauszahlung ergibt sich aus dem Monatsbetrag × {data?.months ?? 12}.
                  </p>
                </form>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
