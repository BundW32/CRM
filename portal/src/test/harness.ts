// Testharness für Prüfungen gegen eine ECHTE Datenbank.
//
// Warum das sein muss: Die Zugriffskontrolle dieses Portals besteht aus
// Datenbankabfragen mit Organisations- und Objektfiltern. Ob ein Filter wirkt,
// lässt sich nicht am Quelltext ablesen — nur daran, was die Abfrage
// tatsächlich zurückgibt. Die bisherigen Prüfungen (`kontoauszug-zugriff`,
// `versammlungsbeschluss`) lesen die Seitendatei als Text und suchen nach
// Bezeichnern. Das hält fest, dass die Sperre dasteht; es prüft nicht, dass sie
// hält. Eine umbenannte Variable bricht sie ohne Sicherheitsänderung, eine
// falsch umgebaute Prüfung mit gleichen Bezeichnern besteht sie.
//
// Diese Tests laufen deshalb bewusst NICHT in `npm run pruefung`: Der Befehl
// läuft auch im Vercel-Build, und dort gibt es keine Datenbank. Sie hängen an
// `npm run test:db` und brauchen eine gesetzte DATABASE_URL.
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL fehlt. Diese Tests brauchen eine echte Datenbank — " +
      "siehe portal/README.md, Abschnitt „Prüfungen mit Datenbank\".",
  );
}

export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Leert alle Tabellen bis auf die Migrationshistorie.
 *
 * `TRUNCATE … CASCADE` statt Löschen in Abhängigkeitsreihenfolge: Das Schema
 * hat über achtzig Modelle, und die Reihenfolge von Hand zu pflegen wäre eine
 * zweite Fehlerquelle, die mit jedem neuen Modell veraltet.
 */
export async function resetDatabase() {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

// Ein Passwort-Hash reicht für alle Testnutzer — bcrypt mit Kostenfaktor 12
// je Nutzer neu zu rechnen kostet pro Test mehrere Sekunden.
const TEST_HASH = bcrypt.hashSync("testpasswort-egal", 4);

type Rolle = "VERWALTER" | "EIGENTUEMER" | "MIETER";

/**
 * Eine vollständige Organisation mit Objekt, Einheit und je einem Nutzer pro
 * Rolle. Zwei davon nebeneinander sind die Grundaufstellung für jede Prüfung
 * der Mandantentrennung: Was A sieht, darf B nie sehen.
 */
export async function seedOrganization(kennung: string) {
  const org = await db.organization.create({
    data: { slug: `${kennung}-${Date.now()}`, name: `Org ${kennung}` },
  });

  const nutzer = async (rolle: Rolle, extra: Record<string, unknown> = {}) =>
    db.user.create({
      data: {
        organizationId: org.id,
        email: `${rolle.toLowerCase()}.${kennung}.${Date.now()}${Math.random()}@test.invalid`,
        name: `${rolle} ${kennung}`,
        passwordHash: TEST_HASH,
        role: rolle,
        ...extra,
      },
    });

  const verwalter = await nutzer("VERWALTER", { isSuperAdmin: true });
  const eigentuemer = await nutzer("EIGENTUEMER");
  const mieter = await nutzer("MIETER");

  const objekt = await db.property.create({
    data: {
      organizationId: org.id,
      name: `Objekt ${kennung}`,
      street: "Teststraße 1",
      zip: "12345",
      city: "Teststadt",
      managementType: "WEG",
    },
  });

  const einheit = await db.unit.create({
    data: { propertyId: objekt.id, label: "WE 1" },
  });

  await db.ownership.create({ data: { userId: eigentuemer.id, propertyId: objekt.id } });
  await db.unitOwnership.create({
    data: {
      userId: eigentuemer.id,
      unitId: einheit.id,
      organizationId: org.id,
      validFrom: new Date("2020-01-01"),
    },
  });
  await db.tenancy.create({ data: { userId: mieter.id, unitId: einheit.id } });

  return { org, verwalter, eigentuemer, mieter, objekt, einheit };
}

export type Fixture = Awaited<ReturnType<typeof seedOrganization>>;
