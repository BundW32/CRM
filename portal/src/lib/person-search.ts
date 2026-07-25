// Vorhandene Personen für die Dubletten-Vorbeugung suchen.
//
// Der Hintergrund: Ohne E-Mail-Adresse legt `inviteOrLetter` immer ein neues
// Konto an – so bekam ein Mieter mit fünf Einheiten fünf getrennte Zugänge.
// Beide Anlege-Wege (neues Objekt, bestehendes Objekt bearbeiten) schlagen
// deshalb vorhandene Personen vor, bevor ein zweiter Zugang entsteht.
//
// Bewusst KEIN automatisches Zusammenführen anhand des Namens: Zwei
// verschiedene Menschen können gleich heißen. Der Hinweis nennt darum Objekt
// und Einheit zur Unterscheidung – entscheiden muss der Verwalter.
//
// Die Suche geht immer von `userWhereForVerwalter` aus und verengt nur. Ein
// eingeschränkter Verwalter sieht also ausschließlich Personen aus seinem
// Zuständigkeitsbereich.
import type { User } from "@/generated/prisma/client";
import { userWhereForVerwalter } from "./access";
import { db } from "./db";

export type PersonTreffer = { id: string; name: string; hint: string };

export async function searchPersons(
  actor: User,
  query: string,
  role: "MIETER" | "EIGENTUEMER",
): Promise<PersonTreffer[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const persons = await db.user.findMany({
    where: {
      AND: [
        { role },
        { active: true },
        { anonymizedAt: null },
        { name: { contains: q, mode: "insensitive" } },
        await userWhereForVerwalter(actor),
      ],
    },
    orderBy: { name: "asc" },
    take: 10,
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      tenancies: {
        where: { active: true },
        select: { unit: { select: { label: true, property: { select: { name: true } } } } },
      },
      ownerships: { select: { property: { select: { name: true } } } },
    },
  });
  return persons.map((p) => {
    const zuordnung =
      role === "MIETER"
        ? p.tenancies.map((t) => `${t.unit.property.name} · ${t.unit.label}`)
        : p.ownerships.map((o) => o.property.name);
    // Hinweis hilft beim Unterscheiden gleichnamiger Personen.
    const teile = [p.email ?? (p.username ? `Benutzer: ${p.username}` : null), ...zuordnung];
    return { id: p.id, name: p.name, hint: teile.filter(Boolean).join(" · ") || "ohne Zuordnung" };
  });
}

/**
 * Prüft eine im Formular gewählte Person, bevor sie verknüpft wird.
 *
 * Die ID kommt aus einem versteckten Feld und ist damit vom Browser
 * beeinflussbar – ohne diese Prüfung ließe sich eine fremde Person an ein
 * eigenes Objekt hängen. Ergebnis ist die ID nur dann, wenn die Person in der
 * Organisation des Verwalters liegt, aktiv ist, nicht DSGVO-anonymisiert wurde
 * und tatsächlich die erwartete Rolle hat.
 */
export async function verifyExistingPerson(
  actor: User,
  userId: string,
  role: "MIETER" | "EIGENTUEMER",
): Promise<string | null> {
  const id = userId.trim();
  if (!id) return null;
  const person = await db.user.findFirst({
    where: {
      id,
      role,
      active: true,
      anonymizedAt: null,
      organizationId: actor.organizationId,
    },
    select: { id: true },
  });
  return person?.id ?? null;
}
