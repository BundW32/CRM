import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate, roleLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import {
  anonymizeUser,
  createUser,
  regenerateAccessLetter,
  resendInvite,
  toggleUserActive,
  uploadStammdaten,
} from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte alle Pflichtfelder ausfüllen.",
  email: "Diese E-Mail-Adresse ist bereits vergeben.",
  email_fehlt: "Für eine E-Mail-Einladung muss eine E-Mail-Adresse angegeben werden.",
  signatur: "Die Unterschrift muss ein Bild (PNG/JPG, max. 10 MB) sein.",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    fehler?: string;
    eingeladen?: string;
    anonymisiert?: string;
    stammdaten?: string;
  }>;
}) {
  const verwalter = await requireVerwalter();
  const { fehler, eingeladen, anonymisiert, stammdaten } = await searchParams;

  const [users, properties] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: {
        tenancies: { where: { active: true }, include: { unit: { include: { property: true } } } },
        ownerships: { include: { property: true } },
      },
    }),
    db.property.findMany({ include: { units: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageTitle>Nutzer</PageTitle>

      {eingeladen ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Einladungs-E-Mail wurde versandt (sofern SMTP konfiguriert ist).
        </p>
      ) : null}
      {anonymisiert ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Der Nutzer wurde anonymisiert (DSGVO-Löschung). Personenbezogene Daten wurden entfernt.
        </p>
      ) : null}
      {stammdaten ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Stammdaten/Unterschrift gespeichert.
        </p>
      ) : null}
      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessages[fehler] ?? "Aktion fehlgeschlagen."}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <ul className="divide-y divide-gray-100">
              {users.map((u) => {
                const hasInvitePending =
                  u.active &&
                  u.email !== null &&
                  u.passwordResetToken !== null &&
                  u.passwordResetExpiry !== null &&
                  u.passwordResetExpiry > new Date();
                return (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <span>
                      <span className="block text-sm font-medium text-gray-900">
                        {u.name}
                        <span className="ml-2 rounded-full bg-brand-orange-light px-2 py-0.5 text-xs font-medium text-brand-orange-dark">
                          {roleLabels[u.role]}
                        </span>
                        {!u.active ? (
                          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            deaktiviert
                          </span>
                        ) : null}
                        {hasInvitePending ? (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Einladung ausstehend
                          </span>
                        ) : null}
                        {u.mustChangePassword ? (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Erst-Passwort aktiv
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {u.email ?? (u.username ? `Benutzer: ${u.username}` : "ohne Login")}
                        {u.phone ? ` · ${u.phone}` : ""} · angelegt {formatDate(u.createdAt)}
                      </span>
                      {u.tenancies.length > 0 ? (
                        <span className="block text-xs text-gray-500">
                          Mieter: {u.tenancies.map((t) => `${t.unit.property.name} – ${t.unit.label}`).join(", ")}
                        </span>
                      ) : null}
                      {u.ownerships.length > 0 ? (
                        <span className="block text-xs text-gray-500">
                          Eigentümer: {u.ownerships.map((o) => o.property.name).join(", ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      {hasInvitePending ? (
                        <form action={resendInvite}>
                          <input type="hidden" name="id" value={u.id} />
                          <button type="submit" className="text-xs text-amber-700 hover:underline">
                            Erneut einladen
                          </button>
                        </form>
                      ) : null}
                      {u.active ? (
                        <form action={regenerateAccessLetter}>
                          <input type="hidden" name="id" value={u.id} />
                          <button type="submit" className="text-xs text-brand-green hover:underline">
                            Zugangsschreiben
                          </button>
                        </form>
                      ) : null}
                      {u.id !== verwalter.id ? (
                        <form action={toggleUserActive}>
                          <input type="hidden" name="id" value={u.id} />
                          <button type="submit" className="text-xs text-gray-500 hover:underline">
                            {u.active ? "Deaktivieren" : "Aktivieren"}
                          </button>
                        </form>
                      ) : null}
                      <a
                        href={`/api/export/${u.id}`}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Daten exportieren
                      </a>
                      {u.id !== verwalter.id ? (
                        <form action={anonymizeUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <button type="submit" className="text-xs text-red-600 hover:underline">
                            DSGVO-Löschung
                          </button>
                        </form>
                      ) : null}
                    </span>

                    {u.role === "EIGENTUEMER" || u.role === "VERWALTER" ? (
                      <form
                        action={uploadStammdaten}
                        className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 p-2"
                      >
                        <input type="hidden" name="id" value={u.id} />
                        <p className="mb-2 text-xs font-medium text-gray-500">
                          Anschrift{u.role === "EIGENTUEMER" ? " (als Wohnungsgeber)" : ""} &
                          Unterschrift für Bescheinigungen
                          {u.signatureStoredName ? (
                            <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                              Unterschrift hinterlegt ✓
                            </span>
                          ) : null}
                        </p>
                        <div className="flex flex-wrap items-end gap-2">
                          <input
                            type="text"
                            name="street"
                            defaultValue={u.street ?? ""}
                            placeholder="Straße und Nr."
                            className={`${inputClass} w-48`}
                          />
                          <input
                            type="text"
                            name="zip"
                            defaultValue={u.zip ?? ""}
                            placeholder="PLZ"
                            className={`${inputClass} w-24`}
                          />
                          <input
                            type="text"
                            name="city"
                            defaultValue={u.city ?? ""}
                            placeholder="Ort"
                            className={`${inputClass} w-36`}
                          />
                          <input
                            type="file"
                            name="signature"
                            accept="image/png,image/jpeg"
                            className="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-brand-orange-light file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-orange-dark"
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Speichern
                          </button>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-400">
                          Unterschrift als Bild (PNG/JPG, am besten freigestellt). Wird automatisch
                          in generierte Bescheinigungen eingefügt.
                        </p>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <Card title="Neuen Nutzer anlegen">
          <form action={createUser} className="space-y-3">
            <Field label="Name">
              <input type="text" name="name" required minLength={2} className={inputClass} />
            </Field>
            <Field label="Zugang per">
              <select name="method" required className={inputClass} defaultValue="email">
                <option value="email">E-Mail-Einladung (Link zum Selbst-Einrichten)</option>
                <option value="schreiben">Zugangsschreiben zum Ausdrucken</option>
              </select>
            </Field>
            <Field label="E-Mail-Adresse (bei E-Mail-Einladung erforderlich)">
              <input type="email" name="email" className={inputClass} />
            </Field>
            <Field label="Telefon (optional)">
              <input type="tel" name="phone" className={inputClass} />
            </Field>
            <Field label="Bevorzugter Kontaktweg (optional)">
              <select name="preferredContact" className={inputClass} defaultValue="">
                <option value="">– keine Angabe –</option>
                <option value="EMAIL">E-Mail</option>
                <option value="TELEFON">Telefon</option>
                <option value="MOBIL">Mobil</option>
                <option value="POST">Post</option>
              </select>
            </Field>
            <Field label="Rolle">
              <select name="role" required className={inputClass} defaultValue="MIETER">
                <option value="MIETER">Mieter</option>
                <option value="EIGENTUEMER">Eigentümer</option>
                <option value="VERWALTER">Verwalter</option>
                <option value="HANDWERKER">Handwerker</option>
              </select>
            </Field>
            <Field label="Wohnung (bei Rolle Mieter)">
              <select name="unitId" className={inputClass} defaultValue="">
                <option value="">– Keine –</option>
                {properties.flatMap((p) =>
                  p.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {p.name} – {u.label}
                    </option>
                  ))
                )}
              </select>
            </Field>
            <Field label="Objekt (bei Rolle Eigentümer)">
              <select name="propertyId" className={inputClass} defaultValue="">
                <option value="">– Keins –</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit" className={buttonClass}>
              Anlegen
            </button>
            <p className="text-xs text-gray-500">
              <strong>E-Mail-Einladung:</strong> Der Nutzer erhält einen Link zum Einrichten
              seines Passworts (gültig 7 Tage). <strong>Zugangsschreiben:</strong> Es wird ein
              Erst-Passwort erzeugt und ein druckbares Schreiben geöffnet — ideal für Mieter
              ohne E-Mail-Adresse.
            </p>
          </form>
        </Card>
      </div>
    </>
  );
}
