import { PageTitle } from "@/components/ui";
import { isSelfManaged } from "@/lib/access";
import { getOrganization } from "@/lib/session";
import { requireWegProperty } from "@/lib/weg/scope";
import { WegArbeitsbereich } from "../Arbeitsbereich";

export const dynamic = "force-dynamic";

// Finanz-Arbeitsbereich eines einzelnen Objekts. Inhalt und Aufbau teilt sich
// die Seite mit der Objektauswahl (`weg/page.tsx`), die bei genau einem Objekt
// denselben Baustein direkt rendert.
export default async function WegObjektPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const selfManaged = isSelfManaged(await getOrganization());

  return (
    <>
      <PageTitle back={{ href: "/verwaltung/weg", label: "WEG-Finanzen" }}>
        Finanzen · {property.name}
      </PageTitle>
      <WegArbeitsbereich property={property} selfManaged={selfManaged} />
    </>
  );
}
