import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate, roleLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { createUser, toggleUserActive } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte alle Pflichtfelder ausfüllen (Passwort mind. 8 Zeichen).",
  email: "Diese E-Mail-Adresse ist bereits vergeben.",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { fehler } = await searchParams;

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

      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessages[fehler] ?? "Aktion fehlgeschlagen."}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <ul className="divide-y divide-gray-100">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <span>
                    <span className="block text-sm font-medium text-gray-900">
                      {u.name}
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                        {roleLabels[u.role]}
                      </span>
                      {!u.active ? (
                        <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          deaktiviert
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {u.email}
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
                  {u.id !== verwalter.id ? (
                    <form action={toggleUserActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <button type="submit" className="text-xs text-blue-700 hover:underline">
                        {u.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Card title="Neuen Nutzer anlegen">
          <form action={createUser} className="space-y-3">
            <Field label="Name">
              <input type="text" name="name" required minLength={2} className={inputClass} />
            </Field>
            <Field label="E-Mail-Adresse">
              <input type="email" name="email" required className={inputClass} />
            </Field>
            <Field label="Telefon (optional)">
              <input type="tel" name="phone" className={inputClass} />
            </Field>
            <Field label="Start-Passwort (mind. 8 Zeichen)">
              <input type="text" name="password" required minLength={8} className={inputClass} />
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
              Bitte teilen Sie dem Nutzer die Zugangsdaten persönlich mit. Ein
              E-Mail-Einladungsversand folgt in Ausbaustufe 2.
            </p>
          </form>
        </Card>
      </div>
    </>
  );
}
