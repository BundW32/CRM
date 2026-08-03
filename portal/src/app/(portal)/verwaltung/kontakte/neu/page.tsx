// Kontakt anlegen – eigene Seite statt fester Spalte neben dem Adressbuch
// (siehe „Anlegen gehört nicht neben die Liste" in AGENTS.md).

import { Alert, PageTitle } from "@/components/ui";
import { isSelfManaged, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { KontaktAnlegen } from "../KontaktAnlegen";

export const dynamic = "force-dynamic";

export default async function KontaktAnlegenSeite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const verwalter = await requireVerwalter();
  const selfManaged = isSelfManaged(await getOrganization());
  const { fehler } = await searchParams;

  // Objektliste für die Zuordnung einer Person mit Zugang (Mieter/Eigentümer).
  const properties = (
    await db.property.findMany({
      where: await propertyWhereForVerwalter(verwalter),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  ).map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <PageTitle back={{ href: "/verwaltung/kontakte", label: "Kontakte" }}>
        Kontakt anlegen
      </PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "email"
            ? "Diese E-Mail-Adresse wird bereits von einer anderen Person verwendet."
            : "Bitte Pflichtfelder (Name, Art) korrekt ausfüllen."}
        </Alert>
      ) : null}

      <div className="max-w-2xl">
        <KontaktAnlegen
          properties={properties}
          isSuperAdmin={verwalter.isSuperAdmin}
          selfManaged={selfManaged}
        />
      </div>
    </>
  );
}
