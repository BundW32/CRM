import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { SubmitButton } from "@/components/submit-button";
import { propertyWhereForVerwalter, userWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, roleLabels, tradeLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { CraftsmanAssignPicker } from "./craftsman-assign";
import { PropertyAssignPicker } from "./property-assign";
import {
  addOwnership,
  addTenancy,
  anonymizeUser,
  createUser,
  regenerateAccessLetter,
  removeCraftsmanAssignment,
  removeOwnership,
  removePropertyAssignment,
  removeTenancy,
  resendInvite,
  toggleSuperAdmin,
  toggleUserActive,
  uploadStammdaten,
} from "./actions";
import { SignatureInput } from "./signature-input";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte alle Pflichtfelder ausfüllen.",
  email: "Diese E-Mail-Adresse ist bereits vergeben.",
  email_fehlt: "Für eine E-Mail-Einladung muss eine E-Mail-Adresse angegeben werden.",
  signatur: "Die Unterschrift muss ein Bild (PNG/JPG) unter 5 MB sein (oder Vercel Blob konfigurieren).",
  stammdaten: "Fehler beim Speichern – bitte erneut versuchen.",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    fehler?: string;
    msg?: string;
    eingeladen?: string;
    anonymisiert?: string;
    stammdaten?: string;
    q?: string;
    rolle?: string;
    objekt?: string;
  }>;
}) {
  const verwalter = await requireVerwalter();
  const { fehler, msg, eingeladen, anonymisiert, stammdaten, q, rolle, objekt } =
    await searchParams;

  // Filter (Rolle, Objekt/Region, Suche) zusätzlich zum Scope des Verwalters.
  const roleValues = ["VERWALTER", "EIGENTUEMER", "MIETER", "HANDWERKER"] as const;
  const filterAnd: Prisma.UserWhereInput[] = [await userWhereForVerwalter(verwalter)];
  const roleFilter = roleValues.find((r) => r === rolle);
  if (roleFilter) filterAnd.push({ role: roleFilter });
  if (objekt) {
    filterAnd.push({
      OR: [
        { tenancies: { some: { unit: { propertyId: objekt } } } },
        { ownerships: { some: { propertyId: objekt } } },
        { propertyAssignments: { some: { propertyId: objekt } } },
      ],
    });
  }
  const term = (q ?? "").trim();
  if (term) {
    filterAnd.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    });
  }
  const hasFilter = Boolean(roleFilter || objekt || term);

  const [users, properties, craftsmen] = await Promise.all([
    db.user.findMany({
      where: { AND: filterAnd },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: {
        tenancies: { where: { active: true }, include: { unit: { include: { property: true } } } },
        ownerships: { include: { property: true } },
        propertyAssignments: { include: { property: true } },
        craftsmanAssignments: { include: { craftsman: true } },
      },
    }),
    db.property.findMany({
      where: await propertyWhereForVerwalter(verwalter),
      include: { units: true },
      orderBy: { name: "asc" },
    }),
    // Handwerker-Pool nur für SuperAdmins (für die optionale Freigabe-Auswahl)
    verwalter.isSuperAdmin
      ? db.craftsman.findMany({
          where: { active: true },
          orderBy: [{ trade: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const craftsmenForPicker = craftsmen.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    tradeLabel: tradeLabels[c.trade],
  }));

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
          {msg ? <span className="mt-1 block text-xs text-red-500">Details: {msg}</span> : null}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              name="q"
              defaultValue={term}
              placeholder="Name oder E-Mail…"
              className={`${inputClass} min-w-[10rem] flex-1`}
            />
            <select name="rolle" defaultValue={roleFilter ?? ""} className={`${inputClass} w-auto`}>
              <option value="">Alle Rollen</option>
              <option value="MIETER">Mieter</option>
              <option value="EIGENTUEMER">Eigentümer</option>
              {verwalter.isSuperAdmin ? (
                <>
                  <option value="VERWALTER">Verwalter</option>
                  <option value="HANDWERKER">Handwerker</option>
                </>
              ) : null}
            </select>
            <select name="objekt" defaultValue={objekt ?? ""} className={`${inputClass} w-auto`}>
              <option value="">Alle Objekte</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.zip} {p.city}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClass}>
              Filtern
            </button>
            {hasFilter ? (
              <Link
                href="/verwaltung/nutzer"
                className="self-center text-sm text-gray-300 hover:text-brand-orange hover:underline"
              >
                ✕ Zurücksetzen
              </Link>
            ) : null}
          </form>
          {hasFilter ? (
            <p className="mb-2 text-xs text-gray-400">
              {users.length} Treffer
            </p>
          ) : null}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {users.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400">Keine Nutzer gefunden.</p>
            ) : null}
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
                        {u.salutation ? `${u.salutation} ` : ""}{u.name}
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
                      {u.role === "MIETER" ? (() => {
                        const assignedUnitIds = new Set(u.tenancies.map((t) => t.unitId));
                        const availableUnits = properties.flatMap((p) =>
                          p.units
                            .filter((un) => !assignedUnitIds.has(un.id))
                            .map((un) => ({ ...un, propertyName: p.name }))
                        );
                        return (
                          <div className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <p className="mb-1 text-xs font-medium text-gray-500">Einheiten</p>
                            {u.tenancies.length === 0 ? (
                              <p className="text-xs text-gray-400">Keine Einheit zugeordnet.</p>
                            ) : (
                              <ul className="space-y-0.5">
                                {u.tenancies.map((t) => (
                                  <li key={t.id} className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-700">
                                      {t.unit.property.name} – {t.unit.label}
                                    </span>
                                    <form action={removeTenancy}>
                                      <input type="hidden" name="id" value={t.id} />
                                      <button type="submit" className="text-xs text-red-600 hover:underline">
                                        Entfernen
                                      </button>
                                    </form>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {availableUnits.length > 0 ? (
                              <form action={addTenancy} className="mt-2 flex flex-wrap items-center gap-2">
                                <input type="hidden" name="userId" value={u.id} />
                                <select name="unitId" required className={`${inputClass} flex-1 text-xs`}>
                                  {availableUnits.map((un) => (
                                    <option key={un.id} value={un.id}>
                                      {un.propertyName} – {un.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="submit"
                                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  + Einheit hinzufügen
                                </button>
                              </form>
                            ) : null}
                          </div>
                        );
                      })() : null}
                      {u.role === "EIGENTUEMER" ? (() => {
                        const assignedPropIds = new Set(u.ownerships.map((o) => o.propertyId));
                        const availableProps = properties.filter((p) => !assignedPropIds.has(p.id));
                        return (
                          <div className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <p className="mb-1 text-xs font-medium text-gray-500">Objekte</p>
                            {u.ownerships.length === 0 ? (
                              <p className="text-xs text-gray-400">Kein Objekt zugeordnet.</p>
                            ) : (
                              <ul className="space-y-0.5">
                                {u.ownerships.map((o) => (
                                  <li key={o.id} className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-700">{o.property.name}</span>
                                    <form action={removeOwnership}>
                                      <input type="hidden" name="id" value={o.id} />
                                      <button type="submit" className="text-xs text-red-600 hover:underline">
                                        Entfernen
                                      </button>
                                    </form>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {availableProps.length > 0 ? (
                              <form action={addOwnership} className="mt-2 flex flex-wrap items-center gap-2">
                                <input type="hidden" name="userId" value={u.id} />
                                <select name="propertyId" required className={`${inputClass} flex-1 text-xs`}>
                                  {availableProps.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="submit"
                                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  + Objekt hinzufügen
                                </button>
                              </form>
                            ) : null}
                          </div>
                        );
                      })() : null}
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
                      {verwalter.isSuperAdmin && u.id !== verwalter.id ? (
                        <form action={anonymizeUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <button type="submit" className="text-xs text-red-600 hover:underline">
                            DSGVO-Löschung
                          </button>
                        </form>
                      ) : null}
                    </span>

                    {u.role === "VERWALTER" && u.id !== verwalter.id ? (() => {
                      const assignedPropIds = new Set(u.propertyAssignments.map((a) => a.propertyId));
                      const availableProps = properties.filter((p) => !assignedPropIds.has(p.id));
                      const assignedCraftIds = new Set(u.craftsmanAssignments.map((a) => a.craftsmanId));
                      return (
                        <>
                        <div className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 p-2">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-gray-500">Zuständige Objekte</p>
                            {verwalter.isSuperAdmin ? (
                              <form action={toggleSuperAdmin} className="inline">
                                <input type="hidden" name="id" value={u.id} />
                                <button type="submit" className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${u.isSuperAdmin ? "bg-brand-orange-light text-brand-orange-dark" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                                  {u.isSuperAdmin ? "Super-Admin ✓" : "Super-Admin?"}
                                </button>
                              </form>
                            ) : null}
                          </div>
                          {u.isSuperAdmin ? (
                            <p className="text-xs font-medium text-brand-orange-dark">Sieht alle Objekte (Super-Admin)</p>
                          ) : u.propertyAssignments.length === 0 ? (
                            <p className="text-xs text-amber-600">Keine Objekte zugewiesen – sieht derzeit nichts.</p>
                          ) : (
                            <ul className="space-y-0.5">
                              {u.propertyAssignments.map((a) => (
                                <li key={a.id} className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-gray-700">{a.property.name}</span>
                                  <form action={removePropertyAssignment}>
                                    <input type="hidden" name="id" value={a.id} />
                                    <button type="submit" className="text-xs text-red-600 hover:underline">Entfernen</button>
                                  </form>
                                </li>
                              ))}
                            </ul>
                          )}
                          {!u.isSuperAdmin ? (
                            <PropertyAssignPicker
                              userId={u.id}
                              available={availableProps.map((p) => ({
                                id: p.id,
                                name: p.name,
                                zip: p.zip,
                                city: p.city,
                                street: p.street,
                              }))}
                            />
                          ) : null}
                        </div>

                        {!u.isSuperAdmin && verwalter.isSuperAdmin ? (
                          <div className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <p className="mb-1 text-xs font-medium text-gray-500">Handwerker-Zugriff</p>
                            {u.craftsmanAssignments.length === 0 ? (
                              <p className="text-xs text-gray-400">
                                Sieht alle Handwerker (Standard).
                              </p>
                            ) : (
                              <ul className="space-y-0.5">
                                {u.craftsmanAssignments.map((a) => (
                                  <li key={a.id} className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-700">
                                      {a.craftsman.company ? `${a.craftsman.company} / ` : ""}
                                      {a.craftsman.name}
                                    </span>
                                    <form action={removeCraftsmanAssignment}>
                                      <input type="hidden" name="id" value={a.id} />
                                      <button type="submit" className="text-xs text-red-600 hover:underline">
                                        Entfernen
                                      </button>
                                    </form>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <CraftsmanAssignPicker
                              userId={u.id}
                              available={craftsmenForPicker.filter((c) => !assignedCraftIds.has(c.id))}
                            />
                            <p className="mt-1 text-[11px] text-gray-400">
                              Keine Auswahl = sieht alle Handwerker. Sobald Sie auswählen, sieht
                              dieser Verwalter nur diese.
                            </p>
                          </div>
                        ) : null}
                        </>
                      );
                    })() : null}

                    {u.role === "EIGENTUEMER" || u.role === "VERWALTER" ? (
                      <form
                        action={uploadStammdaten}
                        encType="multipart/form-data"
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
                          <SignatureInput inputClassName="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-brand-orange-light file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-orange-dark" />
                          <PendingButton className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                            Speichern
                          </PendingButton>
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
              <div className="flex flex-wrap gap-2">
                <select name="salutation" className={`${inputClass} w-24`} defaultValue="">
                  <option value="">Anrede</option>
                  <option value="Herr">Herr</option>
                  <option value="Frau">Frau</option>
                </select>
                <input type="text" name="firstName" required placeholder="Vorname" className={`${inputClass} flex-1`} />
                <input type="text" name="lastName" required placeholder="Nachname" className={`${inputClass} flex-1`} />
              </div>
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
                {verwalter.isSuperAdmin ? (
                  <>
                    <option value="VERWALTER">Verwalter</option>
                    <option value="HANDWERKER">Handwerker</option>
                  </>
                ) : null}
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
            <SubmitButton pendingLabel="Wird angelegt…">Anlegen</SubmitButton>
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
