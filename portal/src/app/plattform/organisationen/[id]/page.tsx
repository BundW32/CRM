import { notFound } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { Alert, Card, EmptyState, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { PLANS, SUBSCRIPTION_STATUSES, planLabel, subscriptionStatusLabel } from "@/lib/billing";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { requirePlatformAdmin } from "@/lib/platform";
import { DateField } from "@/components/fields";
import {
  extendTrial,
  savePlatformNote,
  setOrganizationActive,
  setOrganizationPlan,
  startImpersonation,
} from "../actions";

export const dynamic = "force-dynamic";

const errorText: Record<string, string> = {
  eigene: "Die eigene Organisation kann nicht deaktiviert/angesehen werden.",
  eingabe: "Ungültige Eingabe.",
  kein_admin: "Kein aktiver Administrator-Zugang vorhanden – Support-Ansicht nicht möglich.",
};

export default async function OrganisationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string }>;
}) {
  const admin = await requirePlatformAdmin();
  const { id } = await params;
  const { fehler } = await searchParams;

  const org = await db.organization.findUnique({
    where: { id },
    include: {
      users: {
        where: { isSuperAdmin: true },
        select: { name: true, email: true, emailVerifiedAt: true },
      },
      _count: { select: { users: true, properties: true } },
    },
  });
  if (!org) notFound();

  const [unitCount, roleGroups] = await Promise.all([
    db.unit.count({ where: { property: { organizationId: id } } }),
    db.user.groupBy({ by: ["role"], where: { organizationId: id }, _count: { _all: true } }),
  ]);
  const roleCount = (r: string) => roleGroups.find((g) => g.role === r)?._count._all ?? 0;

  const rows: [string, string][] = [
    ["Slug", org.slug],
    ["Kontotyp", org.accountType === "selbstverwalter" ? "Selbstverwaltung" : "Hausverwaltung"],
    ["Firmenname", org.legalName ?? "—"],
    ["Anschrift", [org.street, [org.zip, org.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"],
    ["E-Mail", org.email ?? "—"],
    ["Registriert", formatDate(org.createdAt)],
    ["Herkunft", org.referralSource ?? "—"],
    ["AGB akzeptiert", org.termsAcceptedAt ? `${formatDate(org.termsAcceptedAt)} (${org.termsVersion ?? "?"})` : "—"],
  ];

  return (
    <>
      <PageTitle
        back={{ href: "/plattform/organisationen", label: "Verwaltungen" }}
      >
        {org.name}
      </PageTitle>

      {!org.active ? (
        <Alert variant="error" className="mb-4">
          Diese Verwaltung ist deaktiviert – ihre Nutzer können sich nicht anmelden.
        </Alert>
      ) : null}
      {fehler ? (
        <Alert variant="error" className="mb-4">
          {errorText[fehler] ?? "Aktion fehlgeschlagen."}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Stammdaten">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-gray-50 py-1 text-sm">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="text-right font-medium text-gray-800">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Nutzung">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Nutzer", org._count.users],
                ["Objekte", org._count.properties],
                ["Einheiten", unitCount],
                ["Verwalter", roleCount("VERWALTER")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-gray-100 p-3 text-center">
                  <p className="text-2xl font-bold text-brand-green">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Eigentümer {roleCount("EIGENTUEMER")} · Mieter {roleCount("MIETER")} · Handwerker {roleCount("HANDWERKER")}
            </p>
          </Card>

          <Card title="Administrator-Zugänge">
            {org.users.length === 0 ? (
              <EmptyState>Keine SuperAdmins hinterlegt.</EmptyState>
            ) : (
              <ul className="space-y-1 text-sm">
                {org.users.map((u) => (
                  <li key={u.email ?? u.name} className="flex justify-between">
                    <span className="text-gray-800">{u.name} · {u.email ?? "keine E-Mail"}</span>
                    <span className={u.emailVerifiedAt ? "text-green-600" : "text-amber-600"}>
                      {u.emailVerifiedAt ? "verifiziert" : "unbestätigt"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Interne Notiz">
            <form action={savePlatformNote} className="space-y-2">
              <input type="hidden" name="id" value={org.id} />
              <textarea
                name="note"
                defaultValue={org.platformNote ?? ""}
                rows={4}
                maxLength={5000}
                placeholder="Interne Notiz zu diesem Kunden (nur im Betreiber-Bereich sichtbar)…"
                className={inputClass}
              />
              <PendingButton className={buttonSecondaryClass}>Notiz speichern</PendingButton>
            </form>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Abo & Tarif">
            <p className="mb-3 text-sm text-gray-600">
              Aktuell: <strong>{planLabel(org.plan)}</strong> ·{" "}
              {subscriptionStatusLabel(org.subscriptionStatus)}
              {org.trialEndsAt ? <> · Trial bis {formatDate(org.trialEndsAt)}</> : null}
            </p>
            <form action={setOrganizationPlan} className="space-y-2">
              <input type="hidden" name="id" value={org.id} />
              <label className="block text-xs text-gray-500">
                Tarif
                <select name="plan" defaultValue={org.plan} className={`${inputClass} mt-1`}>
                  {Object.values(PLANS).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-gray-500">
                Status
                <select name="subscriptionStatus" defaultValue={org.subscriptionStatus} className={`${inputClass} mt-1`}>
                  {SUBSCRIPTION_STATUSES.map((s) => (
                    <option key={s} value={s}>{subscriptionStatusLabel(s)}</option>
                  ))}
                </select>
              </label>
              <PendingButton className={buttonClass}>Übernehmen</PendingButton>
            </form>
          </Card>

          <Card title="Testphase verlängern">
            <div className="space-y-2">
              <div className="flex gap-2">
                <form action={extendTrial}>
                  <input type="hidden" name="id" value={org.id} />
                  <input type="hidden" name="mode" value="30" />
                  <PendingButton className={buttonSecondaryClass}>+30 Tage</PendingButton>
                </form>
                <form action={extendTrial}>
                  <input type="hidden" name="id" value={org.id} />
                  <input type="hidden" name="mode" value="90" />
                  <PendingButton className={buttonSecondaryClass}>+90 Tage</PendingButton>
                </form>
              </div>
              <form action={extendTrial} className="flex items-end gap-2">
                <input type="hidden" name="id" value={org.id} />
                <input type="hidden" name="mode" value="date" />
                <label className="text-xs text-gray-500">
                  bis Datum
                  <DateField
                    name="date"
                    className="mt-1"
                  />
                </label>
                <PendingButton className={buttonSecondaryClass}>Setzen</PendingButton>
              </form>
            </div>
          </Card>

          {org.id !== admin.organizationId ? (
            <Card title="Support">
              <p className="mb-2 text-sm text-gray-600">
                Als Administrator dieser Verwaltung ins Portal wechseln (mit Banner &
                Protokollierung).
              </p>
              <form action={startImpersonation}>
                <input type="hidden" name="id" value={org.id} />
                <button type="submit" className={buttonClass} disabled={org.users.length === 0}>
                  Als Kunde ansehen
                </button>
              </form>
            </Card>
          ) : null}

          <Card title="Status">
            {org.id === admin.organizationId ? (
              <p className="text-sm text-gray-500">Eigene Organisation – nicht deaktivierbar.</p>
            ) : (
              <form action={setOrganizationActive}>
                <input type="hidden" name="id" value={org.id} />
                <input type="hidden" name="active" value={org.active ? "0" : "1"} />
                <button
                  type="submit"
                  className={org.active ? "text-sm text-red-600 hover:underline" : buttonClass}
                >
                  {org.active ? "Verwaltung deaktivieren (sperrt alle Nutzer)" : "Verwaltung reaktivieren"}
                </button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
