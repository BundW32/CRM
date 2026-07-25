import { Alert, PageTitle } from "@/components/ui";
import { isSelfManaged } from "@/lib/access";
import { db } from "@/lib/db";
import { isObjektImportEnabled } from "@/lib/objekt-extraction";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { ObjektForm } from "./ObjektForm";

export const dynamic = "force-dynamic";

export default async function NeuesObjektPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { fehler } = await searchParams;
  const org = await getOrganization();
  const selfManaged = isSelfManaged(org);

  // Bestehende Objekte der Org – dient der Dubletten-Warnung im Formular.
  const existing = await db.property.findMany({
    where: { organizationId: verwalter.organizationId },
    select: { name: true, street: true, zip: true, city: true },
    orderBy: { name: "asc" },
  });

  // Selbstverwalter haben bei der Registrierung schon einen WEG-Namen vergeben –
  // beim ersten Objekt die Bezeichnung damit vorbelegen (spart Doppeleingabe).
  const defaultName = selfManaged && existing.length === 0 ? (org?.name ?? "") : "";

  return (
    <>
      <PageTitle
        back={{ href: "/verwaltung/objekte", label: "Objekte" }}
      >
        Objekt anlegen
      </PageTitle>
      <p className="mb-6 max-w-3xl text-sm text-gray-300">
        {selfManaged
          ? "Legen Sie Ihr WEG-Objekt mit Einheiten an und tragen Sie anschließend die Eigentümer mit ihren Miteigentumsanteilen ein."
          : "Legen Sie ein Objekt mit allen Stammdaten, Einheiten, dem Eigentümer und den Mietern an. Alle Zugänge werden erstellt — mit E-Mail-Einladung oder als druckbares Zugangsschreiben."}
      </p>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          Bitte füllen Sie mindestens die Pflichtfelder zum Objekt aus.
        </Alert>
      ) : null}

      <ObjektForm
        defaultManagementType={selfManaged ? "WEG" : "MIETVERWALTUNG"}
        lockWeg={selfManaged}
        aiImportEnabled={isObjektImportEnabled()}
        defaultName={defaultName}
        existing={existing}
      />
    </>
  );
}
