import Link from "next/link";
import {
  BackButton,
  Alert,
  Card,
  EmptyState,
  Field,
  PageTitle,
  buttonClass,
  buttonSecondaryClass,
  inputClass,} from "@/components/ui";
import { db } from "@/lib/db";
import { distributionKeyLabels, formatDateOnly } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { requireWegProperty } from "@/lib/weg/scope";
import { createSonderumlage, deleteSonderumlage } from "./actions";

export const dynamic = "force-dynamic";

const KEYS = ["MEA", "FLAECHE", "EINHEITEN", "PERSONEN"] as const;

export default async function SonderumlagenPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ gespeichert?: string; geloescht?: string; fehler?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const sonderumlagen = await db.sonderumlage.findMany({
    where: { propertyId: property.id },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      duePostings: {
        include: { unit: { select: { label: true, orderIndex: true } } },
      },
    },
  });

  const FEHLER: Record<string, string> = {
    betrag: "Der Betrag konnte nicht gelesen werden (Format: 1.234,56).",
    datum: "Das Fälligkeitsdatum konnte nicht gelesen werden.",
    einheiten: "Dieses Objekt hat keine Einheiten.",
    stammdaten:
      "Die Verteilung ist nicht möglich — bitte in den Stammdaten die nötigen Angaben (z. B. MEA/Fläche/Personen) vervollständigen.",
    nichtgefunden: "Sonderumlage nicht gefunden.",
  };

  return (
    <>
      <PageTitle
        action={
          <div className="flex gap-2">
            <Link href={`/verwaltung/weg/${property.id}/hausgeld`} className={buttonSecondaryClass}>
              Hausgeld & offene Posten
            </Link>
            <BackButton href="/verwaltung/weg">WEG-Finanzen</BackButton>
          </div>
        }
      >
        Sonderumlagen · {property.name}
      </PageTitle>

      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">
          Sonderumlage angelegt und auf die Einheiten verteilt — die Sollstellungen erscheinen in
          den offenen Posten und sind mahnbar.
        </Alert>
      ) : null}
      {sp.geloescht ? (
        <Alert variant="success" className="mb-4">
          Sonderumlage und zugehörige Sollstellungen gelöscht.
        </Alert>
      ) : null}
      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {FEHLER[sp.fehler] ?? "Die Eingabe konnte nicht gespeichert werden."}
        </Alert>
      ) : null}

      <div className="grid gap-4">
        <Card title="Neue Sonderumlage anlegen">
          <p className="mb-3 text-sm text-gray-600">
            Einmalige Umlage (z. B. für eine größere Erhaltungsmaßnahme). Der Gesamtbetrag wird
            centgenau nach dem gewählten Schlüssel auf die Einheiten verteilt und je Einheit als
            Sollstellung fällig gestellt. Der Beschluss selbst wird in der Versammlung oder im
            Umlaufverfahren gefasst.
          </p>
          <form action={createSonderumlage} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="propertyId" value={property.id} />
            <Field label="Titel *">
              <input name="title" required minLength={2} maxLength={160} className={inputClass} placeholder="z. B. Sonderumlage Dachsanierung" />
            </Field>
            <Field label="Zweck (optional)">
              <input name="purpose" maxLength={500} className={inputClass} placeholder="z. B. Erneuerung Dacheindeckung" />
            </Field>
            <Field label="Gesamtbetrag (€) *">
              <input name="amount" inputMode="decimal" required className={inputClass} placeholder="0,00" />
            </Field>
            <Field label="Umlageschlüssel *">
              <select name="distributionKey" defaultValue="MEA" className={inputClass}>
                {KEYS.map((k) => (
                  <option key={k} value={k}>
                    {distributionKeyLabels[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fällig am *">
              <input name="dueDate" type="date" required className={inputClass} />
            </Field>
            <Field label="Beschluss-Verweis (optional)">
              <input name="resolutionNote" maxLength={300} className={inputClass} placeholder="z. B. ETV 12.03.2026, TOP 5" />
            </Field>
            <div className="sm:col-span-2">
              <button type="submit" className={buttonClass}>
                Anlegen & verteilen
              </button>
            </div>
          </form>
        </Card>

        <Card title="Sonderumlagen">
          {sonderumlagen.length === 0 ? (
            <EmptyState>Noch keine Sonderumlage angelegt.</EmptyState>
          ) : (
            <div className="grid gap-4">
              {sonderumlagen.map((su) => {
                const rows = [...su.duePostings].sort(
                  (a, b) => (a.unit.orderIndex ?? 0) - (b.unit.orderIndex ?? 0),
                );
                return (
                  <div key={su.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-gray-900">{su.title}</span>
                        <span className="ml-2 text-sm text-gray-500">
                          {formatCents(su.totalAmountCents)} · {distributionKeyLabels[su.distributionKey]}
                        </span>
                        <span className="block text-xs text-gray-400">
                          fällig {formatDateOnly(su.dueDate)}
                          {su.purpose ? ` · ${su.purpose}` : ""}
                          {su.resolutionNote ? ` · ${su.resolutionNote}` : ""} · angelegt von{" "}
                          {su.createdBy.name}
                        </span>
                      </div>
                      <form action={deleteSonderumlage}>
                        <input type="hidden" name="propertyId" value={property.id} />
                        <input type="hidden" name="sonderumlageId" value={su.id} />
                        <button type="submit" className="text-xs text-red-600 underline">
                          Löschen
                        </button>
                      </form>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[360px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                            <th className="py-1.5 pr-3">Einheit</th>
                            <th className="py-1.5 pr-3 text-right">Anteil</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((d) => (
                            <tr key={d.id} className="border-b border-gray-50">
                              <td className="py-1.5 pr-3 text-gray-700">{d.unit.label}</td>
                              <td className="py-1.5 pr-3 text-right text-gray-900">
                                {formatCents(d.amountCents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
