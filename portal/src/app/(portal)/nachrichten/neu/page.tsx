// Neue Nachricht – eigene Seite statt fester Spalte neben der Liste
// (siehe „Anlegen gehört nicht neben die Liste" in AGENTS.md).

import { SubmitButton } from "@/components/submit-button";
import { Alert, Card, Field, PageTitle, inputClass } from "@/components/ui";
import { stackTight } from "@/components/data-display";
import { requireUser } from "@/lib/session";
import { startConversation } from "../actions";
import { EmpfaengerSelect } from "../EmpfaengerSelect";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte Betreff und Nachricht ausfüllen.",
  empfaenger: "Bitte einen gültigen Empfänger wählen.",
};

export default async function NeueNachrichtPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { fehler } = await searchParams;
  const isVerwalter = user.role === "VERWALTER";

  return (
    <>
      <PageTitle back={{ href: "/nachrichten", label: "Nachrichten" }}>
        {isVerwalter ? "Neue Nachricht" : "Nachricht an die Verwaltung"}
      </PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {errorMessages[fehler] ?? "Bitte Eingaben prüfen."}
        </Alert>
      ) : null}

      <div className="max-w-2xl">
        <Card>
          <form action={startConversation} className={stackTight}>
            {isVerwalter ? (
              <Field label="Empfänger">
                <EmpfaengerSelect />
              </Field>
            ) : null}
            <Field label="Betreff">
              <input
                type="text"
                name="subject"
                required
                minLength={2}
                maxLength={200}
                className={inputClass}
              />
            </Field>
            <Field label="Nachricht">
              <textarea
                name="body"
                required
                minLength={1}
                maxLength={5000}
                rows={8}
                className={inputClass}
              />
            </Field>
            <SubmitButton pendingLabel="Wird gesendet…">Senden</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
