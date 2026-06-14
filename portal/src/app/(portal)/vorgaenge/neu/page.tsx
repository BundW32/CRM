import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { ticketTargetsForUser } from "@/lib/access";
import { ticketTypeLabels, tradeLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { createTicket } from "../actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte füllen Sie alle Pflichtfelder aus (mind. 3 Zeichen).",
  ziel: "Das gewählte Objekt ist Ihnen nicht zugeordnet.",
  dateien:
    "Bitte nur Bilder (JPG, PNG, WebP, HEIC) bis 10 MB hochladen, maximal 10 Stück.",
};

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const user = await requireUser();
  const { fehler } = await searchParams;
  const targets = await ticketTargetsForUser(user);

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

      {targets.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-600">
            Ihnen ist noch kein Objekt zugeordnet. Bitte wenden Sie sich an die
            Verwaltung: info@bundwimmobilien.de
          </p>
        </Card>
      ) : (
        <Card>
          <form action={createTicket} className="max-w-2xl space-y-4">
            <Field label="Art des Vorgangs">
              <select name="type" required className={inputClass} defaultValue="SCHADEN">
                {Object.entries(ticketTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Objekt / Wohnung">
              <select name="target" required className={inputClass}>
                {targets.map((t) => (
                  <option
                    key={`${t.propertyId}|${t.unitId ?? ""}`}
                    value={`${t.propertyId}|${t.unitId ?? ""}`}
                  >
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Kategorie / Gewerk (hilft bei der Handwerker-Zuordnung)">
              <select name="trade" className={inputClass} defaultValue="">
                <option value="">– Keine Angabe / weiß ich nicht –</option>
                {Object.entries(tradeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Betreff">
              <input
                type="text"
                name="title"
                required
                minLength={3}
                maxLength={200}
                placeholder="z. B. Wasserfleck an der Badezimmerdecke"
                className={inputClass}
              />
            </Field>

            <Field label="Ort im Objekt (optional)">
              <input
                type="text"
                name="location"
                maxLength={200}
                placeholder="z. B. Bad, Decke über der Dusche"
                className={inputClass}
              />
            </Field>

            <Field label="Beschreibung">
              <textarea
                name="description"
                required
                minLength={3}
                maxLength={5000}
                rows={6}
                placeholder="Beschreiben Sie das Problem so genau wie möglich: Seit wann besteht es? Wie groß ist der Schaden? …"
                className={inputClass}
              />
            </Field>

            <Field label="Fotos (optional, max. 10 Bilder à 10 MB)">
              <input
                type="file"
                name="photos"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-orange-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-orange-dark hover:file:bg-orange-100"
              />
            </Field>

            <button type="submit" className={buttonClass}>
              Vorgang absenden
            </button>
          </form>
        </Card>
      )}
    </>
  );
}
