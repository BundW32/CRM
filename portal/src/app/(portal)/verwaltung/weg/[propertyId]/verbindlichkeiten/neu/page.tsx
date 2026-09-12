import { toDateInputValue } from "@/components/fields";
import { Tipp } from "@/components/tipp";
import { Alert, Card, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { isBelegErkennungEnabled } from "@/lib/weg/beleg-erkennung";
import { requireWegProperty } from "@/lib/weg/scope";
import { VerbindlichkeitForm } from "./VerbindlichkeitForm";

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
        <VerbindlichkeitForm
          propertyId={property.id}
          // Die Belegerkennung nur beim Erfassen: Beim Bearbeiten stehen die
          // Werte schon da, und ein Vorschlag würde sie überschreiben.
          belegErkennung={!vorhanden && isBelegErkennungEnabled()}
          start={{
            id: vorhanden?.id,
            title: vorhanden?.title ?? "",
            kind: vorhanden?.kind ?? "RECHNUNG",
            creditor: vorhanden?.creditor ?? "",
            amount: vorhanden ? (vorhanden.amountCents / 100).toFixed(2).replace(".", ",") : "",
            incurredOn: toDateInputValue(vorhanden?.incurredOn ?? heute) ?? "",
            dueDate: toDateInputValue(vorhanden?.dueDate) ?? "",
            note: vorhanden?.note ?? "",
          }}
        />

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
