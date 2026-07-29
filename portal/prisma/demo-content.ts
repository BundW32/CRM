// Zusatz-Demodaten für Präsentationen (Screenshots, Erklärvideo).
// Füllt die leeren Übersichten des Seeds mit realistischen Vorgängen, Aushängen
// und Dokumenten. NUR für Demo-/Präsentationsumgebungen, nie in Produktion.
// Aufruf: npx tsx prisma/demo-content.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const tageHer = (t: number) => new Date(Date.now() - t * 24 * 60 * 60 * 1000);

async function main() {
  const org = await db.organization.findUniqueOrThrow({ where: { slug: "bw" } });
  const verwalter = await db.user.findFirstOrThrow({
    where: { organizationId: org.id, role: "VERWALTER" },
  });
  const mieter = await db.user.findFirstOrThrow({
    where: { organizationId: org.id, role: "MIETER" },
  });
  const eigentuemer = await db.user.findFirstOrThrow({
    where: { organizationId: org.id, role: "EIGENTUEMER" },
  });
  const properties = await db.property.findMany({
    where: { organizationId: org.id },
    include: { units: true },
    orderBy: { createdAt: "asc" },
  });

  // Beide Demo-Konten sollen ohne Hinweisbanner und ohne Tour-Overlay wirken.
  await db.user.updateMany({
    where: { organizationId: org.id },
    data: { emailVerifiedAt: tageHer(30), tourDoneAt: tageHer(29) },
  });

  const vorgaenge = [
    {
      title: "Wasserschaden Bad – Decke feucht",
      description:
        "Im Bad der Einheit zeigt sich ein feuchter Fleck an der Decke, der seit gestern größer wird. Foto liegt bei.",
      type: "SCHADEN" as const,
      status: "BEAUFTRAGT" as const,
      priority: "DRINGEND" as const,
      trade: "SANITAER" as const,
      category: "Wasserschaden",
      location: "Bad, Decke",
      alter: 2,
      kommentare: [
        ["Aufgenommen, Sanitärbetrieb ist informiert.", verwalter.id],
        ["Termin morgen 9:00 Uhr, Steigleitung wird geprüft.", verwalter.id],
      ],
    },
    {
      title: "Heizung im Treppenhaus bleibt kalt",
      description:
        "Der Heizkörper im Treppenhaus zweiter Stock wird nicht mehr warm, obwohl die Anlage läuft.",
      type: "SCHADEN" as const,
      status: "IN_BEARBEITUNG" as const,
      priority: "HOCH" as const,
      trade: "HEIZUNG" as const,
      category: "Heizung",
      location: "Treppenhaus, 2. OG",
      alter: 5,
      kommentare: [["Heizungsbauer prüft den Strang am Donnerstag.", verwalter.id]],
    },
    {
      title: "Beleuchtung Tiefgarage defekt",
      description: "Zwei Leuchten in der Tiefgarage sind ausgefallen, die Zufahrt ist dunkel.",
      type: "SCHADEN" as const,
      status: "ERLEDIGT" as const,
      priority: "NORMAL" as const,
      trade: "ELEKTRO" as const,
      category: "Elektro",
      location: "Tiefgarage",
      alter: 12,
      kommentare: [["Leuchtmittel getauscht, Beleuchtung läuft wieder.", verwalter.id]],
    },
    {
      title: "Dachrinne verstopft – Regenwasser läuft über",
      description: "Nach dem Starkregen läuft die Dachrinne an der Hofseite über.",
      type: "SCHADEN" as const,
      status: "GESCHLOSSEN" as const,
      priority: "NORMAL" as const,
      trade: "DACH" as const,
      category: "Dach",
      location: "Hofseite",
      alter: 24,
      kommentare: [["Rinne gereinigt und abgenommen.", verwalter.id]],
    },
    {
      title: "Nebenkostenabrechnung 2025 – Rückfrage zur Heizkostenverteilung",
      description:
        "Bitte um Erläuterung, wie die Heizkosten auf die Einheiten verteilt wurden.",
      type: "ANFRAGE" as const,
      status: "IN_BEARBEITUNG" as const,
      priority: "NORMAL" as const,
      category: "Abrechnung",
      alter: 7,
      kommentare: [["Aufstellung wird zusammengestellt und als Dokument bereitgestellt.", verwalter.id]],
    },
    {
      title: "Angebot Fassadenanstrich einholen",
      description:
        "Beschluss der letzten Versammlung: drei Vergleichsangebote für den Fassadenanstrich einholen.",
      type: "SONSTIGES" as const,
      status: "NEU" as const,
      priority: "NIEDRIG" as const,
      trade: "MALER" as const,
      category: "Instandhaltung",
      alter: 1,
      kommentare: [],
    },
  ];

  for (const [i, v] of vorgaenge.entries()) {
    const property = properties[i % properties.length];
    const vorhanden = await db.ticket.findFirst({
      where: { organizationId: org.id, title: v.title },
    });
    if (vorhanden) continue;
    const { alter, kommentare, ...daten } = v;
    const ticket = await db.ticket.create({
      data: {
        ...daten,
        organizationId: org.id,
        propertyId: property.id,
        unitId: property.units[0]?.id ?? null,
        createdById: v.type === "SCHADEN" ? mieter.id : eigentuemer.id,
        assignedToId: verwalter.id,
        createdAt: tageHer(alter),
        updatedAt: tageHer(Math.max(0, alter - 1)),
        closedAt: daten.status === "GESCHLOSSEN" ? tageHer(Math.max(0, alter - 2)) : null,
        completionReportedAt:
          daten.status === "ERLEDIGT" || daten.status === "GESCHLOSSEN"
            ? tageHer(Math.max(0, alter - 2))
            : null,
      },
    });
    for (const [j, [body, authorId]] of kommentare.entries()) {
      await db.ticketComment.create({
        data: {
          ticketId: ticket.id,
          authorId: authorId as string,
          body: body as string,
          createdAt: tageHer(Math.max(0, alter - j - 1)),
        },
      });
    }
  }

  const aushaenge = [
    {
      title: "Eigentümerversammlung am 18. September",
      body: "Die Einladung mit Tagesordnung liegt im Portal unter „Dokumente“ bereit. Anträge bitte bis zum 4. September einreichen.",
      audience: "EIGENTUEMER" as const,
      alter: 3,
    },
    {
      title: "Treppenhausreinigung: neuer Turnus ab Oktober",
      body: "Ab Oktober wird das Treppenhaus wöchentlich montags gereinigt. Bitte die Flure an diesem Tag frei halten.",
      audience: "ALLE" as const,
      alter: 9,
    },
    {
      title: "Wartung der Heizungsanlage am 12. August",
      body: "Zwischen 8 und 14 Uhr kann es zu kurzen Unterbrechungen der Warmwasserversorgung kommen.",
      audience: "ALLE" as const,
      alter: 16,
    },
  ];

  for (const [i, a] of aushaenge.entries()) {
    const property = properties[i % properties.length];
    const vorhanden = await db.announcement.findFirst({
      where: { organizationId: org.id, title: a.title },
    });
    if (vorhanden) continue;
    const { alter, ...daten } = a;
    await db.announcement.create({
      data: {
        ...daten,
        organizationId: org.id,
        propertyId: property.id,
        createdById: verwalter.id,
        createdAt: tageHer(alter),
      },
    });
  }

  const dokumente = [
    { title: "Jahresabrechnung 2025", category: "ABRECHNUNG" as const, audience: "EIGENTUEMER" as const, alter: 20 },
    { title: "Wirtschaftsplan 2026", category: "ABRECHNUNG" as const, audience: "EIGENTUEMER" as const, alter: 18 },
    { title: "Protokoll Eigentümerversammlung 2025", category: "PROTOKOLL" as const, audience: "EIGENTUEMER" as const, alter: 40 },
    { title: "Beschlusssammlung (Stand 2026)", category: "PROTOKOLL" as const, audience: "EIGENTUEMER" as const, alter: 14 },
    { title: "Hausordnung", category: "SONSTIGES" as const, audience: "ALLE" as const, alter: 60 },
    { title: "Wartungsvertrag Heizungsanlage", category: "VERTRAG" as const, audience: "EIGENTUEMER" as const, alter: 55 },
  ];

  for (const [i, d] of dokumente.entries()) {
    const property = properties[i % properties.length];
    const vorhanden = await db.document.findFirst({
      where: { organizationId: org.id, title: d.title },
    });
    if (vorhanden) continue;
    const { alter, ...daten } = d;
    await db.document.create({
      data: {
        ...daten,
        organizationId: org.id,
        propertyId: property.id,
        uploadedById: verwalter.id,
        fileName: `${d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
        storedName: `demo/${d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
        mimeType: "application/pdf",
        size: 180_000 + i * 24_000,
        createdAt: tageHer(alter),
      },
    });
  }

  // Umlaufbeschlüsse: eine laufende Abstimmung und ein gefasster Beschluss.
  const wegProperty =
    properties.find((p) => p.managementType === "WEG") ?? properties[0];
  const beschluesse = [
    {
      title: "Erneuerung der Hauseingangstür",
      description:
        "Die Hauseingangstür wird durch eine einbruchhemmende Tür (RC2) ersetzt. Kosten laut Angebot 6.480,00 € brutto, Entnahme aus der Erhaltungsrücklage.",
      status: "OFFEN" as const,
      majority: "EINFACH" as const,
      alter: 4,
      deadlineInTagen: 10,
      stimmen: ["JA", "JA", "ENTHALTUNG"] as const,
    },
    {
      title: "Wartungsvertrag Heizungsanlage ab 2026",
      description:
        "Abschluss eines Wartungsvertrags für die Heizungsanlage mit jährlicher Wartung und Störungsdienst. Jahrespauschale 1.140,00 € brutto.",
      status: "ANGENOMMEN" as const,
      majority: "EINFACH" as const,
      nummer: 12,
      alter: 45,
      stimmen: ["JA", "JA", "JA"] as const,
    },
  ];

  const stimmberechtigte = await db.user.findMany({
    where: { organizationId: org.id, role: "EIGENTUEMER" },
    take: 3,
  });

  for (const b of beschluesse) {
    const vorhanden = await db.resolution.findFirst({
      where: { organizationId: org.id, title: b.title },
    });
    if (vorhanden) continue;
    const { alter, deadlineInTagen, stimmen, nummer, ...daten } = b;
    const beschluss = await db.resolution.create({
      data: {
        ...daten,
        number: nummer ?? null,
        organizationId: org.id,
        propertyId: wegProperty.id,
        createdById: verwalter.id,
        createdAt: tageHer(alter),
        deadline: deadlineInTagen
          ? new Date(Date.now() + deadlineInTagen * 24 * 60 * 60 * 1000)
          : null,
        decidedAt: daten.status === "OFFEN" ? null : tageHer(Math.max(0, alter - 7)),
      },
    });
    for (const [i, wahl] of stimmen.entries()) {
      const waehler = stimmberechtigte[i];
      if (!waehler) break;
      await db.resolutionVote.create({
        data: {
          resolutionId: beschluss.id,
          userId: waehler.id,
          choice: wahl,
          createdAt: tageHer(Math.max(0, alter - 1)),
        },
      });
    }
  }

  console.log("Demo-Inhalte angelegt (Vorgänge, Aushänge, Dokumente, Beschlüsse).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
