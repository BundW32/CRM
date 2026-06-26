import Link from "next/link";
import { PageTitle } from "@/components/ui";
import {
  craftsmanWhereForVerwalter,
  propertyIdsForVerwalter,
  propertyWhereForVerwalter,
  userWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

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
    href: "/uebergabe",
    title: "Wohnungsübergabe",
    desc: "Übergabeprotokoll digital erstellen, unterschreiben und als PDF exportieren",
  },
];

export default async function VerwaltungPage() {
  const verwalter = await requireVerwalter();

  // Kennzahlen auf den Zuständigkeitsbereich des Verwalters einschränken.
  const assignedIds = await propertyIdsForVerwalter(verwalter);
  const wartungWhere =
    assignedIds === null
      ? { active: true, dueDate: { lte: new Date() }, organizationId: verwalter.organizationId }
      : { active: true, dueDate: { lte: new Date() }, property: { id: { in: assignedIds } } };

  const [objekte, nutzer, handwerker, wartungFaellig] = await Promise.all([
    db.property.count({ where: await propertyWhereForVerwalter(verwalter) }),
    db.user.count({
      where: {
        AND: [{ role: { in: ["MIETER", "EIGENTUEMER"] } }, await userWhereForVerwalter(verwalter)],
      },
    }),
    db.craftsman.count({ where: { active: true, ...(await craftsmanWhereForVerwalter(verwalter)) } }),
    db.maintenanceTask.count({ where: wartungWhere }),
  ]);

  const counts: Record<string, string> = {
    "/verwaltung/objekte": `${objekte} Objekte`,
    "/verwaltung/nutzer": `${nutzer} Mieter/Eigentümer`,
    "/verwaltung/kontakte": `${handwerker} Handwerker`,
    "/verwaltung/wartung": wartungFaellig > 0 ? `${wartungFaellig} überfällig` : "aktuell",
  };

  const allTiles = [
    ...tiles,
    ...(verwalter.isSuperAdmin
      ? [{ href: "/verwaltung/audit", title: "Audit-Log", desc: "Sicherheitsrelevante Aktionen (Login, DSGVO, Freigaben)" }]
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
