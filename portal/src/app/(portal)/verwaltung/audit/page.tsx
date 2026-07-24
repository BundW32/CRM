import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Login",
  LOGIN_FAILED: "Login fehlgeschlagen",
  PASSWORD_RESET_REQUEST: "Passwort-Reset angefordert",
  USER_ANONYMIZED: "Nutzer anonymisiert (DSGVO)",
  TICKET_CLOSED: "Vorgang geschlossen",
  TICKET_REOPENED: "Vorgang wieder geöffnet",
  TICKET_EXTERNAL_RELEASED: "Externe Beauftragung freigegeben",
  DSGVO_EXPORT: "DSGVO-Datenexport",
};

function actionClass(action: string) {
  if (action === "LOGIN_FAILED") return "text-red-600";
  if (action === "USER_ANONYMIZED") return "text-red-700 font-semibold";
  if (action === "TICKET_EXTERNAL_RELEASED") return "text-amber-700";
  return "text-gray-800";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; seite?: string }>;
}) {
  const verwalter = await requireVerwalter();
  if (!verwalter.isSuperAdmin) redirect("/verwaltung");

  const { action: filterAction, seite } = await searchParams;
  const page = Math.max(1, parseInt(seite ?? "1", 10));
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  // Org-Wand: ein SuperAdmin sieht nur Audit-Einträge von Akteuren der eigenen Org.
  // (AuditLog trägt keine eigene organizationId – Filter läuft über die Actor-Relation;
  // systemweite Einträge ohne Akteur sind einem künftigen Plattform-Admin vorbehalten.)
  const where = {
    actor: { organizationId: verwalter.organizationId },
    ...(filterAction ? { action: filterAction } : {}),
  };

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const actions = Object.keys(ACTION_LABELS);

  return (
    <>
      <PageTitle
        back={{ href: "/verwaltung", label: "Verwaltung" }}
      >
        Audit-Log
      </PageTitle>

      {/* Filter */}
      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <a
          href="/verwaltung/audit"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            !filterAction
              ? "border-brand-orange bg-brand-orange text-white"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          }`}
        >
          Alle
        </a>
        {actions.map((a) => (
          <a
            key={a}
            href={`/verwaltung/audit?action=${a}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filterAction === a
                ? "border-brand-orange bg-brand-orange text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            {ACTION_LABELS[a] ?? a}
          </a>
        ))}
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3">Zeitpunkt</th>
              <th className="px-4 py-3">Aktion</th>
              <th className="px-4 py-3">Akteur</th>
              <th className="px-4 py-3">Zielobjekt</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  Keine Einträge gefunden.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                    {log.createdAt.toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${actionClass(log.action)}`}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {log.actor?.name ?? <span className="italic text-gray-400">System</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {log.targetType && log.targetId ? (
                      <span>
                        {log.targetType} <span className="font-mono text-gray-400">{log.targetId.slice(0, 8)}…</span>
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
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
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {log.ip ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>
            {skip + 1}–{Math.min(skip + pageSize, total)} von {total} Einträgen
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/verwaltung/audit?${filterAction ? `action=${filterAction}&` : ""}seite=${page - 1}`}
                className="rounded border border-gray-200 px-3 py-1 hover:bg-gray-50"
              >
                ← zurück
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/verwaltung/audit?${filterAction ? `action=${filterAction}&` : ""}seite=${page + 1}`}
                className="rounded border border-gray-200 px-3 py-1 hover:bg-gray-50"
              >
                weiter →
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
