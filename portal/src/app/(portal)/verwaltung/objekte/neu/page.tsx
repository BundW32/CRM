import Link from "next/link";
import { PageTitle, buttonSecondaryClass } from "@/components/ui";
import { isSelfManaged } from "@/lib/access";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { ObjektForm } from "./ObjektForm";

export const dynamic = "force-dynamic";

export default async function NeuesObjektPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  await requireVerwalter();
  const { fehler } = await searchParams;
  const selfManaged = isSelfManaged(await getOrganization());

  return (
    <>
      <PageTitle
        action={
          <Link href="/verwaltung" className={buttonSecondaryClass}>
            ← Verwaltung
          </Link>
        }
      >
        Objekt anlegen
      </PageTitle>
      <p className="mb-6 max-w-3xl text-sm text-gray-300">
        {selfManaged
          ? "Legen Sie Ihr WEG-Objekt mit Einheiten an und tragen Sie anschließend die Eigentümer mit ihren Miteigentumsanteilen ein."
          : "Legen Sie ein Objekt mit allen Stammdaten, Einheiten, dem Eigentümer und den Mietern an. Alle Zugänge werden erstellt — mit E-Mail-Einladung oder als druckbares Zugangsschreiben."}
      </p>

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Bitte füllen Sie mindestens die Pflichtfelder zum Objekt aus.
        </p>
      ) : null}

      <ObjektForm defaultManagementType={selfManaged ? "WEG" : "MIETVERWALTUNG"} />
    </>
  );
}
