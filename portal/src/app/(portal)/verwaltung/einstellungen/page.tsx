import Link from "next/link";
import { Tipp } from "@/components/tipp";
import { redirect } from "next/navigation";
import {
  Database,
  FileSignature,
  HardDriveDownload,
  Palette,
  Plug,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  PageTitle,
  cardSurfaceClass,
} from "@/components/ui";
import { isSelfManaged } from "@/lib/access";
import { settingsItems, type NavIcon } from "@/lib/app-nav";
import { isPlatformAdminUser } from "@/lib/platform-admin";
import { getOrganization, requireVerwalter } from "@/lib/session";

export const dynamic = "force-dynamic";

// Einstellungen liegen bewusst außerhalb der Hauptnavigation: Man stellt sie
// einmal ein und fasst sie monatelang nicht an. Diese Seite ist ihr Zuhause –
// die Einzelseiten selbst bleiben unter ihren gewohnten Adressen erreichbar.
// Jeder Icon-Schlüssel aus `settingsItems` braucht hier einen Eintrag — ohne
// ihn erscheint die Kachel ohne Icon (so geschah es dem Verwaltervertrag).
const ICONS: Partial<Record<NavIcon, LucideIcon>> = {
  branding: Palette,
  dokumente: FileSignature,
  integrationen: Plug,
  quellen: HardDriveDownload,
  abrechnung: Receipt,
  ablage: Database,
  audit: ShieldCheck,
};

export default async function EinstellungenPage() {
  const verwalter = await requireVerwalter();
  // Gleiche Hürde wie auf den Einzelseiten – hier nur die Übersicht davor.
  if (!verwalter.isSuperAdmin) redirect("/dashboard");

  const org = await getOrganization();
  const items = settingsItems(isSelfManaged(org), isPlatformAdminUser(verwalter));

  return (
    <>
      <PageTitle>Einstellungen</PageTitle>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group ${cardSurfaceClass} p-5 transition hover:shadow-md`}
            >
              <div className="flex items-center gap-3">
                {Icon ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange-light text-brand-orange-dark">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                ) : null}
                <h2 className="min-w-0 flex-1 text-base font-semibold text-gray-900">
                  {item.title}
                </h2>
                <span className="text-gray-300 transition group-hover:text-brand-orange">→</span>
              </div>
              {item.desc ? <p className="mt-2 text-sm text-gray-600">{item.desc}</p> : null}
              {/* Ein Laie liest fünf Kacheln mit Paragraphen im Untertitel und
                  schließt daraus, dass er etwas versäumt, wenn er sie nicht
                  versteht. Die meisten betreffen ihn schlicht nie. */}
              {item.nurWenn ? (
                <Tipp className="mt-1">Nur relevant, wenn {item.nurWenn}.</Tipp>
              ) : null}
            </Link>
          );
        })}
      </div>
    </>
  );
}
