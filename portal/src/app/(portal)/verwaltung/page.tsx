import Link from "next/link";
import { PageTitle } from "@/components/ui";
import {
  craftsmanWhereForVerwalter,
  isSelfManaged,
  propertyIdsForVerwalter,
  propertyWhereForVerwalter,
  userWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";

export const dynamic = "force-dynamic";

const tiles = [
  {
    href: "/verwaltung/objekte",
    title: "Objekte",
    desc: "Objekte, Einheiten und Eigentümer verwalten",
  },
  {
    href: "/verwaltung/objekte/neu",
    title: "+ Objekt anlegen",
    desc: "Neues Objekt mit Einheiten, Eigentümer und Mietern erfassen",
    accent: true,
  },
  {
    href: "/verwaltung/nutzer",
    title: "Nutzer",
    desc: "Zugänge anlegen, einladen, Zugangsschreiben & DSGVO",
  },
  {
    href: "/verwaltung/kontakte",
    title: "Kontakte",
    desc: "Handwerker und Kontaktbuch (Mieter/Eigentümer)",
  },
  {
    href: "/verwaltung/wartung",
    title: "Wartung",
    desc: "Wiederkehrende Wartungen & Prüfungen mit Fälligkeit",
  },
  {
    href: "/verwaltung/dokument-quellen",
    title: "Dokument-Quellen",
    desc: "Google Drive Ordner automatisch ins Dokumenten-Portal synchronisieren",
  },
  {
    href: "/verwaltung/notizen",
    title: "Notizen",
    desc: "Interne Notizen zu Objekten, Einheiten und Personen",
  },
  {
    href: "/verwaltung/eigentuemer",
    title: "Eigentümer & MEA",
    desc: "Miteigentumsanteile und Stimmprinzip je WEG-Objekt (Eigentümerliste, CSV)",
  },
  {
    href: "/beschluesse",
    title: "Beschlüsse",
    desc: "Umlaufbeschlüsse & Abstimmungen der WEG, Beschluss-Sammlung",
  },
  {
    href: "/versammlungen",
    title: "Versammlungen",
    desc: "Eigentümerversammlungen: Einladung, Tagesordnung, Protokoll",
  },
  {
    href: "/uebergabe",
    title: "Wohnungsübergabe",
    desc: "Übergabeprotokoll digital erstellen, unterschreiben und als PDF exportieren",
  },
];

// Abgespeckter Hub für selbstverwaltete WEGs – nur WEG-relevante Bereiche, keine
// professionellen Werkzeuge (Handwerker, Wartung, Dokument-Quellen, Übergabe).
const selfManagedTiles = [
  {
    href: "/verwaltung/weg",
    title: "Finanzen & Buchhaltung",
    desc: "Konten, Buchungen, Wirtschaftsplan, Hausgeld & offene Posten, CSV-Bankimport",
  },
  {
    href: "/verwaltung/eigentuemer",
    title: "Eigentümer & Stimmrecht",
    desc: "Eigentümer, Miteigentumsanteile (MEA), Stimmprinzip und Verwaltungsbeirat",
  },
  {
    href: "/verwaltung/objekte",
    title: "WEG-Objekt",
    desc: "Objektdaten und Einheiten Ihrer Wohnungseigentümergemeinschaft",
  },
  {
    href: "/verwaltung/nutzer",
    title: "Zugänge",
    desc: "Eigentümer-Zugänge anlegen und einladen",
  },
  { href: "/beschluesse", title: "Beschlüsse", desc: "Umlaufbeschlüsse, Abstimmung, Beschluss-Sammlung" },
  { href: "/versammlungen", title: "Versammlungen", desc: "Einladung, Tagesordnung, Protokoll" },
  { href: "/antraege", title: "Anträge", desc: "Eigentümer-Anträge einreichen und übernehmen" },
  { href: "/gemeinschaft", title: "Gemeinschaft", desc: "Transparente Leseansicht für alle Eigentümer" },
];

export default async function VerwaltungPage() {
  const verwalter = await requireVerwalter();
  const org = await getOrganization();

  // Selbstverwaltete WEG: eigener, abgespeckter Hub.
  if (isSelfManaged(org)) {
    const [objekte, eigentuemer] = await Promise.all([
      db.property.count({ where: await propertyWhereForVerwalter(verwalter) }),
      db.user.count({
        where: { AND: [{ role: "EIGENTUEMER" }, await userWhereForVerwalter(verwalter)] },
      }),
    ]);
    const smCounts: Record<string, string> = {
      "/verwaltung/objekte": `${objekte} Objekt(e)`,
      "/verwaltung/eigentuemer": `${eigentuemer} Eigentümer`,
    };
    const smTiles = [
      ...selfManagedTiles,
      ...(verwalter.isSuperAdmin
        ? [
            { href: "/verwaltung/abrechnung", title: "Abrechnung", desc: "Tarif, Status und Abonnement Ihrer WEG" },
            { href: "/verwaltung/audit", title: "Audit-Log", desc: "Sicherheitsrelevante Aktionen" },
          ]
        : []),
    ];
    return (
      <>
        <PageTitle>WEG-Verwaltung</PageTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {smTiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">{t.title}</h2>
                <span className="text-gray-300 transition group-hover:text-brand-orange">→</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{t.desc}</p>
              {smCounts[t.href] ? (
                <p className="mt-3 text-xs font-medium text-gray-400">{smCounts[t.href]}</p>
              ) : null}
            </Link>
          ))}
        </div>
      </>
    );
  }

  // Kennzahlen auf den Zuständigkeitsbereich des Verwalters einschränken.
  const assignedIds = await propertyIdsForVerwalter(verwalter);
  const wartungWhere =
    assignedIds === null
      ? { active: true, dueDate: { lte: new Date() }, organizationId: verwalter.organizationId }
      : { active: true, dueDate: { lte: new Date() }, property: { id: { in: assignedIds } } };

  const [objekte, nutzer, handwerker, wartungFaellig, wegObjekte] = await Promise.all([
    db.property.count({ where: await propertyWhereForVerwalter(verwalter) }),
    db.user.count({
      where: {
        AND: [{ role: { in: ["MIETER", "EIGENTUEMER"] } }, await userWhereForVerwalter(verwalter)],
      },
    }),
    db.craftsman.count({ where: { active: true, ...(await craftsmanWhereForVerwalter(verwalter)) } }),
    db.maintenanceTask.count({ where: wartungWhere }),
    db.property.count({
      where: { ...(await propertyWhereForVerwalter(verwalter)), managementType: "WEG" },
    }),
  ]);

  const counts: Record<string, string> = {
    "/verwaltung/objekte": `${objekte} Objekte`,
    "/verwaltung/nutzer": `${nutzer} Mieter/Eigentümer`,
    "/verwaltung/kontakte": `${handwerker} Handwerker`,
    "/verwaltung/wartung": wartungFaellig > 0 ? `${wartungFaellig} überfällig` : "aktuell",
  };

  const allTiles = [
    ...tiles,
    // WEG-Finanzbereich nur zeigen, wenn es WEG-Objekte im Scope gibt.
    ...(wegObjekte > 0
      ? [
          {
            href: "/verwaltung/weg",
            title: "WEG-Finanzen",
            desc: "Konten, Buchungen, Wirtschaftsplan, Hausgeld & offene Posten, CSV-Bankimport",
          },
        ]
      : []),
    ...(verwalter.isSuperAdmin
      ? [
          { href: "/verwaltung/branding", title: "Branding", desc: "Logo, Akzentfarbe und Impressum Ihrer Hausverwaltung" },
          { href: "/verwaltung/abrechnung", title: "Abrechnung", desc: "Tarif, Status und Abonnement Ihrer Hausverwaltung" },
          { href: "/verwaltung/audit", title: "Audit-Log", desc: "Sicherheitsrelevante Aktionen (Login, DSGVO, Freigaben)" },
        ]
      : []),
  ];

  return (
    <>
      <PageTitle>Verwaltung</PageTitle>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allTiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`group rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${
              (t as { accent?: boolean }).accent
                ? "border-brand-orange/40 bg-brand-orange-light"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{t.title}</h2>
              <span className="text-gray-300 transition group-hover:text-brand-orange">→</span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{t.desc}</p>
            {counts[t.href] ? (
              <p className="mt-3 text-xs font-medium text-gray-400">{counts[t.href]}</p>
            ) : null}
          </Link>
        ))}
      </div>
    </>
  );
}
