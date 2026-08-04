// Dokument hochladen – eigene Seite statt fester Spalte neben der Liste
// (siehe „Anlegen gehört nicht neben die Liste" in AGENTS.md).
//
// Zwei Fassungen unter einer Route: Die Verwaltung lädt für ein Objekt oder eine
// Einheit hoch und kann Empfänger einschränken; ein Eigentümer lädt nur für seine
// eigenen Objekte hoch. Das bleibt eine Route, weil beide dasselbe tun – wer was
// darf, entscheidet ohnehin die Server-Action.

import { redirect } from "next/navigation";
import { FileInput } from "@/components/file-input";
import { Alert, Card, Field, PageTitle, inputClass } from "@/components/ui";
import { stackTight } from "@/components/data-display";
import { ComboField } from "@/components/combo-field";
import { SelectField } from "@/components/fields";
import { PropertyUnitFields } from "@/components/property-unit-fields";
import { RecipientPicker } from "@/components/recipient-picker";
import { SubmitButton } from "@/components/submit-button";
import { ownedProperties, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { audienceLabels, documentCategoryLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { searchDocumentRecipients, uploadDocument, uploadOwnerDocument } from "../actions";

export const dynamic = "force-dynamic";


const kategorien = Object.entries(documentCategoryLabels).map(([value, label]) => ({
  value,
  label,
}));

export default async function DokumentHochladenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { fehler } = await searchParams;
  const isVerwalter = user.role === "VERWALTER";

  const properties = isVerwalter
    ? await db.property.findMany({
        where: await propertyWhereForVerwalter(user),
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  const ownedProps = user.role === "EIGENTUEMER" ? await ownedProperties(user.id) : [];

  // Mieter laden nicht hoch – für sie gibt es „Dokument anfordern".
  if (!isVerwalter && ownedProps.length === 0) redirect("/dokumente");

  return (
    <>
      <PageTitle back={{ href: "/dokumente", label: "Dokumente" }}>Dokument hochladen</PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "datei"
            ? "Nur PDF oder Bilder bis 10 MB sind erlaubt."
            : "Bitte alle Pflichtfelder korrekt ausfüllen."}
        </Alert>
      ) : null}

      <div className="max-w-2xl">
        <Card>
          {isVerwalter ? (
            <form action={uploadDocument} className={stackTight}>
              <Field label="Titel">
                <input
                  type="text"
                  name="title"
                  required
                  minLength={2}
                  maxLength={200}
                  className={inputClass}
                />
              </Field>
              <SelectField label="Kategorie" name="category" required options={kategorien} />
              {/* Ohne Vorauswahl nahm der Browser die erste Option — „Mieter".
                  Wer das Feld übersah, legte ein Eigentümerdokument ab, das
                  kein Eigentümer sehen konnte, ohne dass irgendetwas darauf
                  hinwies. Bewusst KEINE Vorgabe „Alle" als Gegenmittel: Ein
                  Mietvertrag, der versehentlich an alle geht, wäre der
                  schlimmere Ausgang. Wer Sichtbarkeit festlegt, soll sie
                  wählen. */}
              <SelectField
                label="Sichtbar für"
                name="audience"
                required
                placeholder="— bitte wählen —"
                hint="Wer das Dokument im Portal sehen kann."
                options={Object.entries(audienceLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
              <PropertyUnitFields
                properties={properties.map((p) => ({ id: p.id, name: p.name }))}
                unitLabel="Einheit (optional, überschreibt Objekt)"
              />
              <Field label="Nur für bestimmte Empfänger (optional)">
                <RecipientPicker search={searchDocumentRecipients} />
                <p className="mt-1 text-xs text-gray-500">
                  Leer lassen = wie „Sichtbar für&ldquo; (alle im Objekt). Bei Auswahl sehen NUR
                  die gewählten Personen (und die Verwaltung) das Dokument.
                </p>
              </Field>
              <Field label="Datei (PDF oder Bild, max. 10 MB)">
                <FileInput
                  name="file"
                  required
                  accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                />
              </Field>
              <SubmitButton pendingLabel="Wird hochgeladen…">Hochladen</SubmitButton>
            </form>
          ) : (
            <form action={uploadOwnerDocument} className={stackTight}>
              <p className="text-sm text-gray-600">
                Für Ihre Verwaltung – optional auch für Ihre Mieter sichtbar. Andere Eigentümer
                sehen es nicht.
              </p>
              <Field label="Titel">
                <input
                  type="text"
                  name="title"
                  required
                  minLength={2}
                  maxLength={200}
                  className={inputClass}
                />
              </Field>
              <SelectField label="Kategorie" name="category" required options={kategorien} />
              <ComboField
                label="Objekt"
                name="propertyId"
                required
                placeholder="Objekt suchen …"
                options={ownedProps.map((p) => ({ value: p.id, label: p.name }))}
              />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" name="shareTenants" value="1" className="h-4 w-4" />
                Auch für meine Mieter sichtbar
              </label>
              <Field label="Datei (PDF oder Bild, max. 10 MB)">
                <FileInput
                  name="file"
                  required
                  accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                />
              </Field>
              <SubmitButton pendingLabel="Wird hochgeladen…">Hochladen</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
