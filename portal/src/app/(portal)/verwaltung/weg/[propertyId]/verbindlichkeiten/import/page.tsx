import { Tipp } from "@/components/tipp";
import { Card, PageTitle } from "@/components/ui";
import { requireWegProperty } from "@/lib/weg/scope";
import { RechnungenImportClient } from "./RechnungenImportClient";

export const dynamic = "force-dynamic";

export default async function RechnungenImportPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);

  return (
    <>
      <PageTitle
        back={{
          href: `/verwaltung/weg/${property.id}/verbindlichkeiten`,
          label: "Zurück zu den Verbindlichkeiten",
        }}
      >
        Rechnungen aus CSV importieren
      </PageTitle>

      <Card title={property.name}>
        <p className="mb-4 text-sm text-gray-600">
          Eine Tabelle mit Kopfzeile, eine Rechnung je Zeile. Erkannt werden{" "}
          <strong>Bezeichnung</strong>, <strong>Gläubiger</strong>, <strong>Betrag</strong>,{" "}
          <strong>Rechnungsdatum</strong>, <strong>Fällig am</strong>, <strong>Rechnungsnummer</strong>{" "}
          und <strong>Notiz</strong> — in beliebiger Reihenfolge, Semikolon oder Komma. Pflicht sind
          Betrag, Rechnungsdatum und eine Bezeichnung. Vor dem Anlegen sehen Sie eine Vorschau.
        </p>
        <RechnungenImportClient propertyId={property.id} />
        <Tipp className="mt-5">
          Jede Zeile wird als <strong>offene Rechnung</strong> angelegt — als Schuld der
          Gemeinschaft, nicht als Buchung. Bezahlt wird sie später über den Bankimport, und Sie
          markieren sie hier als „beglichen“. Zeilen, die es schon gibt (gleiche Bezeichnung,
          gleicher Betrag, gleiches Datum), werden übersprungen: Dieselbe Datei zweimal hochzuladen
          erzeugt keine Dubletten.
        </Tipp>
      </Card>
    </>
  );
}
