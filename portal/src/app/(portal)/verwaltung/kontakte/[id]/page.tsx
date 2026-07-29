import { notFound, redirect } from "next/navigation";
import { Building2, UserRound } from "lucide-react";
import { Alert, Card, PageTitle } from "@/components/ui";
import {
  canVerwalterManageUser,
  canVerwalterUseCraftsman,
  propertyWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import { contactKindLabels, roleLabels, tradeLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import {
  PersonEinstellungen,
  loadPerson,
} from "../../nutzer/person-einstellungen";
import { KarteikarteFormular } from "./KarteikarteFormular";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const verwalter = await requireVerwalter();
  const { id } = await params;
  const { fehler } = await searchParams;

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
              zurueck={`/verwaltung/kontakte/${person.id}`}
              name={person.name}
              email={person.email}
              phone={person.phone}
              preferredContact={person.preferredContact}
            />
          </Card>

          <PersonEinstellungen
            zurueck={`/verwaltung/kontakte/${person.id}`}
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

        {/* Fehler bleiben als Banner am Formular stehen (kein Toast) — sonst
            verschwände die Meldung, bevor jemand sie gelesen hat. Ohne dieses
            Banner liefe der Rücksprung mit `?fehler=…` ins Leere: Die Aktion
            kehrt hierher zurück, nicht in die Liste. */}
        {fehler ? (
          <Alert variant="error" className="mb-4">
            {fehler === "bescheinigung"
              ? "Die Freistellungsbescheinigung konnte nicht gespeichert werden (erlaubt: Foto oder PDF). Nummer und Gültigkeitsdatum wurden ebenfalls nicht übernommen — bitte erneut speichern."
              : fehler === "email"
                ? "Diese E-Mail-Adresse wird bereits von einer anderen Person verwendet."
                : "Bitte Pflichtfelder (Name, Art) korrekt ausfüllen."}
          </Alert>
        ) : null}

        <Card title="Kontaktdaten">
          <KarteikarteFormular
            zurueck={`/verwaltung/kontakte/${kontakt.id}`}
            k={{
              id: kontakt.id,
              name: kontakt.name,
              company: kontakt.company,
              kind: kontakt.kind,
              trade: kontakt.trade,
              email: kontakt.email,
              phone: kontakt.phone,
              preferredContact: kontakt.preferredContact,
              notes: kontakt.notes,
              exemptionNumber: kontakt.exemptionNumber,
              exemptionValidUntil: kontakt.exemptionValidUntil?.toISOString() ?? null,
              exemptionFileName: kontakt.exemptionFileName,
              active: kontakt.active,
              isInternal: kontakt.isInternal,
            }}
          />
          {kontakt.accessToken ? (
            <p className="mt-4 border-t border-gray-100 pt-3 text-xs">
              <a
                href={`/auftraege/${kontakt.accessToken}`}
                target="_blank"
                rel="noreferrer"
                className="text-brand-green hover:underline"
              >
                Auftragsportal-Link öffnen ↗
              </a>
            </p>
          ) : null}
        </Card>
      </>
    );
  }

  // Weder Person noch Karteikarte im Zuständigkeitsbereich.
  redirect("/verwaltung/kontakte");
}
