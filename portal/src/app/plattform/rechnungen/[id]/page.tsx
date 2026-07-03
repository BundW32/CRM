import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageTitle, buttonClass, buttonSecondaryClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { INVOICE_TRANSITIONS, formatCents, formatInvoiceNumber, requirePlatformAdmin } from "@/lib/platform";
import type { PlatformInvoiceStatus } from "@/generated/prisma/client";
import { setInvoiceStatus } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<PlatformInvoiceStatus, string> = {
  ENTWURF: "Entwurf",
  OFFEN: "Offen",
  BEZAHLT: "Bezahlt",
  STORNIERT: "Storniert",
};
const ACTION_LABELS: Record<PlatformInvoiceStatus, string> = {
  ENTWURF: "Als Entwurf",
  OFFEN: "Stellen (Offen)",
  BEZAHLT: "Als bezahlt markieren",
  STORNIERT: "Stornieren",
};

export default async function RechnungDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const { fehler } = await searchParams;

  const inv = await db.platformInvoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      organization: { select: { id: true, name: true } },
    },
  });
  if (!inv) notFound();

  const net = inv.items.reduce((s, it) => s + it.quantity * it.unitPriceCents, 0);
  const vat = Math.round(net * (inv.vatRate / 100));
  const gross = net + vat;
  const nextStates = INVOICE_TRANSITIONS[inv.status];

  return (
    <>
      <PageTitle
        action={
          <Link href="/plattform/rechnungen" className={buttonSecondaryClass}>
            ← Rechnungen
          </Link>
        }
      >
        {formatInvoiceNumber(inv.year, inv.number)}
      </PageTitle>

      {fehler === "status" ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Dieser Status-Übergang ist nicht erlaubt.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={inv.title}>
            <p className="mb-3 text-sm text-gray-500">
              {inv.organization.name} · Status <strong>{STATUS_LABELS[inv.status]}</strong>
              {inv.issuedAt ? <> · gestellt {formatDate(inv.issuedAt)}</> : null}
              {inv.dueAt ? <> · fällig {formatDate(inv.dueAt)}</> : null}
              {inv.paidAt ? <> · bezahlt {formatDate(inv.paidAt)}</> : null}
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                    <th className="py-2">Beschreibung</th>
                    <th className="py-2 text-right">Menge</th>
                    <th className="py-2 text-right">Einzel</th>
                    <th className="py-2 text-right">Summe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {inv.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 text-gray-800">{it.description}</td>
                      <td className="py-2 text-right text-gray-600">{it.quantity}</td>
                      <td className="py-2 text-right text-gray-600">{formatCents(it.unitPriceCents)}</td>
                      <td className="py-2 text-right text-gray-800">{formatCents(it.quantity * it.unitPriceCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3} className="py-1 text-right text-gray-500">Netto</td><td className="py-1 text-right text-gray-700">{formatCents(net)}</td></tr>
                  <tr><td colSpan={3} className="py-1 text-right text-gray-500">zzgl. USt {inv.vatRate}%</td><td className="py-1 text-right text-gray-700">{formatCents(vat)}</td></tr>
                  <tr><td colSpan={3} className="py-1 text-right font-semibold text-gray-800">Gesamt</td><td className="py-1 text-right font-semibold text-gray-900">{formatCents(gross)}</td></tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Aktionen">
            <a href={`/api/plattform/rechnungen/${inv.id}/pdf`} target="_blank" rel="noreferrer" className={`${buttonClass} w-full`}>
              PDF öffnen
            </a>
            {nextStates.length > 0 ? (
              <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                {nextStates.map((s) => (
                  <form key={s} action={setInvoiceStatus}>
                    <input type="hidden" name="id" value={inv.id} />
                    <input type="hidden" name="status" value={s} />
                    <button
                      type="submit"
                      className={s === "STORNIERT" ? "text-sm text-red-600 hover:underline" : buttonSecondaryClass}
                    >
                      {ACTION_LABELS[s]}
                    </button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
                Endstatus – keine weiteren Übergänge.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
