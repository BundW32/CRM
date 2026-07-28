// Versammlung anlegen – eigene Seite statt fester Spalte neben der Liste
// (siehe „Anlegen gehört nicht neben die Liste" in AGENTS.md).

import { redirect } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { Alert, Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { stackTight } from "@/components/data-display";
import { SelectField } from "@/components/fields";
import { propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { createMeeting } from "../actions";

export const dynamic = "force-dynamic";

export default async function VersammlungAnlegenSeite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const verwalter = await requireVerwalter();
  const { fehler } = await searchParams;

  // Versammlungen gibt es nur für WEG-Objekte.
  const properties = await db.property.findMany({
    where: { ...(await propertyWhereForVerwalter(verwalter)), managementType: "WEG" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (properties.length === 0) redirect("/versammlungen?fehler=keinweg");

  return (
    <>
      <PageTitle back={{ href: "/versammlungen", label: "Versammlungen" }}>
        Versammlung anlegen
      </PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "keinweg"
            ? "Versammlungen sind nur für WEG-Objekte möglich."
            : "Bitte Objekt, Titel, Termin und Ort ausfüllen."}
        </Alert>
      ) : null}

      <div className="max-w-2xl">
        <Card>
          <form action={createMeeting} className={stackTight}>
            <SelectField
              label="Objekt (WEG)"
              name="propertyId"
              required
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
            />
            <Field label="Titel">
              <input
                type="text"
                name="title"
                required
                minLength={3}
                placeholder="z. B. Ordentliche Eigentümerversammlung 2026"
                className={inputClass}
              />
            </Field>
            <Field label="Termin">
              <input type="datetime-local" name="scheduledAt" required className={inputClass} />
            </Field>
            <Field label="Ort">
              <input
                type="text"
                name="location"
                required
                placeholder="z. B. Gemeindesaal, Musterstr. 1 – oder Online / Videokonferenz"
                className={inputClass}
              />
            </Field>
            <Field label="Link zur Video-Zuschaltung (optional)">
              <input
                type="text"
                name="videoLink"
                placeholder="leer = Standard-Link des Objekts (falls hinterlegt)"
                className={inputClass}
              />
            </Field>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input type="checkbox" name="saveVideoDefault" className="mt-0.5" />
              <span>
                Eingegebenen Link als Standard für dieses Objekt speichern (wird bei künftigen
                Versammlungen vorbelegt).
              </span>
            </label>
            <PendingButton className={buttonClass}>Versammlung anlegen</PendingButton>
          </form>
        </Card>
      </div>
    </>
  );
}
