import { notFound, redirect } from "next/navigation";
import { Building2, UserRound } from "lucide-react";
import { Card, PageTitle } from "@/components/ui";
import {
  canVerwalterManageUser,
  canVerwalterUseCraftsman,
  propertyWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import { contactKindLabels, contactMethodLabels, roleLabels, tradeLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import {
  PersonEinstellungen,
  loadPerson,
} from "../../nutzer/person-einstellungen";
import { KontaktStammdaten } from "./KontaktStammdaten";

export const dynamic = "force-dynamic";

/**
 * Detailseite eines Kontakts. Hinter jedem Eintrag im Adressbuch liegt hier alles,
 * was zu ihm gehört – bei Personen inklusive Zugang, Mietverhältnissen, Eigentum
 * und Objektzuweisung, damit man dafür nicht in einen zweiten Bereich wechseln muss.
 *
 * Die Kennung kann eine Person (`User`) oder eine Karteikarte (`Craftsman`) sein;
 * beide Tabellen nutzen kollisionsfreie IDs, daher wird der Reihe nach gesucht.
 */
export default async function KontaktDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { id } = await params;

  // ── Person? ───────────────────────────────────────────────────────────────
  // Zuerst die Berechtigung prüfen, dann laden – nie umgekehrt.
  if (await canVerwalterManageUser(verwalter, id)) {
    const person = await loadPerson(id);
    if (!person) notFound();
    // Anonymisierte Datensätze sind aus dem Adressbuch verschwunden; ein
    // Direktaufruf soll sie ebenfalls nicht wieder sichtbar machen.
    if (person.anonymizedAt) notFound();

    const [properties, craftsmen] = await Promise.all([
      db.property.findMany({
        where: await propertyWhereForVerwalter(verwalter),
        select: { id: true, name: true, street: true, zip: true, city: true },
        orderBy: { name: "asc" },
      }),
      verwalter.isSuperAdmin
        ? db.craftsman.findMany({
            where: { active: true, organizationId: verwalter.organizationId },
            orderBy: [{ trade: "asc" }, { name: "asc" }],
          })
        : Promise.resolve([]),
    ]);

    return (
      <>
        <PageTitle back={{ href: "/verwaltung/kontakte", label: "Kontakte" }}>
          {person.salutation ? `${person.salutation} ` : ""}
          {person.name}
        </PageTitle>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-brand-orange-light px-2.5 py-1 text-xs font-medium text-brand-orange-dark">
            <UserRound className="h-3.5 w-3.5" />
            {roleLabels[person.role]}
          </span>
          {!person.active ? (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
              deaktiviert
            </span>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card title="Kontaktdaten">
            <KontaktStammdaten
              id={person.id}
              name={person.name}
              email={person.email}
              phone={person.phone}
              preferredContact={person.preferredContact}
            />
          </Card>

          <PersonEinstellungen
            u={person}
            verwalter={verwalter}
            properties={properties}
            craftsmenForPicker={craftsmen.map((c) => ({
              id: c.id,
              name: c.name,
              company: c.company,
              tradeLabel: tradeLabels[c.trade],
            }))}
          />
        </div>
      </>
    );
  }

  // ── Karteikarte? ──────────────────────────────────────────────────────────
  if (await canVerwalterUseCraftsman(verwalter, id)) {
    const kontakt = await db.craftsman.findUnique({ where: { id } });
    if (!kontakt) notFound();

    return (
      <>
        <PageTitle back={{ href: "/verwaltung/kontakte", label: "Kontakte" }}>
          {kontakt.company ? `${kontakt.company} · ${kontakt.name}` : kontakt.name}
        </PageTitle>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            <Building2 className="h-3.5 w-3.5" />
            {contactKindLabels[kontakt.kind]}
          </span>
          {kontakt.kind === "HANDWERKER" ? (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
              {tradeLabels[kontakt.trade]}
            </span>
          ) : null}
          {kontakt.isInternal ? (
            <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-xs font-semibold text-brand-green">
              intern · Eigenleistung
            </span>
          ) : null}
          {!kontakt.active ? (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
              inaktiv
            </span>
          ) : null}
        </div>

        <Card title="Kontaktdaten">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">Telefon</dt>
              <dd className="text-gray-900">
                {kontakt.phone ? (
                  <a href={`tel:${kontakt.phone}`} className="hover:text-brand-orange hover:underline">
                    {kontakt.phone}
                  </a>
                ) : (
                  <span className="text-gray-400">–</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">E-Mail</dt>
              <dd className="text-gray-900">
                {kontakt.email ? (
                  <a
                    href={`mailto:${kontakt.email}`}
                    className="hover:text-brand-orange hover:underline"
                  >
                    {kontakt.email}
                  </a>
                ) : (
                  <span className="text-gray-400">–</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Bevorzugter Kontaktweg</dt>
              <dd className="text-gray-900">{contactMethodLabels[kontakt.preferredContact]}</dd>
            </div>
            {kontakt.accessToken ? (
              <div>
                <dt className="text-xs text-gray-500">Auftragsportal</dt>
                <dd>
                  <a
                    href={`/auftraege/${kontakt.accessToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-green hover:underline"
                  >
                    Link öffnen ↗
                  </a>
                </dd>
              </div>
            ) : null}
            {kontakt.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">Notizen</dt>
                <dd className="whitespace-pre-line text-gray-700">{kontakt.notes}</dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-4 text-xs text-gray-400">
            Zum Bearbeiten die Zeile im Adressbuch aufklappen.
          </p>
        </Card>
      </>
    );
  }

  // Weder Person noch Karteikarte im Zuständigkeitsbereich.
  redirect("/verwaltung/kontakte");
}
