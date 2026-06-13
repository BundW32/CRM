import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { requireVerwalter } from "@/lib/session";
import { schnelleinrichtung } from "./actions";

export const dynamic = "force-dynamic";

export default async function SchnelleinrichtungPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  await requireVerwalter();
  const { fehler } = await searchParams;

  return (
    <>
      <PageTitle>Objekt-Schnelleinrichtung</PageTitle>
      <p className="mb-6 text-sm text-gray-600">
        Legen Sie ein neues Objekt mit allen Einheiten, dem Eigentümer und allen Mietern
        in einem Schritt an. Alle Zugänge werden sofort erstellt — mit E-Mail-Einladung
        oder als druckbares Zugangsschreiben.
      </p>

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Bitte füllen Sie mindestens die Objektdaten aus.
        </p>
      ) : null}

      <form action={schnelleinrichtung} className="space-y-6">
        <Card title="1. Objekt">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bezeichnung">
              <input
                type="text"
                name="name"
                required
                minLength={2}
                placeholder="z. B. Goethestraße 42"
                className={inputClass}
              />
            </Field>
            <Field label="Straße und Hausnummer">
              <input type="text" name="street" required minLength={2} className={inputClass} />
            </Field>
            <Field label="PLZ">
              <input type="text" name="zip" required minLength={4} maxLength={10} className={inputClass} />
            </Field>
            <Field label="Ort">
              <input type="text" name="city" required minLength={2} className={inputClass} />
            </Field>
          </div>
        </Card>

        <Card title="2. Einheiten (bis zu 50)">
          <p className="mb-3 text-xs text-gray-500">
            Eine Einheit pro Zeile. Optional die Etage mit einem senkrechten Strich
            anhängen: <code className="rounded bg-gray-100 px-1">Bezeichnung | Etage</code>
          </p>
          <Field label="Einheiten">
            <textarea
              name="units"
              rows={10}
              className={`${inputClass} font-mono`}
              placeholder={`WE 01, EG links | EG\nWE 02, EG rechts | EG\nWE 03, 1. OG links | 1. OG\nWE 04, 1. OG rechts | 1. OG`}
            />
          </Field>
        </Card>

        <Card title="3. Eigentümer (optional)">
          <p className="mb-3 text-xs text-gray-500">
            Mit E-Mail → Einladungslink per Mail. Ohne E-Mail → Zugangsschreiben zum Drucken.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name">
              <input type="text" name="eigName" minLength={2} className={inputClass} />
            </Field>
            <Field label="E-Mail (optional)">
              <input type="email" name="eigEmail" className={inputClass} />
            </Field>
            <Field label="Telefon (optional)">
              <input type="tel" name="eigPhone" className={inputClass} />
            </Field>
          </div>
        </Card>

        <Card title="4. Mieter (optional)">
          <p className="mb-3 text-xs text-gray-500">
            Ein Mieter pro Zeile im Format:{" "}
            <code className="rounded bg-gray-100 px-1">Name | Einheit | E-Mail</code>
            {" "}— Einheit und E-Mail sind optional. Mit E-Mail erhält der Mieter einen Einladungslink,
            ohne E-Mail wird ein Zugangsschreiben erstellt. Die Einheit muss exakt so
            geschrieben sein wie oben in Schritt 2.
          </p>
          <Field label="Mieter">
            <textarea
              name="tenants"
              rows={8}
              className={`${inputClass} font-mono`}
              placeholder={`Max Mustermann | WE 01, EG links | max@example.de\nErika Musterfrau | WE 02, EG rechts\nPeter Schmidt | WE 03, 1. OG links | peter@example.de`}
            />
          </Field>
        </Card>

        <div className="flex items-center gap-4">
          <button type="submit" className={buttonClass}>
            Objekt anlegen
          </button>
          <a href="/verwaltung/objekte" className="text-sm text-gray-500 hover:underline">
            Abbrechen
          </a>
        </div>
      </form>
    </>
  );
}
