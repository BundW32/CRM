import { Card, PageTitle } from "@/components/ui";
import { propertyWhereForVerwalter, ticketTargetsForUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { NeuerVorgangForm } from "./NeuerVorgangForm";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte füllen Sie alle Pflichtfelder aus (mind. 3 Zeichen).",
  ziel: "Das gewählte Objekt ist Ihnen nicht zugeordnet.",
  dateien:
    "Bitte nur Bilder (JPG, PNG, WebP, HEIC) oder Videos (MP4, MOV, WebM) bis 100 MB hochladen, maximal 10 Stück.",
};

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const user = await requireUser();
  const { fehler } = await searchParams;
  const isVerwalter = user.role === "VERWALTER";

  // Verwalter: nur die Objektliste laden (Einheiten on demand im Formular).
  // Andere Rollen: ihre – kleine – Zielliste komplett.
  const verwalterProperties = isVerwalter
    ? await db.property.findMany({
        where: await propertyWhereForVerwalter(user),
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  const targets = isVerwalter ? [] : await ticketTargetsForUser(user);

  const hasTargets = isVerwalter ? verwalterProperties.length > 0 : targets.length > 0;

  return (
    <>
      <PageTitle>
        {user.role === "MIETER" ? "Schaden melden / Anfrage stellen" : "Neuer Vorgang"}
      </PageTitle>

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessages[fehler] ?? "Die Eingabe konnte nicht verarbeitet werden."}
        </p>
      ) : null}

      {!hasTargets ? (
        <Card>
          <p className="text-sm text-gray-600">
            Ihnen ist noch kein Objekt zugeordnet. Bitte wenden Sie sich an die
            Verwaltung: info@bundwimmobilien.de
          </p>
        </Card>
      ) : (
        <Card>
          {isVerwalter ? (
            <NeuerVorgangForm verwalterProperties={verwalterProperties} />
          ) : (
            <NeuerVorgangForm targets={targets} />
          )}
        </Card>
      )}
    </>
  );
}
