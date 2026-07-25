import Link from "next/link";
import { redirect } from "next/navigation";
import { InstallHint } from "@/components/install-hint";
import { NavProgress } from "@/components/nav-progress";
import { NumericAutoselect } from "@/components/numeric-autoselect";
import { PageTransition } from "@/components/page-transition";
import { AppShell } from "@/components/app-shell";
import { AssistantWidget } from "@/components/assistant-widget";
import { BrandTheme } from "@/components/brand-theme";
import { CommandPalette, type PaletteNavItem } from "@/components/command-palette";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import {
  isBoardMember,
  isSelfManaged,
  ownsWegProperty,
  propertyWhereForVerwalter,
} from "@/lib/access";
import { canSeeSettings, navFor, settingsItems, usesCounts } from "@/lib/app-nav";
import { canUseAssistant, isAssistantEnabled } from "@/lib/assistant";
import { db } from "@/lib/db";
import { loadNavCounts } from "@/lib/nav-counts";
import { isPlatformAdminUser } from "@/lib/platform";
import { orgLogoUrl } from "@/lib/branding";
import { roleLabels } from "@/lib/labels";
import { getOrganization, getSession, requireUser } from "@/lib/session";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/passwort-festlegen");
  // Unabhängige Abfragen parallel laden (spart pro Seitenaufruf eine DB-Runde).
  // getSession ist bereits gecacht (dedupliziert mit requireUser).
  const [session, org, ownsWeg, boardMember] = await Promise.all([
    getSession(),
    getOrganization(),
    user.role === "EIGENTUEMER" ? ownsWegProperty(user.id) : Promise.resolve(false),
    user.role === "EIGENTUEMER" ? isBoardMember(user.id) : Promise.resolve(false),
  ]);
  const selfManaged = isSelfManaged(org);
  const isPlatformAdmin = isPlatformAdminUser(user);

  // WEG-Finanzen nur einblenden, wenn WEG-Objekte im Zuständigkeitsbereich liegen.
  const hasWegObjekte =
    user.role === "VERWALTER"
      ? (await db.property.count({
          where: { ...(await propertyWhereForVerwalter(user)), managementType: "WEG" },
        })) > 0
      : false;

  const navContext = {
    role: user.role,
    isSuperAdmin: Boolean(user.isSuperAdmin),
    isPlatformAdmin,
    selfManaged,
    hasWegObjekte,
    ownsWeg,
    boardMember,
  };
  const navGroups = navFor(navContext);

  // Sprungziele der ⌘K-Palette: exakt die Punkte, die diese Rolle ohnehin
  // erreichen kann. Die Einstellungs-Seiten sind bewusst dabei – sie liegen
  // hinter dem Zahnrad und sind genau deshalb die, die man sucht.
  const paletteItems: PaletteNavItem[] = [
    ...navGroups.flatMap((g) =>
      g.items.map((i) => ({ title: i.title, href: i.href, group: g.label ?? "Bereiche" })),
    ),
    ...(canSeeSettings(navContext)
      ? settingsItems(selfManaged).map((i) => ({
          title: i.title,
          href: i.href,
          group: "Einstellungen",
        }))
      : []),
    { title: "Konto", href: "/konto", group: "Konto" },
    ...(isPlatformAdmin ? [{ title: "Plattform", href: "/plattform", group: "Konto" }] : []),
  ];

  // Zähler-Badges: Promise NICHT awaiten – die Leiste rendert sofort, die Zahlen
  // streamen nach. Nur für Verwalter, sonst entstünden Abfragen ohne Nutzen.
  const badgesPromise = usesCounts(navContext) ? loadNavCounts(user) : undefined;

  // KI-Assistent erscheint als schwebende Bubble (unten rechts), nicht in der
  // Navigation – nur bei Feature-Freigabe und passender Rolle.
  const showAssistant = isAssistantEnabled() && canUseAssistant(user);

  const orgName = org?.name ?? "Kundenportal";
  const logoUrl = org ? orgLogoUrl(org) : "/bw-logo.png";
  // Impressum-Zeile aus den Organisationsdaten zusammensetzen (mit Fallback).
  const footerLegal = org?.legalName ?? orgName;
  const footerAddress = [org?.street, [org?.zip, org?.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const footerEmail = org?.email ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      {session.impersonating ? (
        <ImpersonationBanner customerName={user.name} adminName={session.realUser?.name ?? "Betreiber"} />
      ) : null}
      <BrandTheme primaryColor={org?.primaryColor ?? null} />
      <NavProgress />
      <NumericAutoselect />
      <main className="mx-auto w-full max-w-[120rem] flex-1 px-4 py-8">
        <AppShell
          groups={navGroups}
          badgesPromise={badgesPromise}
          user={{ name: user.name, roleLabel: roleLabels[user.role] }}
          logoUrl={logoUrl}
          orgName={orgName}
          showSettings={canSeeSettings(navContext)}
          showPlattform={isPlatformAdmin}
        >
          <PageTransition>{children}</PageTransition>
        </AppShell>
      </main>
      <footer className="mt-4 px-4 py-6 text-center text-xs text-gray-400">
        {footerLegal}
        {footerAddress ? ` · ${footerAddress}` : ""}
        {footerEmail ? (
          <>
            {" · "}
            <a href={`mailto:${footerEmail}`} className="hover:text-brand-orange">
              {footerEmail}
            </a>
          </>
        ) : null}
        <br />
        <Link href="/impressum" className="hover:text-brand-orange">
          Impressum
        </Link>{" "}
        ·{" "}
        <Link href="/datenschutz" className="hover:text-brand-orange">
          Datenschutz
        </Link>{" "}
        ·{" "}
        <Link href="/agb" className="hover:text-brand-orange">
          AGB
        </Link>{" "}
        ·{" "}
        <Link href="/avv" className="hover:text-brand-orange">
          AVV
        </Link>
      </footer>
      <InstallHint />
      {/* Datensuche nur für Verwalter – siehe `lib/portal-search.ts`. Die
          Sprungliste bekommt jede Rolle. */}
      <CommandPalette navItems={paletteItems} canSearchData={user.role === "VERWALTER"} />
      {showAssistant ? <AssistantWidget /> : null}
    </div>
  );
}
