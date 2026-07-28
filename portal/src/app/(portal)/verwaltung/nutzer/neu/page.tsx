// Nutzer anlegen – eigene Seite statt fester Spalte neben der Liste
// (siehe „Anlegen gehört nicht neben die Liste" in AGENTS.md).

import { Alert, Card, PageTitle } from "@/components/ui";
import { isSelfManaged, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { NewUserForm } from "../new-user-form";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte Name und Rolle angeben.",
  email: "Diese E-Mail-Adresse wird bereits verwendet.",
  email_fehlt: "Für die E-Mail-Einladung wird eine Adresse benötigt.",
};

export default async function NutzerAnlegenSeite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const verwalter = await requireVerwalter();
  const selfManaged = isSelfManaged(await getOrganization());
  const { fehler } = await searchParams;

  const properties = await db.property.findMany({
    where: await propertyWhereForVerwalter(verwalter),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageTitle back={{ href: "/verwaltung/nutzer", label: "Zugänge" }}>
        Neuen Nutzer anlegen
      </PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {errorMessages[fehler] ?? "Aktion fehlgeschlagen."}
        </Alert>
      ) : null}

      <div className="max-w-2xl">
        <Card>
          <NewUserForm
            zurueck="/verwaltung/nutzer/neu"
            properties={properties}
            isSuperAdmin={verwalter.isSuperAdmin}
            selfManaged={selfManaged}
          />
        </Card>
      </div>
    </>
  );
}
