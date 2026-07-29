import { DateField, SelectField, toDateInputValue } from "@/components/fields";
import { SubmitButton } from "@/components/submit-button";
import { Tipp } from "@/components/tipp";
import { Alert, Card, Field, PageTitle, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { requireWegProperty } from "@/lib/weg/scope";
import { saveVerbindlichkeit } from "../actions";

export const dynamic = "force-dynamic";

const FEHLER: Record<string, string> = {
  betrag: "Der Betrag konnte nicht gelesen werden. Format: 1.250,00 — und größer als null.",
  datum: "Das Datum „Entstanden am“ konnte nicht gelesen werden.",
};

export default async function VerbindlichkeitFormularPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ id?: string; fehler?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  // Bearbeiten: nur Einträge dieses Objekts (IDOR-Schutz — die ID steht in der URL).
  const vorhanden = sp.id
    ? await db.verbindlichkeit.findFirst({
        where: { id: sp.id, propertyId: property.id },
      })
    : null;

  const heute = new Date();

  return (
    <>
      <PageTitle
        back={{
          href: `/verwaltung/weg/${property.id}/verbindlichkeiten`,
          label: "Zurück zu den Verbindlichkeiten",
        }}
      >
        {vorhanden ? "Verbindlichkeit bearbeiten" : "Verbindlichkeit erfassen"}
      </PageTitle>

      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {FEHLER[sp.fehler] ?? "Die Eingabe konnte nicht verarbeitet werden."}
        </Alert>
      ) : null}

      <Card title={property.name}>
        <form action={saveVerbindlichkeit} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="propertyId" value={property.id} />
          {vorhanden ? <input type="hidden" name="id" value={vorhanden.id} /> : null}

          <div className="sm:col-span-2">
            <Field label="Bezeichnung">
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={vorhanden?.title ?? ""}
                placeholder="z. B. Rechnung 2026-114, Dachreparatur"
                className={inputClass}
              />
            </Field>
          </div>

          <SelectField
            label="Art"
            name="kind"
            defaultValue={vorhanden?.kind ?? "RECHNUNG"}
            options={[
              { value: "RECHNUNG", label: "Offene Rechnung" },
              { value: "DARLEHEN", label: "Darlehen" },
              { value: "SONSTIGE", label: "Sonstige Verbindlichkeit" },
            ]}
          />

          <Field label="Gläubiger">
            <input
              name="creditor"
              maxLength={160}
              defaultValue={vorhanden?.creditor ?? ""}
              placeholder="Wem die Gemeinschaft das schuldet"
              className={inputClass}
            />
          </Field>

          <Field label="Offener Betrag (€)">
            <input
              name="amount"
              required
              inputMode="decimal"
              defaultValue={
                vorhanden ? (vorhanden.amountCents / 100).toFixed(2).replace(".", ",") : ""
              }
              placeholder="1.250,00"
              className={inputClass}
            />
          </Field>

          <DateField
            label="Entstanden am"
            name="incurredOn"
            required
            defaultValue={toDateInputValue(vorhanden?.incurredOn ?? heute)}
          />

          <DateField
            label="Fällig am"
            name="dueDate"
            defaultValue={toDateInputValue(vorhanden?.dueDate)}
          />

          <div className="sm:col-span-2">
            <Field label="Notiz">
              <input
                name="note"
                maxLength={1000}
                defaultValue={vorhanden?.note ?? ""}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Wird gespeichert…">
              {vorhanden ? "Änderungen speichern" : "Verbindlichkeit erfassen"}
            </SubmitButton>
          </div>
        </form>

        <Tipp className="mt-5">
          <strong>„Entstanden am“</strong> ist das entscheidende Datum, nicht das der Zahlung:
          Der Vermögensbericht blickt auf einen Stichtag — meist den 31.12. Eine Rechnung vom
          3. November gehört in den Bericht dieses Jahres, auch wenn sie erst im Februar
          bezahlt wird. Nehmen Sie das Rechnungsdatum. <strong>„Fällig am“</strong> ist
          freiwillig und dient nur der Übersicht: Überfällige Posten erscheinen in der Liste
          rot.
        </Tipp>
      </Card>
    </>
  );
}
