import type { Prisma } from "@/generated/prisma/client";
import { Badge } from "@/components/data-display";
import { PageTitle, Pagination } from "@/components/ui";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { db } from "@/lib/db";
import { optionsFrom } from "@/lib/list-filters";
import { normalizeSearch, parsePage, pageHrefFor } from "@/lib/list-query";
import { isMailEnabled } from "@/lib/mailer";
import { requireVerwalter } from "@/lib/session";

export const dynamic = "force-dynamic";

// Die Anlässe, die protokolliert werden (siehe MailContext.purpose). Bewusst
// nur die fristrelevanten: Wer wissen will, ob eine Einladung ankam, sucht nicht
// zwischen hunderten Statusmails danach.
const PURPOSE_LABELS: Record<string, string> = {
  "versammlung-einladung": "Einladung zur Versammlung",
  "versammlung-absage": "Absage der Versammlung",
  "beschluss-umlauf": "Umlaufbeschluss",
  "uebergabe-protokoll": "Übergabeprotokoll",
};

const OUTCOME_LABELS: Record<string, string> = {
  sent: "Versandt",
  failed: "Fehlgeschlagen",
  disabled: "Kein Versand eingerichtet",
};

function outcomeTone(outcome: string): "success" | "danger" | "warning" {
  if (outcome === "sent") return "success";
  if (outcome === "failed") return "danger";
  return "warning";
}

export default async function VersandprotokollPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // Kein SuperAdmin-Zwang wie beim Audit-Log: Dort geht es um
  // sicherheitsrelevante Aktionen, hier um den eigenen Arbeitsnachweis. Ein
  // Verwalter, der eine Versammlung einberufen hat, muss belegen können, dass
  // die Ladung rausging – auch ohne Admin-Rechte.
  const verwalter = await requireVerwalter();

  const sp = await searchParams;
  const filterPurpose = sp.anlass && sp.anlass in PURPOSE_LABELS ? sp.anlass : undefined;
  const filterOutcome = sp.ergebnis && sp.ergebnis in OUTCOME_LABELS ? sp.ergebnis : undefined;
  const page = parsePage(sp.page);
  const pageSize = 50;
  const q = normalizeSearch(sp.q);

  // Mandanten-Wand direkt in der Query.
  const and: Prisma.MailLogWhereInput[] = [{ organizationId: verwalter.organizationId }];
  if (filterPurpose) and.push({ purpose: filterPurpose });
  if (filterOutcome) and.push({ outcome: filterOutcome });
  if (q) {
    and.push({
      OR: [
        { recipient: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  const where: Prisma.MailLogWhereInput = { AND: and };
  const hasFilter = Boolean(filterPurpose || filterOutcome || q);

  const [total, offen, logs] = await Promise.all([
    db.mailLog.count({ where }),
    // Nicht zugestellt – die Zahl, die der Verwalter zuerst sehen muss.
    db.mailLog.count({
      where: {
        organizationId: verwalter.organizationId,
        outcome: { in: ["failed", "disabled"] },
      },
    }),
    db.mailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const filters: FilterConfig[] = [
    {
      key: "anlass",
      label: "Anlass",
      allLabel: "Alle Anlässe",
      primary: true,
      options: optionsFrom(PURPOSE_LABELS),
    },
    {
      key: "ergebnis",
      label: "Ergebnis",
      allLabel: "Alle Ergebnisse",
      options: optionsFrom(OUTCOME_LABELS),
    },
  ];

  return (
    <>
      <PageTitle back={{ href: "/verwaltung/einstellungen", label: "Einstellungen" }}>
        Versandprotokoll
      </PageTitle>

      <p className="mb-4 text-sm text-gray-500">
        Nachweis über den Versand fristgebundener E-Mails: Einladungen zur
        Eigentümerversammlung, Umlaufbeschlüsse und Übergabeprotokolle. Der Inhalt der
        Mails wird bewusst nicht gespeichert.
      </p>

      {!isMailEnabled() ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Der E-Mail-Versand ist derzeit nicht eingerichtet (SMTP fehlt). Neue Einträge
          erscheinen hier als &bdquo;Kein Versand eingerichtet&ldquo; &ndash; es geht nichts raus.
        </div>
      ) : offen > 0 ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {offen} {offen === 1 ? "Nachricht wurde" : "Nachrichten wurden"} nicht zugestellt.
          Diese Empfänger brauchen die Unterlagen auf einem anderen Weg.
        </div>
      ) : null}

      <FilterBar
        searchPlaceholder="Suchen"
        searchHint="Nach Empfänger, Name oder Betreff suchen"
        filters={filters}
      />
      <p className="mb-3 mt-2 px-1 text-xs text-gray-400">
        {total} {total === 1 ? "Eintrag" : "Einträge"}
        {hasFilter ? " (gefiltert)" : ""}
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3">Ergebnis</th>
              <th className="px-4 py-3">Zeitpunkt</th>
              <th className="px-4 py-3">Anlass</th>
              <th className="px-4 py-3">Empfänger</th>
              <th className="px-4 py-3">Betreff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  Keine Einträge gefunden.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Badge tone={outcomeTone(log.outcome)}>
                      {OUTCOME_LABELS[log.outcome] ?? log.outcome}
                    </Badge>
                    {log.error ? (
                      <div className="mt-1 text-xs text-gray-400">{log.error}</div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                    {log.createdAt.toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {PURPOSE_LABELS[log.purpose] ?? log.purpose}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {log.user?.name ? (
                      <>
                        {log.user.name}
                        <div className="text-gray-400">{log.recipient}</div>
                      </>
                    ) : (
                      log.recipient
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{log.subject}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / pageSize)}
        total={total}
        hrefFor={pageHrefFor("/verwaltung/versandprotokoll", sp)}
      />
    </>
  );
}
