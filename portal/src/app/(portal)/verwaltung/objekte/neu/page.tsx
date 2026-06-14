import { PageTitle } from "@/components/ui";
import { requireVerwalter } from "@/lib/session";
import { ObjektForm } from "./ObjektForm";

export const dynamic = "force-dynamic";

export default async function NeuesObjektPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  await requireVerwalter();
  const { fehler } = await searchParams;

  return (
    <>
      <PageTitle>Objekt anlegen</PageTitle>
      <p className="mb-6 max-w-3xl text-sm text-gray-300">
        Legen Sie ein Objekt mit allen Stammdaten, Einheiten, dem Eigentümer und den
        Mietern an. Alle Zugänge werden erstellt — mit E-Mail-Einladung oder als
        druckbares Zugangsschreiben.
      </p>

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Bitte füllen Sie mindestens die Pflichtfelder zum Objekt aus.
        </p>
      ) : null}

      <ObjektForm />
    </>
  );
}
