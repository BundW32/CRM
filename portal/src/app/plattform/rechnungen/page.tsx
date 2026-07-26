import Link from "next/link";
import { Alert, Card, PageTitle, Pagination, buttonClass, buttonSecondaryClass } from "@/components/ui";
import { FilterBar, SortControl, type FilterConfig } from "@/components/filter-bar";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { normalizeSearch, pageHrefFor, parsePage, resolveSort, toOrderBy } from "@/lib/list-query";
import { formatCents, formatInvoiceNumber, invoiceGrossCents, requirePlatformAdmin } from "@/lib/platform";
import { canRemindAgain, reminderLevelLabel } from "@/lib/dunning";
import { isMailEnabled } from "@/lib/mailer";
import type { PlatformInvoiceStatus, Prisma } from "@/generated/prisma/client";
import { sendAllDueReminders, sendReminder } from "./actions";

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

const PAGE_SIZE = 50;

// Whitelist der Sortierfelder (verhindert beliebige Felder aus der URL).
// Bewusst OHNE Betrag: die Summe entsteht erst aus den Positionen und steht
// nicht als Spalte in der Tabelle – danach könnte die Datenbank nicht ordnen.
const SORT_FIELDS = {
  nummer: "number",
  faellig: "dueAt",
  status: "status",
  verwaltung: "organization.name",
} as const;

const sortOptions = [
  { value: "nummer", label: "Rechnungsnummer" },
  { value: "faellig", label: "Fällig am" },
  { value: "status", label: "Status" },
  { value: "verwaltung", label: "Verwaltung" },
];

const gross = invoiceGrossCents;

export default async function RechnungenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const statusFilter = STATUSES.includes(sp.status as PlatformInvoiceStatus)
    ? (sp.status as PlatformInvoiceStatus)
    : null;
  const mailReady = isMailEnabled();
  const now = new Date();
  const currentPage = parsePage(sp.page);
  const sort = resolveSort(sp.sort, sp.dir, SORT_FIELDS, "nummer", "desc");
  // Rechnungsnummern laufen pro Jahr – ohne das Jahr davor stünde die 1 aus
  // diesem Jahr neben der 1 aus dem letzten.
  const invoiceOrderBy =
    sort.key === "nummer"
      ? [{ year: sort.dir }, { number: sort.dir }]
      : toOrderBy(sort.field, sort.dir);
  const q = normalizeSearch(sp.q);
  const jahr = /^\d{4}$/.test(sp.jahr ?? "") ? Number(sp.jahr) : undefined;

  const whereAnd: Prisma.PlatformInvoiceWhereInput[] = [];
  if (statusFilter) whereAnd.push({ status: statusFilter });
  if (jahr) whereAnd.push({ year: jahr });
  if (q) whereAnd.push({ organization: { name: { contains: q, mode: "insensitive" } } });
  const where: Prisma.PlatformInvoiceWhereInput = whereAnd.length > 0 ? { AND: whereAnd } : {};
  const hasFilter = Boolean(statusFilter || jahr || q);

  const [invoices, invoiceTotal, openInvoices, overdueInvoices] = await Promise.all([
    db.platformInvoice.findMany({
      where,
      orderBy: invoiceOrderBy,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        items: { select: { quantity: true, unitPriceCents: true } },
        organization: { select: { name: true } },
      },
    }),
    db.platformInvoice.count({ where }),
    db.platformInvoice.findMany({
      where: { status: "OFFEN" },
      select: { vatRate: true, dueAt: true, items: { select: { quantity: true, unitPriceCents: true } } },
    }),
    db.platformInvoice.findMany({
      where: { status: "OFFEN", dueAt: { lt: now } },
      orderBy: { dueAt: "asc" },
      include: {
        items: { select: { quantity: true, unitPriceCents: true } },
        organization: { select: { name: true } },
      },
    }),
  ]);

  const openSum = openInvoices.reduce((s, inv) => s + gross(inv.vatRate, inv.items), 0);
  const overdue = overdueInvoices.length;
  const remindableCount = overdueInvoices.filter((inv) => canRemindAgain(inv.lastReminderAt, now)).length;

  // Jahres-Auswahl aus dem Bestand ableiten (keine leeren Jahrgänge).
  const oldest = await db.platformInvoice.findFirst({
    orderBy: { year: "asc" },
    select: { year: true },
  });
  const thisYear = new Date().getFullYear();
  const firstYear = oldest?.year ?? thisYear;
  const invoiceFilters: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      allLabel: "Alle Status",
      primary: true,
      options: STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    },
    {
      key: "jahr",
      label: "Jahr",
      allLabel: "Alle Jahre",
      options: Array.from({ length: Math.max(1, thisYear - firstYear + 1) }, (_, i) => {
        const y = thisYear - i;
        return { value: String(y), label: String(y) };
      }),
    },
  ];

  const pageHref = pageHrefFor(`/plattform/rechnungen`, sp);

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

      {sp.gemahnt ? (
        <Alert variant="success" className="mb-4">
          {sp.gemahnt} Mahnung(en) versendet.
        </Alert>
      ) : null}
      {sp.mahnung ? (
        <Alert variant="info" className="mb-4">
          {sp.mahnung === "sent"
            ? "Mahnung versendet."
            : sp.mahnung === "too_soon"
              ? "Zuletzt vor weniger als 7 Tagen gemahnt – bitte später erneut."
              : sp.mahnung === "not_overdue"
                ? "Rechnung ist nicht (mehr) überfällig."
                : sp.mahnung === "no_recipient"
                  ? "Kein Empfänger hinterlegt."
                  : sp.mahnung === "mail_disabled"
                    ? "E-Mail-Versand ist nicht konfiguriert (SMTP)."
                    : sp.mahnung === "limit"
                      ? "Bitte kurz warten – Sammel-Mahnung gerade ausgeführt."
                      : "Mahnung nicht möglich."}
        </Alert>
      ) : null}

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

      {overdueInvoices.length > 0 ? (
        <div className="mb-6">
          <Card
            title={
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>Überfällige Rechnungen ({overdue})</span>
                {mailReady && remindableCount > 0 ? (
                  <form action={sendAllDueReminders}>
                    <button type="submit" className={buttonSecondaryClass}>
                      Alle fälligen mahnen ({remindableCount})
                    </button>
                  </form>
                ) : null}
              </span>
            }
          >
            {!mailReady ? (
              <p className="mb-2 text-xs text-amber-600">E-Mail-Versand nicht konfiguriert (SMTP) – Mahnungen deaktiviert.</p>
            ) : null}
            <ul className="divide-y divide-gray-50">
              {overdueInvoices.map((inv) => {
                const canRemind = mailReady && canRemindAgain(inv.lastReminderAt, now);
                return (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <Link href={`/plattform/rechnungen/${inv.id}`} className="font-medium text-brand-green hover:underline">
                        {formatInvoiceNumber(inv.year, inv.number)}
                      </Link>
                      <span className="text-gray-500"> · {inv.organization.name} · fällig {formatDate(inv.dueAt!)}</span>
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {reminderLevelLabel(inv.reminderLevel)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{formatCents(gross(inv.vatRate, inv.items))}</span>
                      <form action={sendReminder}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button
                          type="submit"
                          disabled={!canRemind}
                          className="text-xs font-medium text-brand-orange-dark hover:underline disabled:text-gray-300"
                          title={!canRemind ? "Zuletzt vor <7 Tagen gemahnt oder SMTP fehlt" : undefined}
                        >
                          Mahnung senden
                        </button>
                      </form>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      ) : null}

      <FilterBar
        searchPlaceholder="Suchen"
        searchHint="Nach Verwaltung suchen"
        filters={invoiceFilters}
      />
      <div className="mb-3 mt-2 flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-gray-400">
          {invoiceTotal} {invoiceTotal === 1 ? "Rechnung" : "Rechnungen"}
          {hasFilter ? " (gefiltert)" : ""}
        </p>
        <SortControl sortOptions={sortOptions} defaultSort="nummer" total={invoiceTotal} />
      </div>

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

      <Pagination
        currentPage={currentPage}
        totalPages={Math.max(1, Math.ceil(invoiceTotal / PAGE_SIZE))}
        total={invoiceTotal}
        itemLabel="Rechnungen"
        hrefFor={pageHref}
      />
    </>
  );
}
