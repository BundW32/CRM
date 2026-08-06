import { redirect } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { stackTight } from "@/components/data-display";
import { Alert, Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { hatPlanFunktion } from "@/lib/billing";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { anfrageErstellen } from "../actions";

export const dynamic = "force-dynamic";

export default async function NeueAnfragePage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  await requireVerwalter();
  const org = await getOrganization();
  // Ohne Verwalter-Plus gibt es kein Formular — die Liste erklärt den Weg zum
  // Tarif. Die eigentliche Sperre steht zusätzlich in der Action.
  if (!org || !hatPlanFunktion(org, "verwalterTicket")) {
    redirect("/verwaltung/verwalter-tickets");
  }
  const { fehler } = await searchParams;

  return (
    <>
      <PageTitle back={{ href: "/verwaltung/verwalter-tickets", label: "Verwalter-Tickets" }}>
        Neue Anfrage an den zertifizierten Verwalter
      </PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          Bitte geben Sie einen Betreff und Ihre Frage ein (mindestens ein paar Worte).
        </Alert>
      ) : null}

      <div className="max-w-2xl">
        <Card>
          <form action={anfrageErstellen} className={stackTight}>
            <Field label="Betreff">
              <input
                type="text"
                name="title"
                required
                minLength={3}
                maxLength={200}
                className={inputClass}
                placeholder="z. B. Rücklage: Zuführung im Wirtschaftsplan richtig ansetzen?"
              />
            </Field>
            <Field label="Ihre Frage">
              <textarea
                name="body"
                required
                minLength={10}
                rows={10}
                className={inputClass}
                placeholder={
                  "Beschreiben Sie die Situation Ihrer Gemeinschaft so konkret wie möglich — " +
                  "je mehr Zusammenhang, desto brauchbarer die Antwort."
                }
              />
            </Field>
            <p className="text-xs text-gray-500">
              Die Antwort eines zertifizierten Verwalters (§ 26a WEG) erscheint im Portal
              und bleibt für Ihre Gemeinschaft dokumentiert. Bitte keine Rechtsberatung im
              Einzelfall erwarten, wo sie Anwälten vorbehalten ist.
            </p>
            <PendingButton className={buttonClass}>Anfrage senden</PendingButton>
          </form>
        </Card>
      </div>
    </>
  );
}
