import { redirect } from "next/navigation";
import { Alert, Card, Field, PageTitle, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Tipp } from "@/components/tipp";
import { isSelfManaged } from "@/lib/access";
import { SETTINGS_HREF } from "@/lib/app-nav";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { updateGemeinschaftsname } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Der Name der Gemeinschaft, für selbstverwaltete WEGs.
 *
 * Bis zum 03.08.2026 gab es dafür **keinen** Weg: Der Name wurde bei der
 * Registrierung gesetzt, und die einzige Seite, die ihn ändern kann
 * (`/verwaltung/branding`), weist selbstverwaltete Organisationen ab — zu
 * Recht, denn Logo, Akzentfarbe und Impressum einer Hausverwaltung haben für
 * sie keine Bedeutung. Nur stand der Name eben mitten darin. Ein Tippfehler bei
 * der Anmeldung blieb damit für immer in der Kopfzeile jeder Seite stehen.
 */
export default async function GemeinschaftPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const verwalter = await requireVerwalter();
  if (!verwalter.isSuperAdmin) redirect("/verwaltung");

  const org = await getOrganization();
  if (!org) redirect("/verwaltung");
  if (!isSelfManaged(org)) redirect("/verwaltung/branding");

  const { fehler } = await searchParams;

  return (
    <>
      <PageTitle back={{ href: SETTINGS_HREF, label: "Einstellungen" }}>Gemeinschaft</PageTitle>

      {fehler === "name" ? (
        <Alert variant="error" className="mb-4">
          Bitte geben Sie einen Namen mit mindestens zwei Zeichen an.
        </Alert>
      ) : null}

      <Card title="Name der Gemeinschaft">
        <form action={updateGemeinschaftsname} className="space-y-3">
          <Field label="Name">
            <input
              type="text"
              name="name"
              required
              minLength={2}
              maxLength={200}
              defaultValue={org.name ?? ""}
              placeholder="z. B. WEG Lindenhof 12"
              className={inputClass}
            />
          </Field>
          <Tipp>
            Dieser Name steht in der Kopfzeile des Portals und auf Schreiben an die
            Eigentümer. Gemeint ist die Gemeinschaft als Ganzes — die einzelnen Objekte
            tragen ihre eigenen Bezeichnungen.
          </Tipp>
          <SubmitButton>Namen speichern</SubmitButton>
        </form>
      </Card>
    </>
  );
}
