// Umlaufbeschluss starten – eigene Seite statt fester Spalte neben der Liste.
//
// Das Anlegen-Formular saß bisher als dritte Spalte rechts neben den Beschlüssen
// und belegte dauerhaft ein Drittel der Breite, obwohl man selten einen
// Umlaufbeschluss startet. Auf einer eigenen Seite hat die Liste die volle Breite,
// und das Formular seinerseits genug Platz für den Beschlusstext.

import { redirect } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { Alert, Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { stackTight } from "@/components/data-display";
import { ComboField } from "@/components/combo-field";
import { DateField } from "@/components/fields";
import { propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { UmlaufMehrheit } from "../UmlaufMehrheit";
import { createResolution } from "../actions";

export const dynamic = "force-dynamic";

export default async function NeuerUmlaufbeschlussPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const verwalter = await requireVerwalter();
  const { fehler } = await searchParams;

  // Umlaufbeschlüsse gibt es nur für WEG-Objekte – die Mietverwaltung kennt
  // keine Beschlussfassung.
  const properties = await db.property.findMany({
    where: { ...(await propertyWhereForVerwalter(verwalter)), managementType: "WEG" },
    orderBy: { name: "asc" },
  });
  if (properties.length === 0) {
    redirect("/beschluesse?fehler=keinweg");
  }

  return (
    <>
      <PageTitle back={{ href: "/beschluesse", label: "Beschlüsse" }}>
        Umlaufbeschluss starten
      </PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "frist"
            ? "Die Frist liegt in der Vergangenheit – dann könnte niemand mehr abstimmen."
            : fehler === "keinweg"
              ? "Umlaufbeschlüsse sind nur für WEG-Objekte möglich."
              : "Bitte Objekt, Titel und Beschlusstext ausfüllen."}
        </Alert>
      ) : null}

      <div className="max-w-2xl">
        <Card>
          <form action={createResolution} className={stackTight}>
            <ComboField
              label="Objekt (WEG)"
              name="propertyId"
              required
              placeholder="Objekt suchen …"
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
            />
            <Field label="Titel">
              <input type="text" name="title" required minLength={3} className={inputClass} />
            </Field>
            <Field label="Beschlusstext">
              <textarea
                name="description"
                required
                minLength={3}
                rows={8}
                className={inputClass}
              />
            </Field>
            <UmlaufMehrheit />
            <DateField label="Frist (optional)" name="deadline" />
            <PendingButton className={buttonClass}>Abstimmung starten</PendingButton>
            <p className="text-xs text-gray-500">
              Alle Eigentümer des Objekts werden per E-Mail zur Abstimmung eingeladen.
            </p>
          </form>
        </Card>
      </div>
    </>
  );
}
