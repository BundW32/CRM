// Legt einen ersten Verwalter-Zugang und Demo-Daten an.
// Aufruf: npm run db:seed
import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { WEG_COST_CATALOG } from "../src/lib/weg/cost-catalog";
import { WEG_COMPLIANCE_CATALOG } from "../src/lib/weg/compliance-catalog";
import { addMonths } from "../src/lib/weg/compliance";
import {
  computeUnitAdvances,
  fiscalYearMonths,
  monthlyInstallments,
} from "../src/lib/weg/economic-plan";

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
      // Plattform-Betreiber-Zugang (/plattform) wird über die Env-Variable
      // PLATFORM_ADMIN_EMAILS gesteuert (diese E-Mail muss dort stehen). Das Flag
      // ist nur noch informativ und für das Gating nicht mehr erforderlich.
      isPlatformAdmin: true,
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

  // ── Demo-WEG „Musterstraße 12" (Selbstverwaltung, Finanz-Fundament) ────────
  // 6 Einheiten mit MEA/Fläche/Personen, Giro + Rücklage mit Anfangsbeständen,
  // Kostenarten aus dem Standardkatalog, Beispielbuchungen inkl. einer
  // Umbuchung in die Erhaltungsrücklage.
  const weg = await db.property.upsert({
    where: { immoware24Id: "demo-weg-1" },
    update: {},
    create: {
      name: "WEG Musterstraße 12",
      street: "Musterstraße 12",
      zip: "45964",
      city: "Gladbeck",
      immoware24Id: "demo-weg-1",
      organizationId: org.id,
      managementType: "WEG",
      meaTotal: 1000,
      fiscalYearStartMonth: 1,
      units: {
        create: [
          { label: "WE 01, EG links", floor: "EG", unitType: "WOHNUNG", mea: 180, livingArea: 72.5, personCount: 2, orderIndex: 1 },
          { label: "WE 02, EG rechts", floor: "EG", unitType: "WOHNUNG", mea: 175, livingArea: 70.2, personCount: 1, orderIndex: 2 },
          { label: "WE 03, 1. OG links", floor: "1. OG", unitType: "WOHNUNG", mea: 180, livingArea: 72.5, personCount: 3, orderIndex: 3 },
          { label: "WE 04, 1. OG rechts", floor: "1. OG", unitType: "WOHNUNG", mea: 175, livingArea: 70.2, personCount: 2, orderIndex: 4 },
          { label: "WE 05, DG", floor: "DG", unitType: "WOHNUNG", mea: 240, livingArea: 96.4, personCount: 4, orderIndex: 5 },
          { label: "TE 06, Stellplatz", floor: "Außen", unitType: "STELLPLATZ", mea: 50, livingArea: null, personCount: null, orderIndex: 6 },
        ],
      },
    },
  });

  // Kostenarten aus dem Standardkatalog (idempotent: nur wenn noch keine da sind)
  const existingCostTypes = await db.costType.count({ where: { propertyId: weg.id } });
  if (existingCostTypes === 0) {
    await db.costType.createMany({
      data: WEG_COST_CATALOG.map((e, i) => ({
        organizationId: org.id,
        propertyId: weg.id,
        name: e.name,
        category: e.category,
        distributionKey: e.distributionKey,
        laborShareType: e.laborShareType,
        recoverableBetrKV: e.recoverableBetrKV,
        orderIndex: i,
      })),
    });
  }

  // Konten + Buchungen (idempotent über vorhandene Konten)
  const existingAccounts = await db.ledgerAccount.count({ where: { propertyId: weg.id } });
  if (existingAccounts === 0) {
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@bundwimmobilien.de" } });
    const giro = await db.ledgerAccount.create({
      data: {
        organizationId: org.id,
        propertyId: weg.id,
        name: "Girokonto WEG",
        kind: "GIRO",
        iban: "DE02120300000000202051",
        openingBalanceCents: 412_350, // 4.123,50 €
        openingBalanceDate: new Date(Date.UTC(2026, 0, 1)),
      },
    });
    const ruecklage = await db.ledgerAccount.create({
      data: {
        organizationId: org.id,
        propertyId: weg.id,
        name: "Erhaltungsrücklage (Tagesgeld)",
        kind: "RUECKLAGE",
        openingBalanceCents: 1_875_000, // 18.750,00 €
        openingBalanceDate: new Date(Date.UTC(2026, 0, 1)),
      },
    });

    const hausmeister = await db.costType.findFirst({ where: { propertyId: weg.id, name: "Hausmeister" } });
    const versicherung = await db.costType.findFirst({ where: { propertyId: weg.id, name: "Gebäudeversicherung" } });
    await db.booking.createMany({
      data: [
        {
          organizationId: org.id, propertyId: weg.id, accountId: giro.id, createdById: admin.id,
          kind: "EINNAHME", bookingDate: new Date(Date.UTC(2026, 0, 5)), amountCents: 145_000,
          text: "Hausgeld Januar (alle Einheiten)", counterparty: "Eigentümer",
        },
        {
          organizationId: org.id, propertyId: weg.id, accountId: giro.id, createdById: admin.id,
          kind: "AUSGABE", bookingDate: new Date(Date.UTC(2026, 0, 12)), amountCents: 38_500,
          text: "Hausmeister Januar", counterparty: "Hausmeisterservice Ruhr",
          costTypeId: hausmeister?.id ?? null,
        },
        {
          organizationId: org.id, propertyId: weg.id, accountId: giro.id, createdById: admin.id,
          kind: "AUSGABE", bookingDate: new Date(Date.UTC(2026, 1, 1)), amountCents: 96_200,
          text: "Gebäudeversicherung Jahresbeitrag", counterparty: "Versicherung AG",
          costTypeId: versicherung?.id ?? null,
        },
      ],
    });
    // Umbuchung Giro → Rücklage (Gegenbuchungspaar)
    const transferGroupId = crypto.randomUUID();
    const transferCommon = {
      organizationId: org.id, propertyId: weg.id, createdById: admin.id,
      kind: "UMBUCHUNG" as const, bookingDate: new Date(Date.UTC(2026, 1, 15)),
      amountCents: 50_000, text: "Zuführung Erhaltungsrücklage Februar", transferGroupId,
    };
    await db.booking.createMany({
      data: [
        { ...transferCommon, accountId: giro.id, transferOut: true },
        { ...transferCommon, accountId: ruecklage.id, transferOut: false },
      ],
    });
  }

  // Beschlossener Wirtschaftsplan 2026 mit Sollstellungen + Zahlungs-Demo
  const existingPlans = await db.economicPlan.count({ where: { propertyId: weg.id } });
  if (existingPlans === 0) {
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@bundwimmobilien.de" } });
    const costTypes = await db.costType.findMany({ where: { propertyId: weg.id } });
    const byName = (name: string) => costTypes.find((c) => c.name === name);
    // Jahres-Planwerte (Cent) für ein realistisches kleines Objekt
    const planValues: [string, number][] = [
      ["Hausmeister", 480_000],
      ["Gebäudeversicherung", 96_000],
      ["Allgemeinstrom", 72_000],
      ["Treppenhausreinigung", 144_000],
      ["Müllabfuhr", 108_000],
      ["Zuführung Erhaltungsrücklage", 600_000],
    ];
    const items = planValues
      .map(([name, amountCents]) => ({ costType: byName(name), amountCents }))
      .filter((i) => i.costType);

    const plan = await db.economicPlan.create({
      data: {
        organizationId: org.id,
        propertyId: weg.id,
        year: 2026,
        status: "BESCHLOSSEN",
        resolvedAt: new Date(Date.UTC(2025, 11, 10)),
        resolutionNote: "ETV 10.12.2025, TOP 3",
        createdById: admin.id,
        items: {
          create: items.map((i) => ({
            costTypeId: i.costType!.id,
            amountCents: i.amountCents,
            previousActualCents: Math.round(i.amountCents * 0.95),
          })),
        },
      },
    });

    const units = await db.unit.findMany({
      where: { propertyId: weg.id },
      select: { id: true, label: true, mea: true, livingArea: true, personCount: true },
      orderBy: { orderIndex: "asc" },
    });
    const advances = computeUnitAdvances(
      items.map((i) => ({
        costTypeId: i.costType!.id,
        distributionKey: i.costType!.distributionKey,
        amountCents: i.amountCents,
      })),
      units,
    );
    const months = fiscalYearMonths(2026, 1);
    await db.duePosting.createMany({
      data: units.flatMap((u) => {
        const rates = monthlyInstallments(advances.perUnit.get(u.id) ?? 0);
        return months.map((m, i) => ({
          organizationId: org.id,
          propertyId: weg.id,
          unitId: u.id,
          planId: plan.id,
          dueDate: new Date(Date.UTC(m.year, m.month - 1, 1)),
          periodYear: m.year,
          periodMonth: m.month,
          amountCents: rates[i],
          source: "WIRTSCHAFTSPLAN",
        }));
      }),
    });

    // Zahlungseingänge: einer bereits zugeordnet, einer mit Vorschlag (per Text)
    const giroAcc = await db.ledgerAccount.findFirstOrThrow({
      where: { propertyId: weg.id, kind: "GIRO" },
    });
    const we1 = units.find((u) => u.label.startsWith("WE 01"));
    const we1Monthly = monthlyInstallments(advances.perUnit.get(we1!.id) ?? 0)[0];
    await db.booking.createMany({
      data: [
        {
          organizationId: org.id, propertyId: weg.id, accountId: giroAcc.id, createdById: admin.id,
          kind: "EINNAHME", bookingDate: new Date(Date.UTC(2026, 0, 3)), amountCents: we1Monthly,
          text: "Hausgeld Januar", counterparty: "Erika Eigentümerin", unitId: we1!.id,
        },
        {
          organizationId: org.id, propertyId: weg.id, accountId: giroAcc.id, createdById: admin.id,
          kind: "EINNAHME", bookingDate: new Date(Date.UTC(2026, 1, 3)), amountCents: we1Monthly,
          text: "Hausgeld Februar WE 01", counterparty: "Erika Eigentümerin",
        },
      ],
    });
  }

  // Eigentümerschaft je Einheit inkl. Eigentümerwechsel zum 01.07.2026 (WE 03)
  const existingUnitOwnerships = await db.unitOwnership.count({
    where: { unit: { propertyId: weg.id } },
  });
  if (existingUnitOwnerships === 0) {
    const kaeufer = await db.user.upsert({
      where: { email: "kaeufer@demo.de" },
      update: {},
      create: {
        email: "kaeufer@demo.de",
        name: "Klaus Käufer",
        role: "EIGENTUEMER",
        organizationId: org.id,
        passwordHash: await bcrypt.hash("Demo-2026!", 12),
        ownerships: { create: { propertyId: weg.id } },
      },
    });
    const erika = await db.user.findUniqueOrThrow({ where: { email: "eigentuemer@demo.de" } });
    const wegUnits = await db.unit.findMany({
      where: { propertyId: weg.id },
      select: { id: true, label: true },
      orderBy: { orderIndex: "asc" },
    });
    const since2020 = new Date(Date.UTC(2020, 0, 1));
    const wechsel = new Date(Date.UTC(2026, 6, 1)); // 01.07.2026
    await db.unitOwnership.createMany({
      data: wegUnits.flatMap((u) =>
        u.label.startsWith("WE 03")
          ? [
              // Eigentümerwechsel zum 01.07.: Erika verkauft an Klaus
              { organizationId: org.id, unitId: u.id, userId: erika.id, validFrom: since2020, validTo: wechsel },
              { organizationId: org.id, unitId: u.id, userId: kaeufer.id, validFrom: wechsel },
            ]
          : [{ organizationId: org.id, unitId: u.id, userId: erika.id, validFrom: since2020 }],
      ),
    });
    // Objektweite Eigentümerschaft (Stimmrecht/MEA, Belegeinsicht) – konsistent
    // zum Objekt-Anlegen-Flow, der beides erzeugt. Erika ist Mehrheitseigentümerin.
    await db.ownership.upsert({
      where: { userId_propertyId: { userId: erika.id, propertyId: weg.id } },
      update: {},
      create: { userId: erika.id, propertyId: weg.id },
    });

    // Stimmgewichte aus den Einheiten-MEA ableiten (wie lib/weg/mea-sync.ts):
    // Erika hält WE01/02/04/05 + TE06 (820 MEA, 5 Einheiten), Klaus WE03 (180, 1).
    const now = new Date();
    const holdings = await db.unitOwnership.findMany({
      where: {
        unit: { propertyId: weg.id },
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: { userId: true, sharePercent: true, unit: { select: { mea: true } } },
    });
    const agg = new Map<string, { count: number; mea: number }>();
    for (const h of holdings) {
      const e = agg.get(h.userId) ?? { count: 0, mea: 0 };
      e.count += 1;
      e.mea += Math.round(((h.unit.mea ?? 0) * h.sharePercent) / 100);
      agg.set(h.userId, e);
    }
    for (const [userId, a] of agg) {
      await db.ownership.updateMany({
        where: { userId, propertyId: weg.id },
        data: { mea: a.mea, voteUnits: a.count },
      });
    }
  }

  // Prüfpflichten-Katalog für die Demo-WEG übernehmen (idempotent über catalogKey).
  // Zwei Fälligkeiten werden bewusst in die Vergangenheit/nahe Zukunft gelegt,
  // damit das Dashboard „fällige/überfällige Prüfpflichten" demonstriert.
  {
    const existing = await db.maintenanceTask.findMany({
      where: { propertyId: weg.id, catalogKey: { not: null } },
      select: { catalogKey: true },
    });
    const have = new Set(existing.map((t) => t.catalogKey));
    const now = new Date();
    const overrides: Record<string, Date> = {
      // überfällig
      RAUCHWARNMELDER: addMonths(now, -1),
      // in den nächsten Tagen fällig
      VERSAMMLUNG_PLANEN: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
    };
    const toCreate = WEG_COMPLIANCE_CATALOG.filter((d) => !have.has(d.key));
    if (toCreate.length > 0) {
      await db.maintenanceTask.createMany({
        data: toCreate.map((d) => ({
          organizationId: org.id,
          propertyId: weg.id,
          title: d.title,
          description: d.description,
          interval: d.interval,
          dueDate: overrides[d.key] ?? addMonths(now, d.initialDueMonths),
          catalogKey: d.key,
        })),
      });
    }
  }

  // Demo-Eigentümerversammlung mit Tagesordnung (Einladungs-Assistent). Termin
  // bewusst knapp (< 3 Wochen), damit der Fristenrechner die Warnung zeigt.
  {
    const existing = await db.ownersMeeting.findFirst({
      where: { propertyId: weg.id },
      select: { id: true },
    });
    if (!existing) {
      const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@bundwimmobilien.de" } });
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 12);
      scheduledAt.setHours(18, 30, 0, 0);
      await db.ownersMeeting.create({
        data: {
          organizationId: org.id,
          propertyId: weg.id,
          title: "Ordentliche Eigentümerversammlung 2026",
          scheduledAt,
          location: "Gemeindesaal, Musterstraße 1, 45964 Gladbeck",
          videoLink: "https://meet.example.org/weg-musterstrasse-12",
          createdById: admin.id,
          agendaItems: {
            create: [
              { sortOrder: 0, title: "Begrüßung und Feststellung der Beschlussfähigkeit", type: "INFO" },
              { sortOrder: 1, title: "Beschluss über die Jahresabrechnung (Abrechnungsspitze)", description: "Die Eigentümer beschließen die Einforderung der Nachschüsse aus der vorgelegten Jahresabrechnung (§ 28 Abs. 2 WEG).", type: "INFO" },
              { sortOrder: 2, title: "Verschiedenes", type: "INFO" },
            ],
          },
        },
      });
    }
  }

  // Demo-Erhaltungsmaßnahmen (Erhaltungsplanung). Bewusst so dimensioniert, dass
  // der geplante Bedarf den Rücklagenstand übersteigt (Unterdeckung sichtbar).
  {
    const existing = await db.maintenanceMeasure.count({ where: { propertyId: weg.id } });
    if (existing === 0) {
      const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@bundwimmobilien.de" } });
      const y = new Date().getFullYear();
      await db.maintenanceMeasure.createMany({
        data: [
          { organizationId: org.id, propertyId: weg.id, title: "Fassadenanstrich", trade: "Fassade", targetYear: y + 1, estimatedCents: 1_800_000, createdById: admin.id },
          { organizationId: org.id, propertyId: weg.id, title: "Dachrinnen erneuern", trade: "Dach", targetYear: y + 2, estimatedCents: 650_000, createdById: admin.id },
          { organizationId: org.id, propertyId: weg.id, title: "Heizungsanlage austauschen", trade: "Heizung", targetYear: y + 4, estimatedCents: 3_200_000, createdById: admin.id },
        ],
      });
    }
  }

  // Demo-Zähler (fernablesbar) mit monatlichen Ständen über gut ein Jahr, damit
  // die unterjährige Verbrauchsinformation Vorperioden- und Vorjahresvergleich zeigt.
  {
    const existing = await db.meter.findFirst({ where: { propertyId: weg.id }, select: { id: true } });
    if (!existing) {
      const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@bundwimmobilien.de" } });
      const meter = await db.meter.create({
        data: {
          propertyId: weg.id,
          type: "HEIZUNG",
          meterNumber: "WMZ-2024-0001",
          location: "Heizungskeller",
          remoteReadable: true,
        },
      });
      // 15 monatliche Stände (kumulativ), Verbrauch im Winter höher.
      const monthly = [0, 40, 110, 210, 320, 400, 450, 480, 500, 540, 620, 740, 880, 1000, 1090];
      const now = new Date();
      const base = new Date(now.getFullYear(), now.getMonth(), 1);
      base.setMonth(base.getMonth() - (monthly.length - 1));
      await db.meterReading.createMany({
        data: monthly.map((value, i) => {
          const dt = new Date(base);
          dt.setMonth(base.getMonth() + i);
          return { meterId: meter.id, value, readingDate: dt, createdById: admin.id };
        }),
      });
    }
  }

  // SEPA-Demo: Gläubiger-ID am Objekt + ein Beispiel-Mandat für die erste Einheit.
  {
    if (!weg.sepaCreditorId) {
      await db.property.update({
        where: { id: weg.id },
        data: { sepaCreditorId: "DE98ZZZ09999999999" },
      });
    }
    const existingMandate = await db.sepaMandate.findFirst({ where: { propertyId: weg.id }, select: { id: true } });
    if (!existingMandate) {
      const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@bundwimmobilien.de" } });
      const firstUnit = await db.unit.findFirst({ where: { propertyId: weg.id }, orderBy: { orderIndex: "asc" } });
      if (firstUnit) {
        await db.sepaMandate.create({
          data: {
            organizationId: org.id,
            propertyId: weg.id,
            unitId: firstUnit.id,
            mandateRef: "HG-DEMO-001",
            debtorName: "Erika Eigentümerin",
            iban: "DE02120300000000202051",
            signedDate: new Date(Date.UTC(2026, 0, 15)),
            sequence: "FRST",
            createdById: admin.id,
          },
        });
      }
    }
  }

  console.log("Seed abgeschlossen:");
  console.log("  Verwalter:  admin@bundwimmobilien.de / BundW-Start2026!");
  console.log(`  Eigentümer: ${eigentuemer.email} / Demo-2026!`);
  console.log(`  Mieter:     ${mieter.email} / Demo-2026!`);
  console.log(`  Handwerker: ${handwerker.email} / Demo-2026!`);
  console.log(`  Demo-WEG:   ${weg.name} (Finanzen unter /verwaltung/weg)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
