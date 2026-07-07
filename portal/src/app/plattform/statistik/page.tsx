import Link from "next/link";
import { BarChart } from "@/components/bar-chart";
import { Card, PageTitle, buttonSecondaryClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatCents, invoiceGrossCents, requirePlatformAdmin } from "@/lib/platform";
import { bucketByMonth, lastNMonths } from "@/lib/platform-stats";

export const dynamic = "force-dynamic";

export default async function StatistikPage() {
  await requirePlatformAdmin();
  const now = new Date();
  const months = lastNMonths(now, 12);

  const [orgs, paidInvoices] = await Promise.all([
    db.organization.findMany({ select: { createdAt: true } }),
    db.platformInvoice.findMany({
      where: { status: "BEZAHLT", paidAt: { not: null } },
      select: { paidAt: true, vatRate: true, items: { select: { quantity: true, unitPriceCents: true } } },
    }),
  ]);

  const signupSeries = bucketByMonth(
    orgs.map((o) => ({ date: o.createdAt, value: 1 })),
    months,
  );
  const revenueSeries = bucketByMonth(
    paidInvoices.map((inv) => ({ date: inv.paidAt as Date, value: invoiceGrossCents(inv.vatRate, inv.items) })),
    months,
  );
  const revenueTotal = revenueSeries.reduce((s, v) => s + v, 0);
  const signupTotal = signupSeries.reduce((s, v) => s + v, 0);

  const signupData = months.map((m, i) => ({ label: m.label, value: signupSeries[i] }));
  const revenueData = months.map((m, i) => ({ label: m.label, value: revenueSeries[i] }));

  return (
    <>
      <PageTitle
        action={
          <div className="flex flex-wrap gap-2">
            {/* Datei-Downloads (API-Routen mit Content-Disposition) – bewusst als
                <a>, nicht <Link>, damit der Browser die Datei speichert. */}
            {/* eslint-disable @next/next/no-html-link-for-pages */}
            <a href="/api/plattform/export/verwaltungen" className={buttonSecondaryClass}>CSV Verwaltungen</a>
            <a href="/api/plattform/export/rechnungen" className={buttonSecondaryClass}>CSV Rechnungen</a>
            <a href="/api/plattform/export/datev" className={buttonSecondaryClass}>DATEV (bezahlt)</a>
            {/* eslint-enable @next/next/no-html-link-for-pages */}
          </div>
        }
      >
        Auswertungen
      </PageTitle>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Neuanmeldungen (12 Monate · ${signupTotal})`}>
          <BarChart data={signupData} />
        </Card>
        <Card title={`Umsatz bezahlter Rechnungen (12 Monate · ${formatCents(revenueTotal)})`}>
          <BarChart data={revenueData} formatValue={(v) => formatCents(v)} barClass="bg-brand-green" />
        </Card>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Umsatz = Bruttosumme der als bezahlt markierten Rechnungen im Monat der Zahlung.
        Die CSV-Exporte enthalten alle Verwaltungen bzw. Rechnungen; der DATEV-Export
        listet die bezahlten Rechnungen im buchhaltungsfreundlichen Format.{" "}
        <Link href="/plattform" className="underline">Zur Übersicht</Link>
      </p>
    </>
  );
}
