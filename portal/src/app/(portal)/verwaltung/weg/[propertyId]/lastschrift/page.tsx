import Link from "next/link";
import { PendingButton } from "@/components/pending-button";
import { Alert, Card, EmptyState, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { requireWegProperty } from "@/lib/weg/scope";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import { deleteMandate, saveCreditorId, saveMandate } from "./actions";

export const dynamic = "force-dynamic";

const SEQ_LABEL: Record<string, string> = {
  FRST: "Erstmalig",
  RCUR: "Wiederkehrend",
  OOFF: "Einmalig",
};
const FEHLER: Record<string, string> = {
  einheit: "Die Einheit gehört nicht zu diesem Objekt.",
  datum: "Das Unterschriftsdatum konnte nicht gelesen werden.",
};
const OK: Record<string, string> = {
  glaeubiger: "Gläubiger-ID gespeichert.",
  mandat: "Mandat gespeichert.",
  geloescht: "Mandat gelöscht.",
};

export default async function LastschriftPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ gespeichert?: string; fehler?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;
  const now = new Date();

  const [units, mandates, giro, dueSums, paidSums] = await Promise.all([
    db.unit.findMany({
      where: { propertyId: property.id },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    }),
    db.sepaMandate.findMany({ where: { propertyId: property.id } }),
    db.ledgerAccount.findFirst({
      where: { propertyId: property.id, kind: "GIRO", active: true },
      select: { iban: true, name: true },
    }),
    db.duePosting.groupBy({
      by: ["unitId"],
      where: { propertyId: property.id, dueDate: { lte: now } },
      _sum: { amountCents: true },
    }),
    db.booking.groupBy({
      by: ["unitId"],
      where: { propertyId: property.id, kind: "EINNAHME", unitId: { not: null }, ...NOT_REVERSED },
      _sum: { amountCents: true },
    }),
  ]);

  const mandateByUnit = new Map(mandates.map((m) => [m.unitId, m]));
  const dueByUnit = new Map(dueSums.map((d) => [d.unitId, d._sum.amountCents ?? 0]));
  const paidByUnit = new Map(paidSums.map((p) => [p.unitId as string, p._sum.amountCents ?? 0]));

  const p = property as typeof property & { sepaCreditorId: string | null };
  const canExport = Boolean(p.sepaCreditorId && giro?.iban);
  const collectionDefault = new Date(now.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  return (
    <>
      <PageTitle
        back={{ href: `/verwaltung/weg/${property.id}`, label: property.name }}
        action={
          <div className="flex gap-2">
            <Link href={`/verwaltung/weg/${property.id}/hausgeld`} className={buttonSecondaryClass}>
              Hausgeld
            </Link>
          </div>
        }
      >
        SEPA-Lastschrift · {property.name}
      </PageTitle>

      <p className="mb-4 max-w-3xl text-sm text-gray-300">
        Hausgeld per SEPA-Basislastschrift einziehen — die App erzeugt eine
        <strong> pain.008-XML-Datei</strong> zum Selbst-Upload ins Online-Banking. Kein
        externer Zugang nötig. <strong>Muster — ersetzt keine Rechtsberatung.</strong>
      </p>

      {sp.fehler ? (
        <Alert variant="error" className="mb-4">{FEHLER[sp.fehler] ?? "Eingabe fehlerhaft."}</Alert>
      ) : null}
      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">{OK[sp.gespeichert] ?? "Gespeichert."}</Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Mandate je Einheit */}
          <Card title="Mandate je Einheit">
            <div className="space-y-3">
              {units.map((u) => {
                const m = mandateByUnit.get(u.id);
                const open = (dueByUnit.get(u.id) ?? 0) - (paidByUnit.get(u.id) ?? 0);
                return (
                  <details key={u.id} className="rounded-xl border border-gray-200 p-3">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">{u.label}</span>
                      <span className="flex items-center gap-3 text-xs">
                        {m ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">
                            Mandat {SEQ_LABEL[m.sequence]}
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">kein Mandat</span>
                        )}
                        <span className={open > 0 ? "text-red-600" : "text-gray-400"}>
                          offen {formatCents(Math.max(0, open))}
                        </span>
                      </span>
                    </summary>
                    <form action={saveMandate} className="mt-3 grid gap-2 sm:grid-cols-2">
                      <input type="hidden" name="propertyId" value={property.id} />
                      <input type="hidden" name="unitId" value={u.id} />
                      <Field label="Kontoinhaber">
                        <input type="text" name="debtorName" defaultValue={m?.debtorName ?? ""} required className={inputClass} />
                      </Field>
                      <Field label="IBAN">
                        <input type="text" name="iban" defaultValue={m?.iban ?? ""} required className={inputClass} placeholder="DE.." />
                      </Field>
                      <Field label="BIC (optional)">
                        <input type="text" name="bic" defaultValue={m?.bic ?? ""} className={inputClass} />
                      </Field>
                      <Field label="Mandatsreferenz (optional)">
                        <input type="text" name="mandateRef" defaultValue={m?.mandateRef ?? ""} className={inputClass} placeholder="automatisch" />
                      </Field>
                      <Field label="Unterschrieben am">
                        <input type="date" name="signedDate" defaultValue={m ? m.signedDate.toISOString().slice(0, 10) : today} required className={inputClass} />
                      </Field>
                      <Field label="Sequenz">
                        <select name="sequence" defaultValue={m?.sequence ?? "FRST"} className={inputClass}>
                          <option value="FRST">Erstmalig (FRST)</option>
                          <option value="RCUR">Wiederkehrend (RCUR)</option>
                          <option value="OOFF">Einmalig (OOFF)</option>
                        </select>
                      </Field>
                      <div className="flex items-center gap-3 sm:col-span-2">
                        <button type="submit" className={buttonClass}>{m ? "Aktualisieren" : "Mandat anlegen"}</button>
                        {m ? (
                          <button type="submit" formAction={deleteMandate} name="id" value={m.id} className="text-sm text-red-600 hover:underline">
                            Mandat löschen
                          </button>
                        ) : null}
                      </div>
                    </form>
                  </details>
                );
              })}
              {units.length === 0 ? <EmptyState>Dieses Objekt hat keine Einheiten.</EmptyState> : null}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Gläubigerdaten */}
          <Card title="Gläubigerdaten">
            <form action={saveCreditorId} className="space-y-3">
              <input type="hidden" name="propertyId" value={property.id} />
              <Field label="Gläubiger-Identifikationsnummer">
                <input type="text" name="sepaCreditorId" defaultValue={p.sepaCreditorId ?? ""} placeholder="DE98ZZZ09999999999" className={inputClass} />
              </Field>
              <p className="text-xs text-gray-500">
                Girokonto (Gläubiger-IBAN): {giro?.iban ? <strong>{giro.iban}</strong> : <span className="text-red-600">nicht hinterlegt</span>}
              </p>
              <SubmitButton pendingLabel="Wird gespeichert…">Speichern</SubmitButton>
            </form>
          </Card>

          {/* Export */}
          <Card title="pain.008-Datei erzeugen">
            {!canExport ? (
              <Alert variant="warning">
                Bitte zuerst die Gläubiger-ID und ein Girokonto mit IBAN hinterlegen.
              </Alert>
            ) : (
              <form action={`/verwaltung/weg/${property.id}/lastschrift/export`} method="get" className="space-y-3">
                <Field label="Einzugstermin">
                  <input type="date" name="date" defaultValue={collectionDefault} className={inputClass} />
                </Field>
                <PendingButton className={buttonClass}>XML herunterladen</PendingButton>
                <p className="text-xs text-gray-500">
                  Eingezogen wird der zum Termin offene Hausgeld-Betrag je Einheit mit aktivem Mandat.
                  Anschließend die Datei im Online-Banking hochladen.
                </p>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
