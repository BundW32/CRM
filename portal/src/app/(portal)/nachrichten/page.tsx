import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { Card, EmptyState, Field, PageTitle, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { startConversation } from "./actions";
import { EmpfaengerSelect } from "./EmpfaengerSelect";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const errorMessages: Record<string, string> = {
  eingabe: "Bitte Betreff und Nachricht ausfüllen.",
  empfaenger: "Bitte einen gültigen Empfänger wählen.",
};

export default async function NachrichtenPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; page?: string; gesendet?: string }>;
}) {
  const user = await requireUser();
  const { fehler, page, gesendet } = await searchParams;
  const isVerwalter = user.role === "VERWALTER";

  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const convWhere = { participants: { some: { userId: user.id } } };

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

  function pageHref(p: number) {
    return p > 1 ? `/nachrichten?page=${p}` : "/nachrichten";
  }

  return (
    <>
      <PageTitle>Nachrichten</PageTitle>

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessages[fehler] ?? "Aktion fehlgeschlagen."}
        </p>
      ) : null}
      {gesendet ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Nachricht an {gesendet} Empfänger gesendet (je ein eigener Verlauf).
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {conversations.length === 0 ? (
            <EmptyState>Noch keine Nachrichten.</EmptyState>
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
                          {formatDate(c.updatedAt)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              {currentPage > 1 ? (
                <Link
                  href={pageHref(currentPage - 1)}
                  className="rounded-lg border border-white/20 bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white"
                >
                  ← Zurück
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-300">
                Seite {currentPage} von {totalPages} · {total} Konversationen
              </span>
              {currentPage < totalPages ? (
                <Link
                  href={pageHref(currentPage + 1)}
                  className="rounded-lg border border-white/20 bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white"
                >
                  Weiter →
                </Link>
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </div>

        <Card title={isVerwalter ? "Neue Nachricht" : "Nachricht an die Verwaltung"}>
          <form action={startConversation} className="space-y-3">
            {isVerwalter ? (
              <Field label="Empfänger">
                <EmpfaengerSelect />
              </Field>
            ) : null}
            <Field label="Betreff">
              <input type="text" name="subject" required minLength={2} maxLength={200} className={inputClass} />
            </Field>
            <Field label="Nachricht">
              <textarea name="body" required minLength={1} maxLength={5000} rows={5} className={inputClass} />
            </Field>
            <SubmitButton pendingLabel="Wird gesendet…">Senden</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
