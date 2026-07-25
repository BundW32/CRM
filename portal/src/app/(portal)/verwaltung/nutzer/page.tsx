import type { Prisma } from "@/generated/prisma/client";
import { Alert, Card, PageTitle, Pagination } from "@/components/ui";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { isSelfManaged, propertyWhereForVerwalter, userWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, roleLabels, tradeLabels } from "@/lib/labels";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { NewUserForm } from "./new-user-form";
import { UserRow } from "./user-row";
import { PersonEinstellungen } from "./person-einstellungen";

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
    q?: string;
    rolle?: string;
    objekt?: string;
    page?: string;
  }>;
}) {
  const verwalter = await requireVerwalter();
  const selfManaged = isSelfManaged(await getOrganization());
  const { fehler, msg, eingeladen, q, rolle, objekt, page } =
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

  // Rolle als Auswahl-Filter. Verwalter/Handwerker sieht nur der SuperAdmin –
  // eingeschränkte Verwalter haben ohnehin nur Mieter/Eigentümer im Scope.
  const userFilters: FilterConfig[] = [
    {
      key: "rolle",
      label: "Rolle",
      allLabel: "Alle Rollen",
      primary: true,
      options: [
        { value: "MIETER", label: "Mieter" },
        { value: "EIGENTUEMER", label: "Eigentümer" },
        ...(verwalter.isSuperAdmin
          ? [
              { value: "VERWALTER", label: "Verwalter" },
              { value: "HANDWERKER", label: "Handwerker" },
            ]
          : []),
      ],
    },
  ];

  return (
    <>
      {/* Nicht mehr im Menü – Personen und Firmen stehen gemeinsam unter
          „Kontakte". Die Seite bleibt als Zugangs-Übersicht erreichbar. */}
      <PageTitle back={{ href: "/verwaltung/kontakte", label: "Kontakte" }}>
        Zugänge
      </PageTitle>

      {eingeladen ? (
        <Alert variant="success" className="mb-4">
          Einladungs-E-Mail wurde versandt (sofern SMTP konfiguriert ist).
        </Alert>
      ) : null}
      {/* Erfolgsmeldungen von DSGVO-Löschung und Stammdaten laufen jetzt über
          den ToastHost (`?flash=…`) – sie erreichen so auch den Rücksprung nach
          „Kontakte", wo bisher gar keine Rückmeldung ankam. Fehler bleiben als
          Banner stehen: Sie sollen nicht nach Sekunden verschwinden. */}
      {fehler ? (
        <Alert variant="error" className="mb-4">
          {errorMessages[fehler] ?? "Aktion fehlgeschlagen."}
          {msg ? <span className="mt-1 block text-xs text-red-500">Details: {msg}</span> : null}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FilterBar
            className="mb-3"
            searchPlaceholder="Suchen"
            searchHint="Nach Name oder E-Mail suchen"
            filters={userFilters}
            comboboxes={[
              {
                key: "objekt",
                label: "Objekt",
                placeholder: "Objekt wählen",
                options: properties.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel:
                    [p.street, [p.zip, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") ||
                    undefined,
                })),
                currentValue: objekt ?? undefined,
              },
            ]}
          />

          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs text-gray-400">
              {total} {total === 1 ? "Nutzer" : "Nutzer"}
              {hasFilter ? " (gefiltert)" : ""}
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
                    <PersonEinstellungen
                      zurueck="/verwaltung/nutzer"
                      u={u}
                      verwalter={verwalter}
                      properties={properties}
                      craftsmenForPicker={craftsmenForPicker}
                    />
                  </UserRow>
                );
              })}
            </ul>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={total}
            itemLabel="Nutzer"
            hrefFor={pageHref}
          />
        </div>

        <Card title="Neuen Nutzer anlegen">
          <NewUserForm
            properties={propsForNewUser}
            isSuperAdmin={verwalter.isSuperAdmin}
            selfManaged={selfManaged}
          />
        </Card>
      </div>
    </>
  );
}
