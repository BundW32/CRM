// Adressbuch: eine Ansicht über zwei Quellen.
//
// Menschen mit Portalzugang sind `User` (Mieter, Eigentümer, Verwalter), alle
// übrigen Kontakte sind Karteikarten (`Craftsman` – historischer Tabellenname,
// inhaltlich inzwischen „Firma/Dienstleister“). Die beiden Modelle zu
// verschmelzen wäre falsch: Karteikarten haben kein Konto, dafür Kategorie und
// Gewerk. Deshalb bleiben sie getrennt gespeichert und werden nur gemeinsam
// **angezeigt**.
//
// Die Zugriffsgrenzen kommen unverändert aus `lib/access.ts`; die Filter dürfen
// den Bereich immer nur verengen, nie erweitern.

import type { ContactKind, ContactMethod, Role, Trade, User } from "@/generated/prisma/client";
import { craftsmanWhereForVerwalter, userWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { hasCertMandate } from "@/lib/cert-mandate";

/** Ein Eintrag im Adressbuch – vereinheitlicht über beide Quellen. */
export type AddressBookEntry = {
  id: string;
  /** Unterscheidet die Herkunft: Person mit Zugang vs. Karteikarte. */
  source: "person" | "firma";
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  preferredContact: ContactMethod | null;
  /** Nur bei Personen: die Portalrolle. */
  role: Role | null;
  /** Nur bei Karteikarten. */
  kind: ContactKind | null;
  trade: Trade | null;
  notes: string | null;
  active: boolean;
  isInternal: boolean;
  accessToken: string | null;
  /** Bei Personen: gemietete Einheiten bzw. Eigentum – erklärt Mehrfacheinträge. */
  zuordnungen: string[];
  /**
   * Nur bei Eigentümern: Stand der Ermächtigung für Bescheinigungen.
   * `keine` blockiert die automatische Erstellung, `im_auftrag` lässt sie zu,
   * aber nur mit dem Zusatz „i. A.“ statt unter dem Namen des Eigentümers.
   */
  vollmacht: "keine" | "im_auftrag" | "eigenhaendig" | null;
};

/**
 * Werte des „Art“-Filters. Personenrollen und Kontaktarten stehen bewusst in
 * einer Liste – für den Suchenden ist beides schlicht „was für ein Kontakt“.
 */
export const ADDRESS_BOOK_KINDS = [
  "MIETER",
  "EIGENTUEMER",
  "VERWALTER",
  "HANDWERKER",
  "DIENSTLEISTER",
  "VERSORGER",
  "BEHOERDE",
  "SONSTIGES",
] as const;

export type AddressBookKind = (typeof ADDRESS_BOOK_KINDS)[number];

/**
 * Filter „Vollmacht“ – betrifft ausschließlich Eigentümer.
 *
 * Seit Bescheinigungen eine Ermächtigung voraussetzen (§ 19 Abs. 5 BMG), gibt es
 * einen Zustand, den man vorher nicht kannte: Ein Eigentümer blockiert die
 * automatische Wohnungsgeberbestätigung, ohne dass es jemandem auffällt – bis
 * der Mieter danach fragt. Der Filter macht diese Fälle auffindbar, statt sie
 * einzeln in den Personen zu suchen.
 *
 * `fehlt` meint: keine gültige Vollmacht. `ohne_unterschrift` meint: Vollmacht
 * liegt vor, aber keine eigenhändige Unterschrift – dort entstehen
 * Bescheinigungen nur mit dem Zusatz „i. A.“.
 */
export const MANDATE_FILTERS = ["fehlt", "ohne_unterschrift", "erteilt"] as const;
export type MandateFilter = (typeof MANDATE_FILTERS)[number];

export function parseMandate(raw: string | undefined): MandateFilter | undefined {
  return raw && (MANDATE_FILTERS as readonly string[]).includes(raw)
    ? (raw as MandateFilter)
    : undefined;
}

/**
 * Übersetzt den Filter in eine Bedingung auf `User`.
 *
 * Ein Widerruf zählt nur, wenn er NACH der Erteilung liegt – dieselbe Regel wie
 * in `hasCertMandate`. Sie steht hier ein zweites Mal, weil Prisma keine
 * Funktion aus TypeScript in die Abfrage übernehmen kann; ein Test hält beide
 * Fassungen zur Deckung.
 */
function mandateWhere(filter: MandateFilter) {
  const erteilt = {
    certMandateGrantedAt: { not: null },
    OR: [
      { certMandateRevokedAt: null },
      // `lte`, nicht `lt`: Fallen Widerruf und erneute Erteilung in dieselbe
      // Millisekunde, gilt die Erteilung – genau wie in `hasCertMandate`, das
      // den Widerruf nur bei `revoked > granted` greifen lässt. Mit `lt` wichen
      // Filter und Bescheinigung in diesem einen Fall voneinander ab.
      { certMandateRevokedAt: { lte: db.user.fields.certMandateGrantedAt } },
    ],
  };
  if (filter === "erteilt") return erteilt;
  if (filter === "ohne_unterschrift") return { AND: [erteilt, { signatureSelfSigned: false }] };
  return { NOT: erteilt };
}

const PERSON_ROLES: readonly string[] = ["MIETER", "EIGENTUEMER", "VERWALTER"];

export function parseKind(raw: string | undefined): AddressBookKind | undefined {
  return raw && (ADDRESS_BOOK_KINDS as readonly string[]).includes(raw)
    ? (raw as AddressBookKind)
    : undefined;
}

/**
 * Lädt das Adressbuch für einen Verwalter.
 *
 * Beide Quellen werden gefiltert abgefragt und danach im Speicher zusammengeführt,
 * sortiert und ausschnittweise ausgegeben. Eine echte Datenbank-Vereinigung wäre
 * über zwei Tabellen mit verschiedenen Feldern nur mit Roh-SQL zu haben – der
 * Aufwand lohnt erst, wenn Bestände in die Zehntausende gehen. Die Abfragen sind
 * gedeckelt, damit die Seite auch dann nicht umkippt.
 */
export async function loadAddressBook(
  verwalter: User,
  {
    q,
    kind,
    mandate,
    page,
    pageSize,
  }: {
    q?: string;
    kind?: AddressBookKind;
    mandate?: MandateFilter;
    page: number;
    pageSize: number;
  },
): Promise<{ entries: AddressBookEntry[]; total: number }> {
  const wantsPersons = !kind || PERSON_ROLES.includes(kind);
  // Der Vollmacht-Filter betrifft nur Eigentümer – Karteikarten und andere
  // Rollen fallen dann komplett heraus, statt unverändert stehen zu bleiben.
  const wantsFirmen = !mandate && (!kind || !PERSON_ROLES.includes(kind));

  // Obergrenze je Quelle: schützt vor Ausreißern, ohne die Suche zu beschneiden
  // (wer so viele Treffer hat, sucht ohnehin gezielter weiter).
  const FETCH_LIMIT = 500;

  const [persons, firmen] = await Promise.all([
    wantsPersons
      ? db.user.findMany({
          where: {
            AND: [
              {
                role: {
                  in: mandate
                    ? // Vollmacht gibt es nur bei Eigentümern – der Filter
                      // verengt die Rollenauswahl entsprechend.
                      (["EIGENTUEMER"] as Role[])
                    : kind
                      ? [kind as Role]
                      : ["MIETER", "EIGENTUEMER", "VERWALTER"],
                },
              },
              ...(mandate ? [mandateWhere(mandate)] : []),
              // DSGVO-anonymisierte Datensätze gehören nicht ins Adressbuch.
              { anonymizedAt: null },
              ...(q
                ? [
                    {
                      OR: [
                        { name: { contains: q, mode: "insensitive" as const } },
                        { email: { contains: q, mode: "insensitive" as const } },
                        { phone: { contains: q, mode: "insensitive" as const } },
                      ],
                    },
                  ]
                : []),
              await userWhereForVerwalter(verwalter),
            ],
          },
          orderBy: { name: "asc" },
          take: FETCH_LIMIT,
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            phone: true,
            preferredContact: true,
            active: true,
            // Zuordnungen für die Anzeige – macht sichtbar, weshalb dieselbe
            // Person mehrfach auftauchen kann (je Einheit ein eigener Zugang).
            tenancies: {
              where: { active: true },
              select: { unit: { select: { label: true, property: { select: { name: true } } } } },
            },
            ownerships: { select: { property: { select: { name: true } } } },
            certMandateGrantedAt: true,
            certMandateRevokedAt: true,
            signatureSelfSigned: true,
          },
        })
      : Promise.resolve([]),
    wantsFirmen
      ? db.craftsman.findMany({
          where: {
            AND: [
              ...(kind ? [{ kind: kind as ContactKind }] : []),
              ...(q
                ? [
                    {
                      OR: [
                        { name: { contains: q, mode: "insensitive" as const } },
                        { company: { contains: q, mode: "insensitive" as const } },
                        { email: { contains: q, mode: "insensitive" as const } },
                        { phone: { contains: q, mode: "insensitive" as const } },
                      ],
                    },
                  ]
                : []),
              await craftsmanWhereForVerwalter(verwalter),
            ],
          },
          orderBy: { name: "asc" },
          take: FETCH_LIMIT,
        })
      : Promise.resolve([]),
  ]);

  const entries: AddressBookEntry[] = [
    ...persons.map((p) => ({
      id: p.id,
      source: "person" as const,
      name: p.name,
      company: null,
      email: p.email,
      phone: p.phone,
      preferredContact: p.preferredContact,
      role: p.role,
      kind: null,
      trade: null,
      notes: null,
      active: p.active,
      isInternal: false,
      accessToken: null,
      // Vollmacht nur für Eigentümer – bei allen anderen Rollen wäre die
      // Angabe sinnlos und in der Liste nur Rauschen.
      vollmacht:
        p.role === "EIGENTUEMER"
          ? hasCertMandate(p)
            ? p.signatureSelfSigned
              ? ("eigenhaendig" as const)
              : ("im_auftrag" as const)
            : ("keine" as const)
          : null,
      zuordnungen: [
        ...p.tenancies.map((t) => `${t.unit.property.name} · ${t.unit.label}`),
        ...p.ownerships.map((o) => o.property.name),
      ],
    })),
    ...firmen.map((c) => ({
      id: c.id,
      source: "firma" as const,
      name: c.name,
      company: c.company,
      email: c.email,
      phone: c.phone,
      preferredContact: c.preferredContact,
      role: null,
      kind: c.kind,
      trade: c.trade,
      notes: c.notes,
      active: c.active,
      isInternal: c.isInternal,
      accessToken: c.accessToken,
      vollmacht: null,
      zuordnungen: [],
    })),
  ];

  // Inaktive nach hinten, sonst alphabetisch – wie man ein Adressbuch erwartet.
  entries.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (a.company ?? a.name).localeCompare(b.company ?? b.name, "de");
  });

  const start = (page - 1) * pageSize;
  return { entries: entries.slice(start, start + pageSize), total: entries.length };
}
