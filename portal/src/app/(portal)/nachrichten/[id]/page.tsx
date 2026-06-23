import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { sendMessage } from "../actions";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const conversation = await db.conversation.findFirst({
    where: { id, participants: { some: { userId: user.id } } },
    include: {
      participants: { include: { user: true } },
      messages: { include: { author: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) notFound();

  // Als gelesen markieren
  await db.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    data: { lastReadAt: new Date() },
  });

  const others = conversation.participants
    .filter((p) => p.userId !== user.id)
    .map((p) => p.user.name)
    .join(", ");

  return (
    <>
      <PageTitle>{conversation.subject}</PageTitle>
      <p className="mb-4 text-sm text-gray-300">Mit: {others || "—"}</p>

      <Card>
        <ul className="space-y-3">
          {conversation.messages.map((m) => {
            const mine = m.authorId === user.id;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    mine
                      ? "bg-brand-orange-light text-brand-green-dark"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {m.author.name} · {formatDate(m.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <form action={sendMessage} className="mt-5 space-y-3 border-t border-gray-100 pt-4">
          <input type="hidden" name="conversationId" value={conversation.id} />
          <Field label="Antworten">
            <textarea name="body" required minLength={1} maxLength={5000} rows={3} className={inputClass} />
          </Field>
          <SubmitButton>Senden</SubmitButton>
        </form>
      </Card>

      <Link
        href="/nachrichten"
        className="mt-4 block text-sm text-gray-300 hover:text-brand-orange hover:underline"
      >
        ← Zurück zu den Nachrichten
      </Link>
    </>
  );
}
