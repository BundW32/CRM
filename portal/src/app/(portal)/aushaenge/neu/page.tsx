// Neuer Aushang – eigene Seite statt fester Spalte neben der Liste
// (siehe „Anlegen gehört nicht neben die Liste" in AGENTS.md).

import { redirect } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { Alert, Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { stackTight } from "@/components/data-display";
import { ComboField } from "@/components/combo-field";
import { SelectField } from "@/components/fields";
import { propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { audienceLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { createAnnouncement } from "../actions";

export const dynamic = "force-dynamic";

export default async function NeuerAushangPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const verwalter = await requireVerwalter();
  const { fehler } = await searchParams;

  const properties = await db.property.findMany({
    where: await propertyWhereForVerwalter(verwalter),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (properties.length === 0) redirect("/aushaenge");

  return (
    <>
      <PageTitle back={{ href: "/aushaenge", label: "Aushänge" }}>Neuer Aushang</PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          Bitte alle Pflichtfelder korrekt ausfüllen.
        </Alert>
      ) : null}

      <div className="max-w-2xl">
        <Card>
          <form action={createAnnouncement} className={stackTight}>
            <ComboField
              label="Objekt"
              name="propertyId"
              required
              placeholder="Objekt suchen …"
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
            />
            <SelectField
              label="Sichtbar für"
              name="audience"
              required
              defaultValue="ALLE"
              options={Object.entries(audienceLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Field label="Titel">
              <input
                type="text"
                name="title"
                required
                minLength={3}
                maxLength={200}
                className={inputClass}
              />
            </Field>
            <Field label="Text">
              <textarea
                name="body"
                required
                minLength={3}
                maxLength={5000}
                rows={10}
                className={inputClass}
              />
            </Field>
            <PendingButton className={buttonClass}>Veröffentlichen</PendingButton>
          </form>
        </Card>
      </div>
    </>
  );
}
