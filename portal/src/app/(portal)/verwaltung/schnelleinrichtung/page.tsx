import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { requireVerwalter } from "@/lib/session";
import { schnelleinrichtung } from "./actions";

export const dynamic = "force-dynamic";

const UNIT_COUNT = 6;

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
        Legen Sie ein neues Objekt mit Eigentümer und Mietern in einem Schritt an. Alle
        angegebenen Personen erhalten automatisch eine Einladungs-E-Mail.
      </p>

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Bitte füllen Sie mindestens die Objektdaten aus.
        </p>
      ) : null}

      <form action={schnelleinrichtung} className="space-y-6">
        {/* Objekt */}
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

        {/* Eigentümer */}
        <Card title="2. Eigentümer (optional)">
          <p className="mb-3 text-xs text-gray-500">
            Lassen Sie die Felder leer, wenn kein Eigentümer angelegt werden soll.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name">
              <input type="text" name="eigName" minLength={2} className={inputClass} />
            </Field>
            <Field label="E-Mail">
              <input type="email" name="eigEmail" className={inputClass} />
            </Field>
            <Field label="Telefon (optional)">
              <input type="tel" name="eigPhone" className={inputClass} />
            </Field>
          </div>
        </Card>

        {/* Einheiten */}
        <Card title={`3. Einheiten & Mieter (bis zu ${UNIT_COUNT})`}>
          <p className="mb-4 text-xs text-gray-500">
            Füllen Sie nur die Einheiten aus, die Sie anlegen möchten. Mieterangaben sind
            optional.
          </p>
          <div className="space-y-6">
            {Array.from({ length: UNIT_COUNT }, (_, i) => i + 1).map((i) => (
              <div key={i} className="rounded-md border border-gray-100 bg-gray-50 p-4">
                <p className="mb-3 text-sm font-medium text-gray-700">Einheit {i}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bezeichnung (z. B. WE 01, EG links)">
                    <input
                      type="text"
                      name={`unit${i}Label`}
                      placeholder={`WE 0${i}`}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Etage (optional)">
                    <input
                      type="text"
                      name={`unit${i}Floor`}
                      placeholder="z. B. EG, 1. OG"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <p className="mb-2 mt-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Mieter dieser Einheit (optional)
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Name">
                    <input type="text" name={`unit${i}MieterName`} className={inputClass} />
                  </Field>
                  <Field label="E-Mail">
                    <input type="email" name={`unit${i}MieterEmail`} className={inputClass} />
                  </Field>
                  <Field label="Telefon (optional)">
                    <input type="tel" name={`unit${i}MieterPhone`} className={inputClass} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex items-center gap-4">
          <button type="submit" className={buttonClass}>
            Objekt anlegen &amp; Einladungen versenden
          </button>
          <a href="/verwaltung/objekte" className="text-sm text-gray-500 hover:underline">
            Abbrechen
          </a>
        </div>
      </form>
    </>
  );
}
