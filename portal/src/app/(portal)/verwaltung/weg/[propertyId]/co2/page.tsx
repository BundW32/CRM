import Link from "next/link";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Alert, Card, EmptyState, Field, PageTitle, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { CO2_STEPS_RESIDENTIAL } from "@/lib/weg/co2";
import { co2PerUnit } from "@/lib/weg/co2-allocation";
import { requireWegProperty } from "@/lib/weg/scope";
import { deleteCo2Allocation, saveCo2Allocation } from "./actions";

export const dynamic = "force-dynamic";

const FEHLER: Record<string, string> = {
  betrag: "Der CO₂-Kostenbetrag konnte nicht gelesen werden (Format: 1.234,56).",
  emissionen: "Die Emissionsmenge konnte nicht gelesen werden.",
};

export default async function Co2Page({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ gespeichert?: string; fehler?: string; jahr?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const [units, allocations] = await Promise.all([
    db.unit.findMany({
      where: { propertyId: property.id },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
      select: { id: true, label: true, mea: true, livingArea: true, personCount: true },
    }),
    db.co2Allocation.findMany({ where: { propertyId: property.id }, orderBy: { year: "desc" } }),
  ]);

  const selectedYear = sp.jahr ? Number(sp.jahr) : allocations[0]?.year;
  const allocation = allocations.find((a) => a.year === selectedYear) ?? allocations[0] ?? null;

  // Gebäudeweite Aufteilung + centgenaue Verteilung auf die Einheiten nach Fläche.
  const alloc = allocation
    ? co2PerUnit({ totalCo2Cents: allocation.totalCo2Cents, emissionsKg: allocation.emissionsKg, units })
    : null;
  const totalArea = alloc?.totalArea ?? Math.round(units.reduce((s, u) => s + (u.livingArea ?? 0), 0) * 100) / 100;
  const split = alloc?.split ?? null;
  const perUnit = alloc
    ? units.map((u) => {
        const c = alloc.perUnit.get(u.id)!;
        return { label: u.label, area: c.area, landlord: c.landlord, tenant: c.tenant };
      })
    : [];

  const currentYear = new Date().getFullYear();

  return (
    <>
      <PageTitle
        back={{ href: `/verwaltung/weg/${property.id}`, label: property.name }}
      >
        CO₂-Kostenaufteilung · {property.name}
      </PageTitle>

      <p className="mb-4 max-w-3xl text-sm text-gray-300">
        Aufteilung des CO₂-Preises der Heizkosten zwischen Vermieter und Mieter nach dem
        10-Stufen-Modell des CO₂KostAufG (Wohngebäude). Datenbasis für vermietende
        Eigentümer. <strong>Muster — ersetzt keine Rechtsberatung.</strong>
      </p>

      {sp.fehler ? (
        <Alert variant="error" className="mb-4">{FEHLER[sp.fehler] ?? "Eingabe fehlerhaft."}</Alert>
      ) : null}
      {sp.gespeichert && sp.gespeichert !== "geloescht" ? (
        <Alert variant="success" className="mb-4">Gespeichert.</Alert>
      ) : null}
      {sp.gespeichert === "geloescht" ? (
        <Alert variant="success" className="mb-4">Eintrag gelöscht.</Alert>
      ) : null}

      {totalArea <= 0 ? (
        <Alert variant="warning" className="mb-4">
          Für die Aufteilung werden Wohnflächen der Einheiten benötigt — bitte in den
          Stammdaten ergänzen.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {allocation && split ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Spezifischer Ausstoß</p>
                  <p className="mt-1 text-2xl font-bold text-brand-green">
                    {split.perSqm.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
                  </p>
                  <p className="text-xs text-gray-400">kg CO₂/m²·a · Stufe {split.step.label}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Vermieteranteil</p>
                  <p className="mt-1 text-2xl font-bold text-red-700">{formatCents(split.landlordCents)}</p>
                  <p className="text-xs text-gray-400">{split.step.landlordPct} % der CO₂-Kosten</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Mieteranteil</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{formatCents(split.tenantCents)}</p>
                  <p className="text-xs text-gray-400">{split.step.tenantPct} % der CO₂-Kosten</p>
                </div>
              </div>

              <Card title={`Aufteilung je Einheit (${allocation.year})`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="py-2 pr-3">Einheit</th>
                        <th className="py-2 pr-3 text-right">Fläche</th>
                        <th className="py-2 pr-3 text-right">Vermieteranteil</th>
                        <th className="py-2 text-right">Mieteranteil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perUnit.map((r) => (
                        <tr key={r.label} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 pr-3 font-medium text-gray-800">{r.label}</td>
                          <td className="py-2 pr-3 text-right text-gray-600">{r.area > 0 ? `${r.area} m²` : "–"}</td>
                          <td className="py-2 pr-3 text-right text-red-700">{formatCents(r.landlord)}</td>
                          <td className="py-2 text-right text-gray-900">{formatCents(r.tenant)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 font-semibold">
                        <td className="py-2 pr-3">Summe</td>
                        <td className="py-2 pr-3 text-right">{totalArea} m²</td>
                        <td className="py-2 pr-3 text-right text-red-700">{formatCents(split.landlordCents)}</td>
                        <td className="py-2 text-right">{formatCents(split.tenantCents)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="mt-3 text-xs text-gray-400">
                  Der CO₂-Kostenbetrag wird nach Wohnfläche auf die Einheiten verteilt; je
                  Einheit gilt der gebäudeweite Vermieter-/Mieteranteil.
                </p>
              </Card>
            </>
          ) : (
            <Card>
              <EmptyState>
                Noch keine CO₂-Daten erfasst. Tragen Sie rechts den CO₂-Kostenanteil und die
                Emissionen aus der Brennstoffrechnung ein.
              </EmptyState>
            </Card>
          )}

          {/* Stufentabelle zur Orientierung */}
          <Card title="10-Stufen-Modell (Wohngebäude)">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-1.5 pr-3">kg CO₂/m²·a</th>
                    <th className="py-1.5 pr-3 text-right">Mieter</th>
                    <th className="py-1.5 text-right">Vermieter</th>
                  </tr>
                </thead>
                <tbody>
                  {CO2_STEPS_RESIDENTIAL.map((s) => {
                    const active = split && split.step.label === s.label;
                    return (
                      <tr key={s.label} className={`border-b border-gray-50 last:border-0 ${active ? "bg-brand-orange-light/40 font-semibold" : ""}`}>
                        <td className="py-1.5 pr-3">{s.label}</td>
                        <td className="py-1.5 pr-3 text-right">{s.tenantPct} %</td>
                        <td className="py-1.5 text-right">{s.landlordPct} %</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="CO₂-Daten erfassen">
            <form action={saveCo2Allocation} className="space-y-3">
              <input type="hidden" name="propertyId" value={property.id} />
              <Field label="Abrechnungsjahr">
                <input type="number" name="year" min={2020} max={2100} defaultValue={allocation?.year ?? currentYear - 1} required className={inputClass} />
              </Field>
              <Field label="CO₂-Kostenanteil (€)">
                <input type="text" inputMode="decimal" name="totalCo2" defaultValue={allocation ? (allocation.totalCo2Cents / 100).toFixed(2).replace(".", ",") : ""} placeholder="z. B. 480,00" required className={inputClass} />
              </Field>
              <Field label="Gesamtemissionen (kg CO₂)">
                <input type="text" inputMode="decimal" name="emissionsKg" defaultValue={allocation ? String(allocation.emissionsKg) : ""} placeholder="z. B. 8500" required className={inputClass} />
              </Field>
              <Field label="Notiz (optional)">
                <textarea name="note" defaultValue={allocation?.note ?? ""} rows={2} className={inputClass} />
              </Field>
              <SubmitButton pendingLabel="Wird gespeichert…">Speichern & berechnen</SubmitButton>
              <p className="text-xs text-gray-500">
                CO₂-Kostenanteil und Emissionsmenge stehen auf der Brennstoff-/Wärmerechnung
                (Ausweispflicht des Lieferanten, § 2 CO₂KostAufG).
              </p>
            </form>
          </Card>

          {allocations.length > 0 ? (
            <Card title="Erfasste Jahre">
              <ul className="space-y-2">
                {allocations.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/verwaltung/weg/${property.id}/co2?jahr=${a.year}`}
                      className={`text-sm ${a.year === allocation?.year ? "font-semibold text-brand-green" : "text-gray-700 hover:underline"}`}
                    >
                      {a.year} · {formatCents(a.totalCo2Cents)} CO₂-Kosten
                    </Link>
                    <form action={deleteCo2Allocation}>
                      <input type="hidden" name="propertyId" value={property.id} />
                      <input type="hidden" name="id" value={a.id} />
                      <ConfirmActionButton
                        className="text-xs text-red-600 hover:underline"
                        confirmLabel="Wirklich löschen?"
                        pendingLabel="Wird gelöscht…"
                      >
                        löschen
                      </ConfirmActionButton>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
