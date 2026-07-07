import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Card, PageTitle, buttonSecondaryClass, inputClass } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { propertyWhereForVerwalter, userWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, roleLabels, tradeLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { AddTenancyForm } from "./add-tenancy-form";
import { CraftsmanAssignPicker } from "./craftsman-assign";
import { NewUserForm } from "./new-user-form";
import { PropertyAssignPicker } from "./property-assign";
import { UserRow } from "./user-row";
import {
  addOwnership,
  anonymizeUser,
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
import { SignatureCanvas } from "./signature-canvas";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

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
    page?: string;
  }>;
}) {
  const verwalter = await requireVerwalter();
  const { fehler, msg, eingeladen, anonymisiert, stammdaten, q, rolle, objekt, page } =
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
  const where = { AND: filterAnd };

  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);

  const [total, users, properties, craftsmen] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { name: "asc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        tenancies: { where: { active: true }, include: { unit: { include: { property: true } } } },
        ownerships: { include: { property: true } },
        propertyAssignments: { include: { property: true } },
        craftsmanAssignments: { include: { craftsman: true } },
      },
    }),
    // Objektliste ohne Einheiten (die laden die Formulare on demand). Adressfelder
    // werden für Filter-Dropdown und Objekt-Zuweisung benötigt.
    db.property.findMany({
      where: await propertyWhereForVerwalter(verwalter),
      select: { id: true, name: true, street: true, zip: true, city: true },
      orderBy: { name: "asc" },
    }),
    // Handwerker-Pool nur für SuperAdmins (für die optionale Freigabe-Auswahl) – eigene Org.
    verwalter.isSuperAdmin
      ? db.craftsman.findMany({
          where: { active: true, organizationId: verwalter.organizationId },
          orderBy: [{ trade: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const craftsmenForPicker = craftsmen.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    tradeLabel: tradeLabels[c.trade],
  }));

  // Hilfsfunktion: Querystring für Paginierungslinks (Filter beibehalten)
  function pageHref(p: number) {
    const sp = new URLSearchParams();
    if (term) sp.set("q", term);
    if (roleFilter) sp.set("rolle", roleFilter);
    if (objekt) sp.set("objekt", objekt);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/verwaltung/nutzer?${qs}` : "/verwaltung/nutzer";
  }

  const propsForNewUser = properties.map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <PageTitle
        action={
          <Link href="/verwaltung" className={buttonSecondaryClass}>
            ← Verwaltung
          </Link>
        }
      >
        Nutzer
      </PageTitle>

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
          {/* Filter-Toolbar */}
          <form
            method="get"
            className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[12rem] flex-1">
                <span className="mb-1 block text-xs font-medium text-gray-500">Suche</span>
                <input
                  type="text"
                  name="q"
                  defaultValue={term}
                  placeholder="Name oder E-Mail…"
                  className={inputClass}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-500">Rolle</span>
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
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-500">Objekt</span>
                <select name="objekt" defaultValue={objekt ?? ""} className={`${inputClass} w-auto`}>
                  <option value="">Alle Objekte</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.zip} {p.city}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-green-dark shadow-sm transition-all hover:bg-brand-orange-dark active:scale-95"
              >
                Filtern
              </button>
              {hasFilter ? (
                <Link
                  href="/verwaltung/nutzer"
                  className="self-center text-sm text-gray-400 hover:text-brand-orange hover:underline"
                >
                  ✕ Zurücksetzen
                </Link>
              ) : null}
            </div>
          </form>

          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs text-gray-400">
              {total} {total === 1 ? "Nutzer" : "Nutzer"}
              {hasFilter ? " (gefiltert)" : ""}
              {totalPages > 1 ? ` · Seite ${currentPage} von ${totalPages}` : ""}
            </p>
          </div>

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

                const assignedUnitIds = u.tenancies.map((t) => t.unitId);
                const assignedOwnPropIds = new Set(u.ownerships.map((o) => o.propertyId));
                const availableOwnProps = properties.filter((p) => !assignedOwnPropIds.has(p.id));
                const assignedMgmtPropIds = new Set(u.propertyAssignments.map((a) => a.propertyId));
                const availableMgmtProps = properties.filter((p) => !assignedMgmtPropIds.has(p.id));
                const assignedCraftIds = new Set(u.craftsmanAssignments.map((a) => a.craftsmanId));
                const isManagedVerwalter = u.role === "VERWALTER" && u.id !== verwalter.id;

                return (
                  <UserRow
                    key={u.id}
                    name={u.name}
                    salutation={u.salutation}
                    roleBadge={
                      <span className="rounded-full bg-brand-orange-light px-2 py-0.5 text-xs font-medium text-brand-orange-dark">
                        {roleLabels[u.role]}
                      </span>
                    }
                    statusBadges={
                      <>
                        {u.role === "VERWALTER" && u.isSuperAdmin ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            Super-Admin · sieht alles
                          </span>
                        ) : null}
                        {!u.active ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            deaktiviert
                          </span>
                        ) : null}
                        {hasInvitePending ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Einladung ausstehend
                          </span>
                        ) : null}
                        {u.mustChangePassword ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Erst-Passwort aktiv
                          </span>
                        ) : null}
                      </>
                    }
                    subtitle={
                      <>
                        {u.email ?? (u.username ? `Benutzer: ${u.username}` : "ohne Login")}
                        {u.phone ? ` · ${u.phone}` : ""} · angelegt {formatDate(u.createdAt)}
                      </>
                    }
                  >
                    {/* Schnellaktionen */}
                    <div className="flex flex-wrap items-center gap-3">
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
                      <a href={`/api/export/${u.id}`} className="text-xs text-gray-500 hover:underline">
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
                    </div>

                    {/* MIETER: Einheiten */}
                    {u.role === "MIETER" ? (
                      <div className="rounded-lg border border-gray-100 bg-white p-2">
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
                        <AddTenancyForm
                          userId={u.id}
                          properties={properties}
                          assignedUnitIds={assignedUnitIds}
                        />
                      </div>
                    ) : null}

                    {/* EIGENTÜMER: Objekte */}
                    {u.role === "EIGENTUEMER" ? (
                      <div className="rounded-lg border border-gray-100 bg-white p-2">
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
                        {availableOwnProps.length > 0 ? (
                          <form action={addOwnership} className="mt-2 flex flex-wrap items-center gap-2">
                            <input type="hidden" name="userId" value={u.id} />
                            <select name="propertyId" required className={`${inputClass} flex-1 text-xs`}>
                              {availableOwnProps.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <PendingButton
                              pendingLabel="…"
                              className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              + Objekt hinzufügen
                            </PendingButton>
                          </form>
                        ) : null}
                      </div>
                    ) : null}

                    {/* VERWALTER: Zuständige Objekte + Handwerker-Zugriff */}
                    {isManagedVerwalter ? (
                      <>
                        <div className="rounded-lg border border-gray-100 bg-white p-2">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-medium text-gray-500">Zuständige Objekte</p>
                            {verwalter.isSuperAdmin ? (
                              <form action={toggleSuperAdmin} className="inline">
                                <input type="hidden" name="id" value={u.id} />
                                <button
                                  type="submit"
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                                    u.isSuperAdmin
                                      ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                  }`}
                                >
                                  {u.isSuperAdmin ? "Super-Admin ✓ (entziehen)" : "Zu Super-Admin machen"}
                                </button>
                              </form>
                            ) : null}
                          </div>
                          {u.isSuperAdmin ? (
                            <p className="text-xs font-medium text-indigo-700">
                              Sieht alle Objekte und Handwerker (Super-Admin). Objekt-/Handwerker-Zuweisung
                              hat keine Wirkung, solange Super-Admin aktiv ist.
                            </p>
                          ) : u.propertyAssignments.length === 0 ? (
                            <p className="text-xs text-amber-600">
                              Keine Objekte zugewiesen – sieht derzeit nichts.
                            </p>
                          ) : (
                            <ul className="space-y-0.5">
                              {u.propertyAssignments.map((a) => (
                                <li key={a.id} className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-gray-700">{a.property.name}</span>
                                  <form action={removePropertyAssignment}>
                                    <input type="hidden" name="id" value={a.id} />
                                    <button type="submit" className="text-xs text-red-600 hover:underline">
                                      Entfernen
                                    </button>
                                  </form>
                                </li>
                              ))}
                            </ul>
                          )}
                          {!u.isSuperAdmin ? (
                            <PropertyAssignPicker
                              userId={u.id}
                              available={availableMgmtProps.map((p) => ({
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
                          <div className="rounded-lg border border-gray-100 bg-white p-2">
                            <p className="mb-1 text-xs font-medium text-gray-500">Handwerker-Zugriff</p>
                            {u.craftsmanAssignments.length === 0 ? (
                              <p className="text-xs text-gray-400">Sieht alle Handwerker (Standard).</p>
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
                    ) : null}

                    {/* Stammdaten / Unterschrift */}
                    {u.role === "EIGENTUEMER" || u.role === "VERWALTER" ? (
                      <form
                        action={uploadStammdaten}
                        className="rounded-lg border border-gray-100 bg-white p-2"
                      >
                        <input type="hidden" name="id" value={u.id} />
                        <p className="mb-2 text-xs font-medium text-gray-500">
                          Anschrift{u.role === "EIGENTUEMER" ? " (als Wohnungsgeber)" : ""} &amp;
                          Unterschrift für Bescheinigungen
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
                          <PendingButton className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                            Speichern
                          </PendingButton>
                        </div>
                        <div className="mt-3">
                          <SignatureCanvas hasExisting={!!u.signatureStoredName} />
                        </div>
                        <p className="mt-1 text-[11px] text-gray-400">
                          Unterschrift mit Finger oder Maus zeichnen. Wird automatisch
                          in generierte Bescheinigungen eingefügt.
                        </p>
                      </form>
                    ) : null}
                  </UserRow>
                );
              })}
            </ul>
          </div>

          {/* Paginierung */}
          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              {currentPage > 1 ? (
                <Link
                  href={pageHref(currentPage - 1)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ← Zurück
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-400">
                Seite {currentPage} von {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link
                  href={pageHref(currentPage + 1)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Weiter →
                </Link>
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </div>

        <Card title="Neuen Nutzer anlegen">
          <NewUserForm properties={propsForNewUser} isSuperAdmin={verwalter.isSuperAdmin} />
        </Card>
      </div>
    </>
  );
}
