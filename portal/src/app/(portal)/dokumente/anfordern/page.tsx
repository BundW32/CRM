// Dokument anfordern – eigene Seite statt fester Spalte neben der Liste.
//
// Nur für Mieter und Eigentümer: Die Verwaltung fordert nichts bei sich selbst an.

import { redirect } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { Alert, Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { stackTight } from "@/components/data-display";
import { SelectField } from "@/components/fields";
import { requestableDocuments } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { requestDocument } from "../actions";

export const dynamic = "force-dynamic";

export default async function DokumentAnfordernPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (user.role === "VERWALTER") redirect("/dokumente");
  const { fehler } = await searchParams;

  return (
    <>
      <PageTitle back={{ href: "/dokumente", label: "Dokumente" }}>Dokument anfordern</PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          Bitte ein Dokument wählen oder kurz beschreiben.
        </Alert>
      ) : null}

      <div className="max-w-2xl">
        <Card>
          <form action={requestDocument} className={stackTight}>
            <p className="text-sm text-gray-600">
              Benötigen Sie ein Dokument (z. B. eine Wohnungsgeberbescheinigung)? Wählen Sie es
              aus — die Verwaltung kümmert sich darum und meldet sich über das Portal.
            </p>
            <SelectField
              label="Dokument"
              name="art"
              defaultValue={requestableDocuments[0]}
              options={requestableDocuments.map((r) => ({ value: r, label: r }))}
            />
            <Field label="Anmerkung (optional)">
              <textarea
                name="description"
                maxLength={2000}
                rows={4}
                placeholder="z. B. wofür Sie das Dokument benötigen oder bis wann"
                className={inputClass}
              />
            </Field>
            <PendingButton className={buttonClass}>Anfordern</PendingButton>
          </form>
        </Card>
      </div>
    </>
  );
}
