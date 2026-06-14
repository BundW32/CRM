import Link from "next/link";
import { Card, EmptyState, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate, roleLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { startConversation } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte Betreff und Nachricht ausfüllen.",
  empfaenger: "Bitte einen gültigen Empfänger wählen.",
};

export default async function NachrichtenPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const user = await requireUser();
  const { fehler } = await searchParams;
  const isVerwalter = user.role === "VERWALTER";

  const conversations = await db.conversation.findMany({
    where: { participants: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: { include: { user: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const recipients = isVerwalter
    ? await db.user.findMany({
        where: { role: { in: ["MIETER", "EIGENTUEMER"] }, active: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      })
    : [];

  return (
    <>
      <PageTitle>Nachrichten</PageTitle>

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessages[fehler] ?? "Aktion fehlgeschlagen."}
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
        </div>

        <Card title={isVerwalter ? "Neue Nachricht" : "Nachricht an die Verwaltung"}>
          <form action={startConversation} className="space-y-3">
            {isVerwalter ? (
              <Field label="Empfänger">
                <select name="recipientId" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    – bitte wählen –
                  </option>
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({roleLabels[r.role]})
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Betreff">
              <input type="text" name="subject" required minLength={2} maxLength={200} className={inputClass} />
            </Field>
            <Field label="Nachricht">
              <textarea name="body" required minLength={1} maxLength={5000} rows={5} className={inputClass} />
            </Field>
            <button type="submit" className={buttonClass}>
              Senden
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
