// Legt einen ersten Verwalter-Zugang und Demo-Daten an.
// Aufruf: npm run db:seed
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  // Mandant (Organisation) zuerst – alle Demo-Daten hängen an dieser Org.
  const org = await db.organization.upsert({
    where: { slug: "bw" },
    update: {},
    create: {
      slug: "bw",
      name: "B&W Immobilien",
      legalName: "B&W Immobilien Management UG (haftungsbeschränkt)",
      primaryColor: "#f69018",
      email: "info@bundwimmobilien.de",
      phone: "+49 151 29468127",
      website: "www.bundwimmobilien.de",
      street: "Goethestraße 42",
      zip: "45964",
      city: "Gladbeck",
    },
  });

  await db.user.upsert({
    where: { email: "admin@bundwimmobilien.de" },
    update: {},
    create: {
      email: "admin@bundwimmobilien.de",
      name: "B&W Verwaltung",
      role: "VERWALTER",
      isSuperAdmin: true,
      organizationId: org.id,
      passwordHash: await bcrypt.hash("BundW-Start2026!", 12),
    },
  });

  const property = await db.property.upsert({
    where: { immoware24Id: "demo-1" },
    update: {},
    create: {
      name: "Demo-Objekt Goethestraße 42",
      street: "Goethestraße 42",
      zip: "45964",
      city: "Gladbeck",
      immoware24Id: "demo-1",
      organizationId: org.id,
      units: {
        create: [
          { label: "WE 01, EG links", floor: "EG" },
          { label: "WE 02, 1. OG rechts", floor: "1. OG" },
        ],
      },
    },
    include: { units: true },
  });

  const eigentuemer = await db.user.upsert({
    where: { email: "eigentuemer@demo.de" },
    update: {},
    create: {
      email: "eigentuemer@demo.de",
      name: "Erika Eigentümerin",
      role: "EIGENTUEMER",
      organizationId: org.id,
      passwordHash: await bcrypt.hash("Demo-2026!", 12),
      ownerships: { create: { propertyId: property.id } },
    },
  });

  const unit = await db.unit.findFirst({ where: { propertyId: property.id } });
  const mieter = await db.user.upsert({
    where: { email: "mieter@demo.de" },
    update: {},
    create: {
      email: "mieter@demo.de",
      name: "Max Mieter",
      role: "MIETER",
      organizationId: org.id,
      passwordHash: await bcrypt.hash("Demo-2026!", 12),
      tenancies: { create: { unitId: unit!.id } },
    },
  });

  const handwerker = await db.user.upsert({
    where: { email: "handwerker@demo.de" },
    update: {},
    create: {
      email: "handwerker@demo.de",
      name: "Hans Handwerker",
      role: "HANDWERKER",
      organizationId: org.id,
      passwordHash: await bcrypt.hash("Demo-2026!", 12),
    },
  });

  console.log("Seed abgeschlossen:");
  console.log("  Verwalter:  admin@bundwimmobilien.de / BundW-Start2026!");
  console.log(`  Eigentümer: ${eigentuemer.email} / Demo-2026!`);
  console.log(`  Mieter:     ${mieter.email} / Demo-2026!`);
  console.log(`  Handwerker: ${handwerker.email} / Demo-2026!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
