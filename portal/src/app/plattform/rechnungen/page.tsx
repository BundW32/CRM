import Link from "next/link";
import { PageTitle, buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { formatCents, formatInvoiceNumber, invoiceGrossCents, requirePlatformAdmin } from "@/lib/platform";
import type { PlatformInvoiceStatus, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<PlatformInvoiceStatus, string> = {
  ENTWURF: "Entwurf",
  OFFEN: "Offen",
  BEZAHLT: "Bezahlt",
  STORNIERT: "Storniert",
};
const STATUS_TONE: Record<PlatformInvoiceStatus, string> = {
  ENTWURF: "bg-gray-100 text-gray-600",
  OFFEN: "bg-amber-100 text-amber-800",
  BEZAHLT: "bg-green-100 text-green-800",
  STORNIERT: "bg-red-100 text-red-700",
};

const STATUSES: PlatformInvoiceStatus[] = ["ENTWURF", "OFFEN", "BEZAHLT", "STORNIERT"];

const gross = invoiceGrossCents;

export default async function RechnungenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const statusFilter = STATUSES.includes(sp.status as PlatformInvoiceStatus)
    ? (sp.status as PlatformInvoiceStatus)
    : null;

  const where: Prisma.PlatformInvoiceWhereInput = statusFilter ? { status: statusFilter } : {};

  const [invoices, openInvoices] = await Promise.all([
    db.platformInvoice.findMany({
      where,
      orderBy: [{ year: "desc" }, { number: "desc" }],
      take: 200,
      include: {
        items: { select: { quantity: true, unitPriceCents: true } },
        organization: { select: { name: true } },
      },
    }),
    db.platformInvoice.findMany({
      where: { status: "OFFEN" },
      select: { vatRate: true, dueAt: true, items: { select: { quantity: true, unitPriceCents: true } } },
    }),
  ]);

  const now = new Date();
  const openSum = openInvoices.reduce((s, inv) => s + gross(inv.vatRate, inv.items), 0);
  const overdue = openInvoices.filter((inv) => inv.dueAt && inv.dueAt < now).length;

  function chip(status: PlatformInvoiceStatus | null) {
    const active = statusFilter === status;
    const href = status ? `/plattform/rechnungen?status=${status}` : "/plattform/rechnungen";
    return (
      <Link
        key={status ?? "alle"}
        href={href}
        className={`rounded-full border px-3 py-1 text-xs ${active ? "border-brand-orange bg-brand-orange text-white" : "border-gray-300 bg-white text-gray-600"}`}
      >
        {status ? STATUS_LABELS[status] : "Alle"}
      </Link>
    );
  }

  return (
    <>
      <PageTitle
        action={
          <Link href="/plattform/rechnungen/neu" className={buttonClass}>
            + Neue Rechnung
          </Link>
        }
      >
        Rechnungen
      </PageTitle>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-brand-green">{formatCents(openSum)}</p>
          <p className="text-xs text-gray-500">Offen gesamt</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className={`text-2xl font-bold ${overdue > 0 ? "text-red-600" : "text-brand-green"}`}>{overdue}</p>
          <p className="text-xs text-gray-500">Überfällig</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">{[null, ...STATUSES].map((s) => chip(s))}</div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3">Nummer</th>
              <th className="px-4 py-3">Verwaltung</th>
              <th className="px-4 py-3">Titel</th>
              <th className="px-4 py-3">Brutto</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Fällig</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Keine Rechnungen.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/plattform/rechnungen/${inv.id}`} className="font-medium text-brand-green hover:underline">
                      {formatInvoiceNumber(inv.year, inv.number)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{inv.organization.name}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.title}</td>
                  <td className="px-4 py-3 text-gray-800">{formatCents(gross(inv.vatRate, inv.items))}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[inv.status]}`}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{inv.dueAt ? formatDate(inv.dueAt) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
