import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Card, Field, PageTitle, buttonSecondaryClass, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { managementTypeLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { updateObjekt } from "./actions";

export const dynamic = "force-dynamic";

export default async function ObjektBearbeitenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { id } = await params;
  const { fehler } = await searchParams;

  if (!(await canVerwalterAccessProperty(verwalter, id))) redirect("/verwaltung/objekte");
  const p = await db.property.findFirst({
    where: { id, organizationId: verwalter.organizationId },
  });
  if (!p) redirect("/verwaltung/objekte");

  return (
    <>
      <PageTitle
        action={
          <Link href="/verwaltung/objekte" className={buttonSecondaryClass}>
            ← Objekte
          </Link>
        }
      >
        Objekt bearbeiten
      </PageTitle>
      <p className="mb-6 max-w-3xl text-sm text-gray-300">
        Stammdaten des Objekts anpassen. Einheiten, Eigentümer und Mieter werden an
        ihren eigenen Stellen gepflegt; die Verwaltungsart bleibt unverändert.
      </p>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          Bitte füllen Sie mindestens die Pflichtfelder (Bezeichnung und Adresse) aus.
        </Alert>
      ) : null}

      <form action={updateObjekt} className="space-y-6">
        <input type="hidden" name="id" value={p.id} />

        <Card title="Objektdaten">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bezeichnung *">
              <input
                type="text"
                name="name"
                required
                minLength={2}
                defaultValue={p.name}
                className={inputClass}
              />
            </Field>
            <Field label="Verwaltungsart">
              <input
                type="text"
                value={managementTypeLabels[p.managementType]}
                disabled
                className={`${inputClass} cursor-not-allowed bg-gray-100 text-gray-500`}
              />
            </Field>
            <Field label="Straße und Hausnummer *">
              <input type="text" name="street" required minLength={2} defaultValue={p.street} className={inputClass} />
            </Field>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <Field label="PLZ *">
                <input type="text" name="zip" required minLength={4} defaultValue={p.zip} className={inputClass} />
              </Field>
              <Field label="Ort *">
                <input type="text" name="city" required minLength={2} defaultValue={p.city} className={inputClass} />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Weitere Stammdaten (optional)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Baujahr">
              <input
                type="number"
                name="buildYear"
                min={1800}
                max={2100}
                defaultValue={p.buildYear ?? ""}
                className={inputClass}
                placeholder="z. B. 1998"
              />
            </Field>
            <Field label="Gesamtwohnfläche (m²)">
              <input
                type="text"
                inputMode="decimal"
                name="livingArea"
                defaultValue={p.livingArea ?? ""}
                className={inputClass}
                placeholder="z. B. 540"
              />
            </Field>
            <Field label="Anzahl Etagen">
              <input type="number" name="floors" min={0} defaultValue={p.floors ?? ""} className={inputClass} placeholder="z. B. 4" />
            </Field>
            <Field label="Bauart">
              <input type="text" name="buildingType" defaultValue={p.buildingType ?? ""} className={inputClass} placeholder="z. B. Mehrfamilienhaus" />
            </Field>
            <Field label="Heizungsart">
              <input type="text" name="heatingType" defaultValue={p.heatingType ?? ""} className={inputClass} placeholder="z. B. Gas-Zentralheizung" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notizen">
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={p.notes ?? ""}
                  className={inputClass}
                  placeholder="Freie Notizen zum Objekt …"
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Titelbild (optional)">
          {p.titleImageStoredName ? (
            <div className="mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/files/property-image/${p.id}`}
                alt="Aktuelles Titelbild"
                className="h-40 w-full max-w-md rounded-lg object-cover"
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" name="removeTitleImage" value="1" className="h-4 w-4" />
                Aktuelles Titelbild entfernen
              </label>
            </div>
          ) : null}
          <Field label={p.titleImageStoredName ? "Titelbild ersetzen" : "Titelbild hochladen"}>
            <input
              type="file"
              name="titleImage"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-orange-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-orange-dark hover:file:bg-orange-100"
            />
          </Field>
        </Card>

        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel="Wird gespeichert…">Änderungen speichern</SubmitButton>
          <Link href="/verwaltung/objekte" className={buttonSecondaryClass}>
            Abbrechen
          </Link>
        </div>
      </form>
    </>
  );
}
