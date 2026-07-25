import Link from "next/link";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import {
  isSelfManaged,
  propertyWhereForVerwalter,
  userWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";

export const dynamic = "force-dynamic";

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
  { href: "/zaehler", title: "Zähler", desc: "Zählerstände erfassen (Einzel- & Allgemeinzähler), Verbrauch verfolgen" },
  { href: "/beschluesse", title: "Beschlüsse", desc: "Umlaufbeschlüsse, Abstimmung, Beschluss-Sammlung" },
  { href: "/versammlungen", title: "Versammlungen", desc: "Einladung, Tagesordnung, Protokoll" },
  { href: "/antraege", title: "Anträge", desc: "Eigentümer-Anträge einreichen und übernehmen" },
  { href: "/gemeinschaft", title: "Gemeinschaft", desc: "Transparente Leseansicht für alle Eigentümer" },
  { href: "/verwaltung/integrationen", title: "Integrationen", desc: "Optionale API-Zugänge (Open Banking, Messdienst) — ohne Schlüssel gilt der manuelle Weg" },
];

export default async function VerwaltungPage() {
  const verwalter = await requireVerwalter();
  const org = await getOrganization();

  // Professioneller Verwalter: Master-Detail-Führung (Sidebar aus dem Layout).
  // Der Hub selbst hat keinen eigenen Inhalt mehr – direkt in den ersten Bereich.
  if (!isSelfManaged(org)) {
    redirect("/verwaltung/objekte");
  }

  // Selbstverwaltete WEG: eigener, abgespeckter Hub (unverändert).
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
