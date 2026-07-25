import { PendingButton } from "@/components/pending-button";
import { inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
import { AddTenancyForm } from "./add-tenancy-form";
import { CraftsmanAssignPicker } from "./craftsman-assign";
import { PropertyAssignPicker } from "./property-assign";
import { SignatureCanvas } from "./signature-canvas";
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

/** Person mit allen Beziehungen, die die Einstellungen brauchen. */
export type PersonMitBezug = Awaited<ReturnType<typeof loadPerson>>;

/** Lädt eine Person samt der Beziehungen, die die Einstellungen anzeigen. */
export async function loadPerson(id: string) {
  return db.user.findUnique({
    where: { id },
    include: {
      tenancies: { where: { active: true }, include: { unit: { include: { property: true } } } },
      ownerships: { include: { property: true } },
      propertyAssignments: { include: { property: true } },
      craftsmanAssignments: { include: { craftsman: true } },
    },
  });
}

export type PropertyOption = { id: string; name: string; street: string; zip: string; city: string };
export type CraftsmanOption = { id: string; name: string; company: string | null; tradeLabel: string };

/**
 * Alle Einstellungen zu einer Person: Zugang, Mietverhältnisse, Eigentum,
 * Objektzuweisung, Handwerker-Zugriff, Anschrift und Unterschrift.
 *
 * Bewusst als eigene Komponente, damit Nutzerliste und Kontakt-Detailseite
 * denselben Stand zeigen – dieselbe Oberfläche zweimal zu pflegen ginge schief.
 */
export function PersonEinstellungen({
  u,
  verwalter,
  properties,
  craftsmenForPicker,
  zurueck,
}: {
  u: NonNullable<PersonMitBezug>;
  verwalter: User;
  properties: PropertyOption[];
  craftsmenForPicker: CraftsmanOption[];
  /** Wohin nach dem Speichern zurück – die Aktionen laufen von zwei Seiten. */
  zurueck: string;
}) {
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
    <div className="space-y-2">
      {/* Schnellaktionen */}
      <div className="flex flex-wrap items-center gap-3">
        {hasInvitePending ? (
          <form action={resendInvite}>
            <input type="hidden" name="zurueck" value={zurueck} />
            <input type="hidden" name="id" value={u.id} />
            <button type="submit" className="text-xs text-amber-700 hover:underline">
              Erneut einladen
            </button>
          </form>
        ) : null}
        {u.active ? (
          <form action={regenerateAccessLetter}>
            <input type="hidden" name="zurueck" value={zurueck} />
            <input type="hidden" name="id" value={u.id} />
            <button type="submit" className="text-xs text-brand-green hover:underline">
              Zugangsschreiben
            </button>
          </form>
        ) : null}
        {u.id !== verwalter.id ? (
          <form action={toggleUserActive}>
            <input type="hidden" name="zurueck" value={zurueck} />
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
            <input type="hidden" name="zurueck" value={zurueck} />
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
                    <input type="hidden" name="zurueck" value={zurueck} />
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
            zurueck={zurueck}
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
                    <input type="hidden" name="zurueck" value={zurueck} />
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
              <input type="hidden" name="zurueck" value={zurueck} />
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
                  <input type="hidden" name="zurueck" value={zurueck} />
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
                      <input type="hidden" name="zurueck" value={zurueck} />
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
                zurueck={zurueck}
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
                        <input type="hidden" name="zurueck" value={zurueck} />
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
                zurueck={zurueck}
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
    </div>
  );
}
