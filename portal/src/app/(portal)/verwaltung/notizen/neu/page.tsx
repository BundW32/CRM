// Notiz anlegen – eigene Seite statt fester Spalte neben der Liste
// (siehe „Anlegen gehört nicht neben die Liste" in AGENTS.md).

import { Card, PageTitle } from "@/components/ui";
import { propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { NoteForm } from "../note-form";

export const dynamic = "force-dynamic";

export default async function NotizAnlegenSeite() {
  const verwalter = await requireVerwalter();
  const properties = await db.property.findMany({
    where: await propertyWhereForVerwalter(verwalter),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageTitle back={{ href: "/verwaltung/notizen", label: "Notizen" }}>Neue Notiz</PageTitle>
      <div className="max-w-2xl">
        <Card>
          <NoteForm properties={properties} />
        </Card>
      </div>
    </>
  );
}
