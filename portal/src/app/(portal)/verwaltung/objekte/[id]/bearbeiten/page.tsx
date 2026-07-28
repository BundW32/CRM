import Link from "next/link";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import { redirect } from "next/navigation";
import { Alert, Card, EmptyState, Field, PageTitle, buttonSecondaryClass, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { AddPersonForm } from "./AddPersonForm";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { managementTypeLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { FilePreviewLink } from "@/components/file-preview-link";
import {
  addPropertyOwner,
  addUnit,
  addUnitOwner,
  addUnitTenant,
  archiveProperty,
  deleteProperty,
  removePropertyOwner,
  removeUnit,
  removeUnitOwner,
  removeUnitTenant,
  unarchiveProperty,
  updateObjekt,
  updateTenancy,
  updateUnit,
} from "./actions";

export const dynamic = "force-dynamic";

function centsToInput(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function dateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

// Mietvertrag eines Mietverhältnisses (Mietverwaltung): Kaltmiete, Nebenkosten-
// Vorauszahlung, Kaution, Zeitraum und optionales Vertrags-PDF.
function TenancyContract({
  t,
}: {
  t: {
    id: string;
    user: { name: string };
    rentColdCents: number | null;
    bkPrepaymentMonthlyCents: number | null;
    depositCents: number | null;
    startDate: Date;
    endDate: Date | null;
    contractStoredName: string | null;
  };
}) {
  const fileInputClass =
    "block w-full text-xs text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-orange-light file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-orange-dark hover:file:bg-orange-100";
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">{t.user.name}</span>
        <form action={removeUnitTenant} className="inline">
          <input type="hidden" name="tenancyId" value={t.id} />
          <ConfirmActionButton
            className="text-xs text-gray-400 hover:text-red-600"
            confirmLabel="Wirklich entfernen?"
            pendingLabel="Wird entfernt…"
          >
            Mieter entfernen
          </ConfirmActionButton>
        </form>
      </div>
      <form action={updateTenancy} className="space-y-2">
        <input type="hidden" name="tenancyId" value={t.id} />
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Kaltmiete (€)">
            <input name="rentCold" inputMode="decimal" defaultValue={centsToInput(t.rentColdCents)} className={inputClass} placeholder="z. B. 480,00" />
          </Field>
          <Field label="Nebenkosten-VZ (€)">
            <input name="bkPrepay" inputMode="decimal" defaultValue={centsToInput(t.bkPrepaymentMonthlyCents)} className={inputClass} placeholder="z. B. 120,00" />
          </Field>
          <Field label="Kaution (€)">
            <input name="deposit" inputMode="decimal" defaultValue={centsToInput(t.depositCents)} className={inputClass} placeholder="z. B. 1.440,00" />
          </Field>
          <Field label="Mietbeginn">
            <input type="date" name="startDate" defaultValue={dateInput(t.startDate)} className={inputClass} />
          </Field>
          <Field label="Mietende (optional)">
            <input type="date" name="endDate" defaultValue={dateInput(t.endDate)} className={inputClass} />
          </Field>
        </div>
        <div>
          {t.contractStoredName ? (
            <div className="mb-1 flex items-center gap-3 text-xs">
              <FilePreviewLink
                src={`/api/files/mietvertrag/${t.id}`}
                title="Mietvertrag"
                className="font-medium text-brand-green hover:underline"
              >
                Vertrag ansehen
              </FilePreviewLink>
              <label className="flex items-center gap-1.5 text-gray-600">
                <input type="checkbox" name="removeContract" value="1" className="h-3.5 w-3.5" /> entfernen
              </label>
            </div>
          ) : null}
          <Field label={t.contractStoredName ? "Vertrag ersetzen (PDF/Bild)" : "Mietvertrag hochladen (PDF/Bild)"}>
            <input
              type="file"
              name="contract"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
              className={fileInputClass}
            />
          </Field>
        </div>
        <SubmitButton pendingLabel="Wird gespeichert…">Mietvertrag speichern</SubmitButton>
      </form>
    </div>
  );
}

const unitFehlerText: Record<string, string> = {
  objekt: "Bitte füllen Sie mindestens die Pflichtfelder (Bezeichnung und Adresse) aus.",
  einheit: "Bitte geben Sie eine (interne) Bezeichnung für die Einheit an.",
  einheit_belegt:
    "Die Einheit ist nicht leer (z. B. Mieter, Buchungen, Übergaben oder Vorgänge) und kann daher nicht gelöscht werden.",
  objekt_belegt:
    "Das Objekt ist nicht leer und kann nicht gelöscht werden. Sie können es stattdessen archivieren.",
  person: "Bitte geben Sie mindestens Vor- und Nachnamen an.",
  person_org:
    "Diese E-Mail-Adresse gehört bereits zu einer anderen Organisation und kann nicht zugeordnet werden.",
};

// Kompaktes Formular, um eine Person (Mieter/Eigentümer) anzulegen und zuzuordnen.
// Mit E-Mail → Einladungslink, ohne E-Mail → druckbares Zugangsschreiben.

// Personen-Chip mit Entfernen-Button (eigenes Mini-Formular).
function PersonChip({
  action,
  idName,
  idValue,
  name,
}: {
  action: (formData: FormData) => void | Promise<void>;
  idName: string;
  idValue: string;
  name: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
      {name}
      <form action={action} className="inline">
        <input type="hidden" name={idName} value={idValue} />
        <button type="submit" aria-label={`${name} entfernen`} className="text-gray-400 hover:text-red-600">
          ✕
        </button>
      </form>
    </span>
  );
}

export default async function ObjektBearbeitenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string; einheit?: string; person?: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { id } = await params;
  const { fehler, einheit, person } = await searchParams;

  if (!(await canVerwalterAccessProperty(verwalter, id))) redirect("/verwaltung/objekte");
  const p = await db.property.findFirst({
    where: { id, organizationId: verwalter.organizationId },
  });
  if (!p) redirect("/verwaltung/objekte");
  const isWeg = p.managementType === "WEG";

  const units = await db.unit.findMany({
    where: { propertyId: id },
    orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
    include: {
      tenancies: { where: { active: true }, include: { user: { select: { name: true } } } },
      unitOwnerships: { include: { user: { select: { name: true } } } },
      _count: {
        select: {
          tenancies: true,
          unitOwnerships: true,
          hausgeldPayments: true,
          duePostings: true,
          hausgeldMahnungen: true,
          statementUnitAmounts: true,
          sepaMandates: true,
          handovers: true,
          tickets: true,
          documents: true,
          meters: true,
        },
      },
    },
  });

  // Mietverwaltung: Eigentümer hängen am Objekt (nicht je Einheit).
  const propertyOwners = !isWeg
    ? await db.ownership.findMany({
        where: { propertyId: id },
        include: { user: { select: { name: true } } },
      })
    : [];

  return (
    <>
      <PageTitle
        back={{ href: "/verwaltung/objekte", label: "Objekte" }}
      >
        Objekt bearbeiten
      </PageTitle>
      <p className="mb-6 max-w-3xl text-sm text-gray-300">
        Stammdaten und Einheiten des Objekts anpassen. Die Verwaltungsart bleibt nach der
        Anlage unverändert.
      </p>

      {!p.active ? (
        <Alert variant="warning" className="mb-4">
          Dieses Objekt ist archiviert und in den aktiven Listen ausgeblendet. Sie können es unten
          reaktivieren.
        </Alert>
      ) : null}

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {unitFehlerText[fehler] ?? "Die Aktion konnte nicht ausgeführt werden."}
        </Alert>
      ) : null}
      {einheit === "gespeichert" ? (
        <Alert variant="success" className="mb-4">
          Einheit gespeichert.
        </Alert>
      ) : null}
      {einheit === "geloescht" ? (
        <Alert variant="success" className="mb-4">
          Einheit gelöscht.
        </Alert>
      ) : null}
      {person === "gespeichert" ? (
        <Alert variant="success" className="mb-4">
          Person angelegt und zugeordnet.
        </Alert>
      ) : null}
      {person === "entfernt" ? (
        <Alert variant="success" className="mb-4">
          Zuordnung entfernt.
        </Alert>
      ) : null}

      <form action={updateObjekt} className="space-y-6">
        <input type="hidden" name="id" value={p.id} />

        <Card title="Objektdaten">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bezeichnung *">
              <input
                type="text"
                name="name"
                required
                minLength={2}
                defaultValue={p.name}
                className={inputClass}
              />
            </Field>
            <Field label="Verwaltungsart">
              <input
                type="text"
                value={managementTypeLabels[p.managementType]}
                disabled
                className={`${inputClass} cursor-not-allowed bg-gray-100 text-gray-500`}
              />
            </Field>
            <Field label="Straße und Hausnummer *">
              <input type="text" name="street" required minLength={2} defaultValue={p.street} className={inputClass} />
            </Field>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <Field label="PLZ *">
                <input type="text" name="zip" required minLength={4} defaultValue={p.zip} className={inputClass} />
              </Field>
              <Field label="Ort *">
                <input type="text" name="city" required minLength={2} defaultValue={p.city} className={inputClass} />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Weitere Stammdaten (optional)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Baujahr">
              <input
                type="number"
                name="buildYear"
                min={1800}
                max={2100}
                defaultValue={p.buildYear ?? ""}
                className={inputClass}
                placeholder="z. B. 1998"
              />
            </Field>
            <Field label="Gesamtwohnfläche (m²)">
              <input
                type="text"
                inputMode="decimal"
                name="livingArea"
                defaultValue={p.livingArea ?? ""}
                className={inputClass}
                placeholder="z. B. 540"
              />
            </Field>
            <Field label="Anzahl Etagen">
              <input type="number" name="floors" min={0} defaultValue={p.floors ?? ""} className={inputClass} placeholder="z. B. 4" />
            </Field>
            <Field label="Bauart">
              <input type="text" name="buildingType" defaultValue={p.buildingType ?? ""} className={inputClass} placeholder="z. B. Mehrfamilienhaus" />
            </Field>
            <Field label="Heizungsart">
              <input type="text" name="heatingType" defaultValue={p.heatingType ?? ""} className={inputClass} placeholder="z. B. Gas-Zentralheizung" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notizen">
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={p.notes ?? ""}
                  className={inputClass}
                  placeholder="Freie Notizen zum Objekt …"
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Titelbild (optional)">
          {p.titleImageStoredName ? (
            <div className="mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/files/property-image/${p.id}`}
                alt="Aktuelles Titelbild"
                className="h-40 w-full max-w-md rounded-lg object-cover"
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" name="removeTitleImage" value="1" className="h-4 w-4" />
                Aktuelles Titelbild entfernen
              </label>
            </div>
          ) : null}
          <Field label={p.titleImageStoredName ? "Titelbild ersetzen" : "Titelbild hochladen"}>
            <input
              type="file"
              name="titleImage"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-orange-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-orange-dark hover:file:bg-orange-100"
            />
          </Field>
        </Card>

        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel="Wird gespeichert…">Stammdaten speichern</SubmitButton>
          <Link href="/verwaltung/objekte" className={buttonSecondaryClass}>
            Abbrechen
          </Link>
        </div>
      </form>

      {/* ── Einheiten ─────────────────────────────────────────────────── */}
      <div className="mt-8">
        <h2 className="mb-1 text-lg font-bold tracking-tight text-white">Einheiten</h2>
        <p className="mb-4 max-w-3xl text-sm text-gray-300">
          Interne Bezeichnung sieht nur die Verwaltung; die externe Bezeichnung/Lage erscheint
          in Dokumenten und für Mieter/Eigentümer. Eigentümer- und Mieter-Zuordnung erfolgt unter
          „Nutzer“.
        </p>

        <div className="space-y-4">
          {units.length === 0 ? (
            <EmptyState>Noch keine Einheiten angelegt.</EmptyState>
          ) : (
            units.map((u) => {
              const dependents =
                u._count.tenancies + u._count.unitOwnerships + u._count.hausgeldPayments +
                u._count.duePostings + u._count.hausgeldMahnungen + u._count.statementUnitAmounts +
                u._count.sepaMandates + u._count.handovers + u._count.tickets +
                u._count.documents + u._count.meters;
              const deletable = dependents === 0;
              return (
                <div key={u.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <form action={updateUnit} className="space-y-3">
                    <input type="hidden" name="unitId" value={u.id} />
                    <div className={`grid gap-3 sm:grid-cols-2 ${isWeg ? "lg:grid-cols-3" : ""}`}>
                      <Field label="Bezeichnung (intern) *">
                        <input type="text" name="label" required defaultValue={u.label} className={inputClass} placeholder="z. B. WE 01" />
                      </Field>
                      <Field label="Externe Bezeichnung / Lage">
                        <input type="text" name="externalLabel" defaultValue={u.externalLabel ?? ""} className={inputClass} placeholder="z. B. 1. OG links" />
                      </Field>
                      <Field label="Etage">
                        <input type="text" name="floor" defaultValue={u.floor ?? ""} className={inputClass} placeholder="z. B. EG" />
                      </Field>
                      <Field label="Fläche (m²)">
                        <input type="text" inputMode="decimal" name="livingArea" defaultValue={u.livingArea ?? ""} className={inputClass} placeholder="z. B. 72,5" />
                      </Field>
                      {isWeg ? (
                        <Field label="MEA">
                          <input type="number" min={0} name="mea" defaultValue={u.mea ?? ""} className={inputClass} placeholder="z. B. 250" />
                        </Field>
                      ) : null}
                      <Field label="Personen">
                        <input type="number" min={0} name="personCount" defaultValue={u.personCount ?? ""} className={inputClass} placeholder="z. B. 2" />
                      </Field>
                    </div>
                    <div className="flex items-center gap-3">
                      <SubmitButton pendingLabel="Wird gespeichert…">Einheit speichern</SubmitButton>
                    </div>
                  </form>

                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-xs font-medium text-gray-500">
                      Mieter{u.livingArea != null ? ` · ${u.livingArea} m²` : ""}
                    </p>
                    {u.tenancies.length === 0 ? (
                      <p className="mt-1 text-xs text-gray-400">Keine</p>
                    ) : isWeg ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {u.tenancies.map((t) => (
                          <PersonChip key={t.id} action={removeUnitTenant} idName="tenancyId" idValue={t.id} name={t.user.name} />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-3">
                        {u.tenancies.map((t) => (
                          <TenancyContract key={t.id} t={t} />
                        ))}
                      </div>
                    )}
                    <AddPersonForm action={addUnitTenant} idName="unitId" idValue={u.id} label="+ Mieter" role="MIETER" />
                  </div>

                  {isWeg ? (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <p className="text-xs font-medium text-gray-500">Eigentümer</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {u.unitOwnerships.length === 0 ? (
                          <span className="text-xs text-gray-400">Keine</span>
                        ) : (
                          u.unitOwnerships.map((o) => (
                            <PersonChip key={o.id} action={removeUnitOwner} idName="unitOwnershipId" idValue={o.id} name={o.user.name} />
                          ))
                        )}
                      </div>
                      <AddPersonForm action={addUnitOwner} idName="unitId" idValue={u.id} label="+ Eigentümer" role="EIGENTUEMER" />
                    </div>
                  ) : null}

                  <div className="mt-3 border-t border-gray-100 pt-3">
                    {deletable ? (
                      <form action={removeUnit}>
                        <input type="hidden" name="unitId" value={u.id} />
                        <ConfirmActionButton
                          className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
                          confirmLabel="Wirklich löschen?"
                          pendingLabel="Wird gelöscht…"
                        >
                          Einheit löschen
                        </ConfirmActionButton>
                      </form>
                    ) : (
                      <p className="text-xs text-gray-400">
                        Nicht löschbar – der Einheit sind noch Daten (Mieter, Buchungen, Übergaben,
                        Vorgänge o. Ä.) zugeordnet.
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4">
        <Card title="Einheit hinzufügen">
          <form action={addUnit} className="space-y-3">
            <input type="hidden" name="propertyId" value={p.id} />
            <div className={`grid gap-3 sm:grid-cols-2 ${isWeg ? "lg:grid-cols-3" : ""}`}>
              <Field label="Bezeichnung (intern) *">
                <input type="text" name="label" required className={inputClass} placeholder="z. B. WE 02" />
              </Field>
              <Field label="Externe Bezeichnung / Lage">
                <input type="text" name="externalLabel" className={inputClass} placeholder="z. B. 2. OG rechts" />
              </Field>
              <Field label="Etage">
                <input type="text" name="floor" className={inputClass} placeholder="z. B. 2. OG" />
              </Field>
              <Field label="Fläche (m²)">
                <input type="text" inputMode="decimal" name="livingArea" className={inputClass} placeholder="z. B. 65" />
              </Field>
              {isWeg ? (
                <Field label="MEA">
                  <input type="number" min={0} name="mea" className={inputClass} placeholder="z. B. 200" />
                </Field>
              ) : null}
              <Field label="Personen">
                <input type="number" min={0} name="personCount" className={inputClass} placeholder="z. B. 2" />
              </Field>
            </div>
            <SubmitButton pendingLabel="Wird angelegt…">+ Einheit hinzufügen</SubmitButton>
          </form>
        </Card>
        </div>
      </div>

      {!isWeg ? (
        <div className="mt-8">
          <h2 className="mb-1 text-lg font-bold tracking-tight text-white">Eigentümer</h2>
          <p className="mb-4 max-w-3xl text-sm text-gray-300">
            In der Mietverwaltung gehört das Objekt einem oder mehreren Eigentümern (z. B. auch
            Ehepartnern mit je eigenem Zugang). Mit E-Mail wird ein Einladungslink versendet, ohne
            E-Mail ein Zugangsschreiben erzeugt.
          </p>
          <Card title="Eigentümer des Objekts">
            <div className="flex flex-wrap items-center gap-1.5">
              {propertyOwners.length === 0 ? (
                <span className="text-xs text-gray-400">Noch kein Eigentümer.</span>
              ) : (
                propertyOwners.map((o) => (
                  <PersonChip
                    key={o.id}
                    action={removePropertyOwner}
                    idName="ownershipId"
                    idValue={o.id}
                    name={o.user.name}
                  />
                ))
              )}
            </div>
            <AddPersonForm action={addPropertyOwner} idName="propertyId" idValue={p.id} label="+ Eigentümer" role="EIGENTUEMER" />
          </Card>
        </div>
      ) : null}

      {/* ── Gefahrenzone (nur SuperAdmin) ─────────────────────────────── */}
      {verwalter.isSuperAdmin ? (
        <div className="mt-8">
          <h2 className="mb-1 text-lg font-bold tracking-tight text-white">Objekt verwalten</h2>
          <p className="mb-4 max-w-3xl text-sm text-gray-300">
            Archivieren blendet das Objekt aus den aktiven Listen aus, ohne Daten zu löschen –
            jederzeit reaktivierbar. Endgültiges Löschen ist nur bei komplett leeren Objekten
            möglich (z. B. Testeinträge).
          </p>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {p.active ? (
                <form action={archiveProperty}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmActionButton
                    className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                    confirmLabel="Wirklich archivieren?"
                    pendingLabel="Wird archiviert…"
                  >
                    Objekt archivieren
                  </ConfirmActionButton>
                </form>
              ) : (
                <form action={unarchiveProperty}>
                  <input type="hidden" name="id" value={p.id} />
                  <PendingButton className="rounded-lg border border-brand-green/40 bg-brand-green/5 px-4 py-2 text-sm font-medium text-brand-green transition hover:bg-brand-green/10">Objekt reaktivieren</PendingButton>
                </form>
              )}
              <form action={deleteProperty}>
                <input type="hidden" name="id" value={p.id} />
                <ConfirmActionButton
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                  confirmLabel="Wirklich löschen?"
                  pendingLabel="Wird gelöscht…"
                >
                  Objekt endgültig löschen
                </ConfirmActionButton>
              </form>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Löschen funktioniert nur, wenn dem Objekt keine Einheiten, Vorgänge, Dokumente,
              Eigentümer oder Finanzdaten mehr zugeordnet sind.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
