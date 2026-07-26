import { PageTitle, Pagination } from "@/components/ui";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { db } from "@/lib/db";
import { normalizeSearch, parsePage, pageHrefFor } from "@/lib/list-query";
import { requirePlatformAdmin } from "@/lib/platform";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// Mandantenübergreifende Ansicht – inkl. Plattform-Aktionen und System-Einträgen.
const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Login",
  LOGIN_FAILED: "Login fehlgeschlagen",
  PASSWORD_RESET_REQUEST: "Passwort-Reset angefordert",
  USER_ANONYMIZED: "Nutzer anonymisiert (DSGVO)",
  TICKET_CLOSED: "Vorgang geschlossen",
  TICKET_REOPENED: "Vorgang wieder geöffnet",
  TICKET_EXTERNAL_RELEASED: "Externe Beauftragung freigegeben",
  DSGVO_EXPORT: "DSGVO-Datenexport",
  PLATFORM_ACCESS: "Plattform-Zugriff",
  PLATFORM_ORG_DEACTIVATED: "Verwaltung deaktiviert",
  PLATFORM_ORG_REACTIVATED: "Verwaltung reaktiviert",
  PLATFORM_ORG_PLAN_CHANGED: "Tarif/Status geändert",
  PLATFORM_TRIAL_EXTENDED: "Testphase verlängert",
  PLATFORM_NOTE_SAVED: "Notiz gespeichert",
  PLATFORM_INVOICE_CREATED: "Rechnung erstellt",
  PLATFORM_INVOICE_STATUS: "Rechnungsstatus geändert",
  PLATFORM_INVOICE_DOWNLOADED: "Rechnung heruntergeladen",
};

// Chips: die wichtigsten Filter (nicht jede Aktion, um die Leiste kurz zu halten).
const FILTER_ACTIONS = [
  "PLATFORM_ORG_DEACTIVATED",
  "PLATFORM_ORG_PLAN_CHANGED",
  "PLATFORM_TRIAL_EXTENDED",
  "PLATFORM_INVOICE_CREATED",
  "PLATFORM_INVOICE_STATUS",
  "LOGIN_FAILED",
  "USER_ANONYMIZED",
];

function actionClass(action: string) {
  if (action === "LOGIN_FAILED") return "text-red-600";
  if (action.startsWith("PLATFORM_ORG_DEACT") || action === "USER_ANONYMIZED") return "text-red-700 font-semibold";
  if (action.startsWith("PLATFORM_")) return "text-brand-green font-medium";
  return "text-gray-800";
}

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const filterAction = sp.action && FILTER_ACTIONS.includes(sp.action) ? sp.action : undefined;
  const system = sp.system;
  const page = parsePage(sp.page);
  const pageSize = 50;
  const skip = (page - 1) * pageSize;
  const q = normalizeSearch(sp.q);

  // KEIN Org-Filter (Betreiber-Sicht). Optional: nur System-Einträge (kein Akteur).
  const and: Prisma.AuditLogWhereInput[] = [];
  if (filterAction) and.push({ action: filterAction });
  if (system === "1") and.push({ actorId: null });
  if (q) {
    and.push({
      OR: [
        { actor: { name: { contains: q, mode: "insensitive" } } },
        { actor: { organization: { name: { contains: q, mode: "insensitive" } } } },
        { targetId: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const where: Prisma.AuditLogWhereInput = and.length > 0 ? { AND: and } : {};
  const hasFilter = Boolean(filterAction || system === "1" || q);

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        actor: { select: { name: true, organization: { select: { name: true, slug: true } } } },
      },
    }),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  const auditFilters: FilterConfig[] = [
    {
      key: "action",
      label: "Aktion",
      allLabel: "Alle Aktionen",
      primary: true,
      options: FILTER_ACTIONS.map((a) => ({ value: a, label: ACTION_LABELS[a] ?? a })),
    },
    {
      key: "system",
      label: "Herkunft",
      allLabel: "Alle",
      options: [{ value: "1", label: "Nur System (ohne Akteur)" }],
    },
  ];

  return (
    <>
      <PageTitle>Audit-Log (plattformweit)</PageTitle>

      <FilterBar
        searchPlaceholder="Suchen"
        searchHint="Nach Akteur, Verwaltung oder Zielobjekt-ID suchen"
        filters={auditFilters}
      />
      <p className="mb-3 mt-2 px-1 text-xs text-gray-400">
        {total} {total === 1 ? "Eintrag" : "Einträge"}
        {hasFilter ? " (gefiltert)" : ""}
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3">Zeitpunkt</th>
              <th className="px-4 py-3">Aktion</th>
              <th className="px-4 py-3">Akteur</th>
              <th className="px-4 py-3">Verwaltung</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Keine Einträge gefunden.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                    {log.createdAt.toLocaleString("de-DE", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </td>
                  <td className={`px-4 py-3 text-xs ${actionClass(log.action)}`}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {log.actor?.name ?? <span className="italic text-gray-400">System</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {log.actor?.organization?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {log.meta ? (
                      <span className="font-mono">
                        {Object.entries(log.meta as Record<string, unknown>)
                          .filter(([, v]) => v != null)
                          .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
                          .join(", ")}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{log.ip ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        total={total}
        hrefFor={pageHrefFor("/plattform/audit", sp)}
      />
    </>
  );
}
