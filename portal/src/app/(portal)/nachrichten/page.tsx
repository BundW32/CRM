import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Pagination, Alert, EmptyState, PageTitle, buttonClass } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { db } from "@/lib/db";
import { formatDateOnly } from "@/lib/labels";
import { normalizeSearch, parsePage, pageHrefFor } from "@/lib/list-query";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const errorMessages: Record<string, string> = {
  eingabe: "Bitte Betreff und Nachricht ausfüllen.",
  empfaenger: "Bitte einen gültigen Empfänger wählen.",
};

export default async function NachrichtenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const { fehler, gesendet } = sp;
  const isVerwalter = user.role === "VERWALTER";

  const currentPage = parsePage(sp.page);

  // Suche über Betreff, Nachrichtentext und Namen der Gesprächspartner.
  const q = normalizeSearch(sp.q);
  const convAnd: Prisma.ConversationWhereInput[] = [
    { participants: { some: { userId: user.id } } },
  ];
  if (q) {
    convAnd.push({
      OR: [
        { subject: { contains: q, mode: "insensitive" } },
        { messages: { some: { body: { contains: q, mode: "insensitive" } } } },
        {
          participants: {
            some: { userId: { not: user.id }, user: { name: { contains: q, mode: "insensitive" } } },
          },
        },
      ],
    });
  }
  const convWhere: Prisma.ConversationWhereInput = { AND: convAnd };

  const [total, conversations] = await Promise.all([
    db.conversation.count({ where: convWhere }),
    db.conversation.findMany({
      where: convWhere,
      orderBy: { updatedAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = pageHrefFor(`/nachrichten`, sp);

  return (
    <>
      <PageTitle
        action={
          <Link href="/nachrichten/neu" className={buttonClass}>
            {isVerwalter ? "Neue Nachricht" : "Nachricht an die Verwaltung"}
          </Link>
        }
      >
        Nachrichten
      </PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {errorMessages[fehler] ?? "Aktion fehlgeschlagen."}
        </Alert>
      ) : null}
      {gesendet ? (
        <Alert variant="success" className="mb-4">
          Nachricht an {gesendet} Empfänger gesendet (je ein eigener Verlauf).
        </Alert>
      ) : null}

      <div>
          <FilterBar
            className="mb-3"
            searchPlaceholder="Suchen"
            searchHint="Nach Betreff, Nachrichtentext oder Person suchen"
          />
          {conversations.length === 0 ? (
            <EmptyState>{q ? "Keine Nachrichten gefunden." : "Noch keine Nachrichten."}</EmptyState>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <ul className="divide-y divide-gray-100">
                {conversations.map((c) => {
                  const me = c.participants.find((p) => p.userId === user.id);
                  const others = c.participants
                    .filter((p) => p.userId !== user.id)
                    .map((p) => p.user.name)
                    .join(", ");
                  const last = c.messages[0];
                  const unread =
                    last &&
                    last.authorId !== user.id &&
                    (!me?.lastReadAt || last.createdAt > me.lastReadAt);
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/nachrichten/${c.id}`}
                        className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900">
                            {unread ? (
                              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-orange align-middle" />
                            ) : null}
                            {c.subject}
                          </span>
                          <span className="block truncate text-xs text-gray-500">
                            {others || "—"}
                            {last ? ` · ${last.body}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-gray-400">
                          {formatDateOnly(c.updatedAt)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} total={total} itemLabel="Konversationen" hrefFor={pageHref} />
      </div>
    </>
  );
}
