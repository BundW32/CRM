import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Card, EmptyState, PageTitle, buttonSecondaryClass } from "@/components/ui";
import { ownedUnitIdsInProperty, wegPropertiesForOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDateOnly } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { requireUser } from "@/lib/session";
import type { StatementView } from "@/lib/weg/statement-service";

export const dynamic = "force-dynamic";

// Eigentümer-Finanzansicht (Belegeinsicht, § WEG): jeder Eigentümer sieht seine
// eigene Jahresabrechnung, seinen Hausgeld-Saldo und – als Ersatz für den
// „Ordner-Termin" – die Belege der WEG-Buchhaltung. Reine Leseansicht.
export default async function FinanzenPage({
  searchParams,
}: {
  searchParams: Promise<{ objekt?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "EIGENTUEMER") redirect("/dashboard");
  const { objekt } = await searchParams;

  const wegProps = await wegPropertiesForOwner(user.id, user.organizationId);
  if (wegProps.length === 0) {
    return (
      <>
        <PageTitle>Finanzen</PageTitle>
        <Card>
          <EmptyState>
            Für Sie ist aktuell keine Wohnungseigentümergemeinschaft mit Finanzdaten hinterlegt.
          </EmptyState>
        </Card>
      </>
    );
  }
  const selected = wegProps.find((p) => p.id === objekt) ?? wegProps[0];
  const now = new Date();

  const myUnitIds = await ownedUnitIdsInProperty(user.id, selected.id);

  const [statements, plans, myUnits, dueSums, paidSums, bookings] = await Promise.all([
    db.annualStatement.findMany({
      where: { propertyId: selected.id, status: "FERTIG" },
      orderBy: { year: "desc" },
    }),
    // Beschlossene Wirtschaftspläne (Entwürfe sind Verwalter-Arbeitsstände).
    db.economicPlan.findMany({
      where: { propertyId: selected.id, status: "BESCHLOSSEN" },
      orderBy: { year: "desc" },
      select: { id: true, year: true, resolvedAt: true, resolutionNote: true },
    }),
    db.unit.findMany({
      where: { id: { in: myUnitIds } },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    }),
    db.duePosting.groupBy({
      by: ["unitId"],
      where: { unitId: { in: myUnitIds }, dueDate: { lte: now } },
      _sum: { amountCents: true },
    }),
    db.booking.groupBy({
      by: ["unitId"],
      where: { unitId: { in: myUnitIds }, kind: "EINNAHME" },
      _sum: { amountCents: true },
    }),
    // Belegeinsicht: alle Buchungen der WEG (Leserecht der Gemeinschaft)
    db.booking.findMany({
      where: { propertyId: selected.id },
      include: { account: { select: { name: true } }, costType: { select: { name: true } } },
      orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
  ]);

  const dueByUnit = new Map(dueSums.map((d) => [d.unitId, d._sum.amountCents ?? 0]));
  const paidByUnit = new Map(paidSums.map((p) => [p.unitId as string, p._sum.amountCents ?? 0]));

  const euro = (c: number) => formatCents(c);

  return (
    <>
      <PageTitle>Finanzen · {selected.name}</PageTitle>

      {wegProps.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {wegProps.map((p) => (
            <Link
              key={p.id}
              href={`/finanzen?objekt=${p.id}`}
              className={`rounded-full px-3 py-1 text-sm ${
                p.id === selected.id ? "bg-brand-green text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4">
        {/* Meine Jahresabrechnungen */}
        <Card title="Meine Jahresabrechnungen">
          {statements.length === 0 ? (
            <EmptyState>Noch keine fertiggestellte Jahresabrechnung.</EmptyState>
          ) : myUnitIds.length === 0 ? (
            <Alert variant="info">
              Ihnen ist in diesem Objekt noch keine Einheit zugeordnet — bitte wenden Sie sich an
              die Verwaltung.
            </Alert>
          ) : (
            <div className="grid gap-3">
              {statements.map((s) => {
                const view = s.snapshot as unknown as StatementView | null;
                return (
                  <div key={s.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900">Wirtschaftsjahr {s.year}</span>
                      <span className="text-xs text-gray-400">
                        fertiggestellt {s.finalizedAt ? formatDateOnly(s.finalizedAt) : ""}
                      </span>
                    </div>
                    {view
                      ? myUnits.map((u) => {
                          const total = view.perUnitTotal?.[u.id] ?? 0;
                          const peak = view.peak?.[u.id] ?? 0;
                          const labor = view.labor?.[u.id];
                          return (
                            <div key={u.id} className="mt-2 flex flex-wrap items-baseline justify-between gap-2 border-t border-gray-100 pt-2">
                              <div>
                                <span className="text-sm font-medium text-gray-800">{u.label}</span>
                                <span className="ml-2 text-sm text-gray-500">
                                  Kostenanteil {euro(total)}
                                </span>
                                {labor && (labor.haushaltsnah > 0 || labor.handwerker > 0) ? (
                                  <span className="ml-2 text-xs text-gray-400">
                                    §35a: {euro(labor.haushaltsnah)} haushaltsnah ·{" "}
                                    {euro(labor.handwerker)} Handwerker
                                  </span>
                                ) : null}
                              </div>
                              <span
                                className={`text-sm font-semibold ${
                                  peak > 0 ? "text-red-700" : peak < 0 ? "text-green-700" : "text-gray-700"
                                }`}
                              >
                                {peak > 0 ? "Nachschuss " : peak < 0 ? "Guthaben " : ""}
                                {euro(Math.abs(peak))}
                              </span>
                            </div>
                          );
                        })
                      : null}
                    <div className="mt-3">
                      <a
                        href={`/finanzen/abrechnung/${s.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonSecondaryClass}
                      >
                        Meine Einzelabrechnung als PDF
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Wirtschaftsplan (beschlossen) */}
        <Card title="Wirtschaftsplan">
          {plans.length === 0 ? (
            <EmptyState>Noch kein beschlossener Wirtschaftsplan.</EmptyState>
          ) : (
            <div className="grid gap-3">
              {plans.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-4">
                  <div>
                    <span className="font-semibold text-gray-900">Wirtschaftsjahr {p.year}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      beschlossen{p.resolvedAt ? ` ${formatDateOnly(p.resolvedAt)}` : ""}
                      {p.resolutionNote ? ` · ${p.resolutionNote}` : ""}
                    </span>
                  </div>
                  <a
                    href={`/finanzen/wirtschaftsplan/${p.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonSecondaryClass}
                  >
                    Wirtschaftsplan als PDF
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Mein Hausgeld */}
        {myUnits.length > 0 ? (
          <Card title="Mein Hausgeld (Stand heute)">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Einheit</th>
                    <th className="py-2 pr-3 text-right">Soll (fällig)</th>
                    <th className="py-2 pr-3 text-right">Gezahlt</th>
                    <th className="py-2 pr-3 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {myUnits.map((u) => {
                    const due = dueByUnit.get(u.id) ?? 0;
                    const paid = paidByUnit.get(u.id) ?? 0;
                    const saldo = paid - due;
                    return (
                      <tr key={u.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-900">{u.label}</td>
                        <td className="py-2 pr-3 text-right">{euro(due)}</td>
                        <td className="py-2 pr-3 text-right">{euro(paid)}</td>
                        <td
                          className={`py-2 pr-3 text-right font-semibold ${
                            saldo < 0 ? "text-red-700" : "text-green-700"
                          }`}
                        >
                          {saldo < 0 ? "−" : saldo > 0 ? "+" : ""}
                          {euro(Math.abs(saldo))}
                          {saldo < 0 ? <span className="block text-xs font-normal text-red-500">offen</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {/* Belegeinsicht */}
        <Card title="Belegeinsicht — Buchhaltung der Gemeinschaft">
          <p className="mb-3 text-sm text-gray-500">
            Als Eigentümer können Sie alle Buchungen Ihrer Gemeinschaft einsehen und die
            hinterlegten Belege öffnen — die digitale Belegeinsicht ersetzt den Ordner-Termin.
          </p>
          {bookings.length === 0 ? (
            <EmptyState>Noch keine Buchungen erfasst.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Datum</th>
                    <th className="py-2 pr-3">Konto</th>
                    <th className="py-2 pr-3">Text</th>
                    <th className="py-2 pr-3">Kostenart</th>
                    <th className="py-2 pr-3 text-right">Betrag</th>
                    <th className="py-2">Beleg</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const sign = b.kind === "EINNAHME" ? 1 : b.kind === "AUSGABE" ? -1 : b.transferOut ? -1 : 1;
                    return (
                      <tr key={b.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                          {formatDateOnly(b.bookingDate)}
                        </td>
                        <td className="py-2 pr-3 text-gray-600">{b.account.name}</td>
                        <td className="py-2 pr-3 text-gray-900">{b.text}</td>
                        <td className="py-2 pr-3 text-gray-600">{b.costType?.name ?? "—"}</td>
                        <td
                          className={`py-2 pr-3 text-right font-medium whitespace-nowrap ${
                            sign < 0 ? "text-red-700" : "text-green-700"
                          }`}
                        >
                          {sign < 0 ? "−" : "+"}
                          {euro(b.amountCents)}
                        </td>
                        <td className="py-2">
                          {b.belegStoredName ? (
                            <a
                              href={`/api/files/beleg/${b.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm underline"
                            >
                              ansehen
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
