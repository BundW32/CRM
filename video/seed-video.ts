// Demo-Daten für die Videoaufnahme.
//
// `prisma/seed.ts` legt die WEG „Musterstraße 12" mit Einheiten, Konten,
// beschlossenem Wirtschaftsplan und Sollstellungen an — das trägt die
// Finanzszenen. Für die Aufnahme fehlen die Bildschirme, die dort leer
// bleiben: Versammlung mit Tagesordnung, Beschluss-Sammlung, Vorgänge und
// Aushänge. Genau die ergänzt dieses Skript, idempotent.
//
//   DATABASE_URL=… npx tsx video/seed-video.ts
//
// Aufnahmedaten, kein Deployment-Skript: Es gehört nicht in den Seed der App.
import "dotenv/config";
import { PrismaClient } from "../portal/src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const org = await db.organization.findFirstOrThrow({ where: { slug: "bw" } });
  const weg = await db.property.findFirstOrThrow({ where: { immoware24Id: "demo-weg-1" } });
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@bundwimmobilien.de" } });
  const erika = await db.user.findUniqueOrThrow({ where: { email: "eigentuemer@demo.de" } });
  const klaus = await db.user.findUniqueOrThrow({ where: { email: "kaeufer@demo.de" } });
  const mieter = await db.user.findUniqueOrThrow({ where: { email: "mieter@demo.de" } });

  // Das Bestätigungs-Banner steht sonst quer über jedem Bild.
  await db.user.updateMany({ data: { emailVerifiedAt: new Date() } });

  // ── Beschluss-Sammlung: fortlaufend nummeriert (§ 24 Abs. 7 WEG) ──────────
  const beschluesse: {
    number: number;
    title: string;
    description: string;
    majority: "EINFACH" | "DREIVIERTEL";
    decidedAt: Date;
  }[] = [
    {
      number: 1,
      title: "Wirtschaftsplan 2026",
      description:
        "Der Wirtschaftsplan 2026 mit einem Gesamtvolumen von 15.000,00 € wird " +
        "beschlossen. Die Vorschüsse sind monatlich zum Ersten fällig.",
      majority: "EINFACH",
      decidedAt: new Date(Date.UTC(2025, 11, 10)),
    },
    {
      number: 2,
      title: "Erhaltungsrücklage: Zuführung 6.000 € jährlich",
      description:
        "Der Erhaltungsrücklage werden ab 2026 jährlich 6.000,00 € zugeführt, " +
        "monatlich anteilig über das Hausgeld.",
      majority: "EINFACH",
      decidedAt: new Date(Date.UTC(2025, 11, 10)),
    },
    {
      number: 3,
      title: "Treppenhausanstrich 2026",
      description:
        "Der Anstrich des Treppenhauses wird an die Malerbetrieb Ruhr GmbH " +
        "vergeben (Angebot vom 14.02.2026, 4.180,00 €). Finanzierung aus der " +
        "Erhaltungsrücklage.",
      majority: "EINFACH",
      decidedAt: new Date(Date.UTC(2026, 2, 3)),
    },
  ];

  for (const b of beschluesse) {
    const existing = await db.resolution.findFirst({
      where: { propertyId: weg.id, number: b.number },
    });
    if (existing) continue;
    const res = await db.resolution.create({
      data: {
        organizationId: org.id,
        propertyId: weg.id,
        number: b.number,
        title: b.title,
        description: b.description,
        status: "ANGENOMMEN",
        majority: b.majority,
        createdById: admin.id,
        decidedAt: b.decidedAt,
        createdAt: new Date(b.decidedAt.getTime() - 12 * 24 * 3600 * 1000),
      },
    });
    // Abstimmung nach Miteigentumsanteilen: Erika 820, Klaus 180.
    await db.resolutionVote.createMany({
      data: [
        { resolutionId: res.id, userId: erika.id, choice: "JA" },
        { resolutionId: res.id, userId: klaus.id, choice: b.number === 3 ? "ENTHALTUNG" : "JA" },
      ],
    });
  }

  // ── Laufender Umlaufbeschluss: zeigt die Abstimmung in Aktion ────────────
  const laufend = await db.resolution.findFirst({
    where: { propertyId: weg.id, title: { startsWith: "Fahrradständer" } },
  });
  if (!laufend) {
    const res = await db.resolution.create({
      data: {
        organizationId: org.id,
        propertyId: weg.id,
        title: "Fahrradständer im Hof",
        description:
          "Im Hof wird ein überdachter Fahrradständer für acht Räder " +
          "aufgestellt (Angebot 1.240,00 €, Finanzierung aus der laufenden " +
          "Bewirtschaftung).",
        status: "OFFEN",
        majority: "EINFACH",
        deadline: new Date(Date.UTC(2026, 7, 15)),
        createdById: admin.id,
      },
    });
    await db.resolutionVote.create({
      data: { resolutionId: res.id, userId: erika.id, choice: "JA" },
    });
  }

  // ── Eigentümerversammlung mit Tagesordnung ───────────────────────────────
  const meetingExists = await db.ownersMeeting.findFirst({ where: { propertyId: weg.id } });
  if (!meetingExists) {
    const beschlussTop = await db.resolution.findFirst({
      where: { propertyId: weg.id, number: 3 },
    });
    await db.ownersMeeting.create({
      data: {
        organizationId: org.id,
        propertyId: weg.id,
        title: "Ordentliche Eigentümerversammlung 2026",
        scheduledAt: new Date(Date.UTC(2026, 8, 17, 16, 30)),
        location: "Gemeinschaftsraum, Musterstraße 12",
        status: "EINBERUFEN",
        invitationSentAt: new Date(Date.UTC(2026, 7, 12)),
        attendanceNote: "6 von 6 Einheiten vertreten · 1.000 / 1.000 MEA",
        createdById: admin.id,
        agendaItems: {
          create: [
            { sortOrder: 1, title: "Begrüßung und Feststellung der Beschlussfähigkeit", type: "INFO" },
            {
              sortOrder: 2,
              title: "Jahresabrechnung 2025",
              description: "Vorstellung der Abrechnung und des Vermögensberichts nach § 28 Abs. 4 WEG.",
              type: "INFO",
            },
            {
              sortOrder: 3,
              title: "Beschluss: Treppenhausanstrich 2026",
              description: "Vergabe an die Malerbetrieb Ruhr GmbH, Finanzierung aus der Erhaltungsrücklage.",
              type: "BESCHLUSS",
              resolutionId: beschlussTop?.id ?? null,
            },
            {
              sortOrder: 4,
              title: "Beschluss: Wirtschaftsplan 2027",
              description: "Vorschüsse je Einheit nach Miteigentumsanteilen, Fläche und Personenzahl.",
              type: "BESCHLUSS",
            },
            { sortOrder: 5, title: "Verschiedenes", type: "INFO" },
          ],
        },
      },
    });
  }

  // ── Vorgänge: der Alltag zwischen den Versammlungen ──────────────────────
  const unitDG = await db.unit.findFirstOrThrow({
    where: { propertyId: weg.id, label: { startsWith: "WE 05" } },
  });
  const tickets = [
    {
      title: "Wasserfleck an der Treppenhausdecke",
      description:
        "Im Treppenhaus zwischen 1. OG und DG zeigt sich ein feuchter Fleck von " +
        "etwa 30 cm. Foto liegt bei.",
      location: "Treppenhaus, Decke 1. OG",
      type: "SCHADEN" as const,
      status: "IN_BEARBEITUNG" as const,
      priority: "HOCH" as const,
      trade: "SANITAER" as const,
      category: "Wasserschaden",
      unitId: null as string | null,
      senderName: "Max Mieter",
    },
    {
      title: "Heizung im DG wird nicht warm",
      description: "Der Heizkörper im Wohnzimmer bleibt kalt, die anderen Räume sind warm.",
      location: "WE 05, DG — Wohnzimmer",
      type: "SCHADEN" as const,
      status: "BEAUFTRAGT" as const,
      priority: "NORMAL" as const,
      trade: "HEIZUNG" as const,
      category: "Heizung",
      unitId: unitDG.id,
      senderName: "Erika Eigentümerin",
    },
    {
      title: "Teilungserklärung als PDF gewünscht",
      description: "Für die Bank wird eine Kopie der Teilungserklärung benötigt.",
      location: null,
      type: "DOKUMENT_ANFRAGE" as const,
      status: "ERLEDIGT" as const,
      priority: "NIEDRIG" as const,
      trade: null,
      category: null,
      unitId: null,
      senderName: "Klaus Käufer",
    },
  ];

  for (const t of tickets) {
    const exists = await db.ticket.findFirst({ where: { title: t.title, propertyId: weg.id } });
    if (exists) continue;
    const ticket = await db.ticket.create({
      data: {
        organizationId: org.id,
        propertyId: weg.id,
        unitId: t.unitId,
        type: t.type,
        status: t.status,
        priority: t.priority,
        trade: t.trade,
        category: t.category,
        title: t.title,
        description: t.description,
        location: t.location,
        senderName: t.senderName,
        createdById: t.senderName === "Max Mieter" ? mieter.id : erika.id,
      },
    });
    if (t.status === "IN_BEARBEITUNG") {
      await db.ticketComment.create({
        data: {
          ticketId: ticket.id,
          authorId: admin.id,
          body: "Sanitärbetrieb kommt am Donnerstag zur Ortung. Rückmeldung folgt.",
        },
      });
    }
  }

  // ── Aushang für die Pinnwand ─────────────────────────────────────────────
  const aushang = await db.announcement.findFirst({
    where: { propertyId: weg.id, title: { startsWith: "Treppenhaus" } },
  });
  if (!aushang) {
    await db.announcement.create({
      data: {
        organizationId: org.id,
        propertyId: weg.id,
        audience: "ALLE",
        title: "Treppenhausreinigung ab 1. August neuer Turnus",
        body:
          "Die Reinigung findet künftig dienstags statt. Bitte an den " +
          "Reinigungstagen keine Schuhe im Treppenhaus abstellen.",
        createdById: admin.id,
      },
    });
  }

  const counts = {
    beschluesse: await db.resolution.count({ where: { propertyId: weg.id } }),
    versammlungen: await db.ownersMeeting.count({ where: { propertyId: weg.id } }),
    vorgaenge: await db.ticket.count({ where: { propertyId: weg.id } }),
    aushaenge: await db.announcement.count({ where: { propertyId: weg.id } }),
  };
  console.log("Video-Demodaten:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
