// Datensuche der ⌘K-Palette.
//
// Bewusst nur für Verwalter. Das Adressbuch enthält die Telefonnummern aller
// Mieter – eine Suchfläche, die versehentlich zu viel findet, wäre genau das
// Datenschutzleck, das die Rollen-Gegenprobe des Menü-Umbaus verhindern soll.
// Mieter und Eigentümer bekommen die Palette trotzdem, aber nur als Sprungliste
// über ihre eigenen Menüpunkte.
//
// Jede Abfrage geht von den `…WhereForVerwalter`-Grenzen aus `lib/access.ts`
// aus und verengt sie nur um den Suchbegriff. Ein eingeschränkter Verwalter
// findet also nichts außerhalb seines Zuständigkeitsbereichs.

import type { User } from "@/generated/prisma/client";
import {
  craftsmanWhereForVerwalter,
  propertyWhereForVerwalter,
  ticketWhereForUser,
  userWhereForVerwalter,
} from "./access";
import { db } from "./db";
import { contactKindLabels, roleLabels, ticketStatusLabels } from "./labels";
import { MIN_QUERY_LENGTH, type SearchHit } from "./portal-search";

/** Je Gruppe – die Palette soll eine Auswahl zeigen, keine Liste zum Blättern. */
const PER_GROUP = 5;

export async function searchPortal(actor: User, query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];
  if (actor.role !== "VERWALTER") return [];

  const contains = { contains: q, mode: "insensitive" } as const;

  const [properties, persons, companies, tickets] = await Promise.all([
    db.property.findMany({
      where: {
        AND: [
          await propertyWhereForVerwalter(actor),
          { OR: [{ name: contains }, { street: contains }, { city: contains }] },
        ],
      },
      orderBy: { name: "asc" },
      take: PER_GROUP,
      select: { id: true, name: true, street: true, zip: true, city: true },
    }),
    db.user.findMany({
      where: {
        AND: [
          await userWhereForVerwalter(actor),
          { active: true },
          { OR: [{ name: contains }, { email: contains }, { phone: contains }] },
        ],
      },
      orderBy: { name: "asc" },
      take: PER_GROUP,
      select: { id: true, name: true, role: true, email: true },
    }),
    db.craftsman.findMany({
      where: {
        AND: [
          await craftsmanWhereForVerwalter(actor),
          { active: true },
          {
            OR: [
              { name: contains },
              { company: contains },
              { email: contains },
              { phone: contains },
            ],
          },
        ],
      },
      orderBy: { name: "asc" },
      take: PER_GROUP,
      select: { id: true, name: true, company: true, kind: true },
    }),
    db.ticket.findMany({
      where: {
        AND: [
          await ticketWhereForUser(actor),
          { OR: [{ title: contains }, { description: contains }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: PER_GROUP,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        property: { select: { name: true } },
        unit: { select: { label: true, property: { select: { name: true } } } },
      },
    }),
  ]);

  return [
    ...properties.map((p) => ({
      id: `objekt-${p.id}`,
      group: "Objekte" as const,
      title: p.name,
      subtitle: `${p.street}, ${p.zip} ${p.city}`,
      href: `/verwaltung/objekte/${p.id}`,
    })),
    ...persons.map((p) => ({
      id: `person-${p.id}`,
      group: "Kontakte" as const,
      title: p.name,
      subtitle: [roleLabels[p.role], p.email].filter(Boolean).join(" · "),
      href: `/verwaltung/kontakte/${p.id}`,
    })),
    ...companies.map((c) => ({
      id: `firma-${c.id}`,
      group: "Kontakte" as const,
      title: c.company ? `${c.company} · ${c.name}` : c.name,
      subtitle: contactKindLabels[c.kind],
      href: `/verwaltung/kontakte/${c.id}`,
    })),
    ...tickets.map((t) => ({
      id: `vorgang-${t.id}`,
      group: "Vorgänge" as const,
      title: `#${t.number} ${t.title}`,
      subtitle: [
        ticketStatusLabels[t.status],
        t.unit
          ? `${t.unit.property.name} · ${t.unit.label}`
          : (t.property?.name ?? null),
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/vorgaenge/${t.id}`,
    })),
  ];
}
