import Link from "next/link";
import { redirect } from "next/navigation";
import { InstallHint } from "@/components/install-hint";
import { NavProgress } from "@/components/nav-progress";
import { PageTransition } from "@/components/page-transition";
import { PortalHeader } from "@/components/portal-header";
import { BrandTheme } from "@/components/brand-theme";
import { isSelfManaged, ownsWegProperty } from "@/lib/access";
import { isPlatformAdminUser } from "@/lib/platform";
import { orgLogoUrl } from "@/lib/branding";
import { roleLabels } from "@/lib/labels";
import { getOrganization, requireUser } from "@/lib/session";

const navByRole = {
  MIETER: [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/vorgaenge", label: "Meine Vorgänge" },
    { href: "/nachrichten", label: "Nachrichten" },
    { href: "/infos", label: "Infos" },
    { href: "/zaehler", label: "Zähler" },
  ],
  EIGENTUEMER: [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/vorgaenge", label: "Vorgänge" },
    { href: "/beschluesse", label: "Beschlüsse" },
    { href: "/versammlungen", label: "Versammlungen" },
    { href: "/nachrichten", label: "Nachrichten" },
    { href: "/infos", label: "Infos" },
    { href: "/zaehler", label: "Zähler" },
  ],
  VERWALTER: [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/vorgaenge", label: "Vorgänge" },
    { href: "/nachrichten", label: "Nachrichten" },
    { href: "/infos", label: "Infos" },
    { href: "/zaehler", label: "Zähler" },
    // Beschlüsse & Versammlungen erreicht der Verwalter über den Verwaltung-Hub
    // (hält die obere Leiste schlank).
    { href: "/verwaltung", label: "Verwaltung" },
  ],
  HANDWERKER: [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/vorgaenge", label: "Meine Aufträge" },
  ],
} as const;

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/passwort-festlegen");
  const org = await getOrganization();
  let nav: ReadonlyArray<{ href: string; label: string }> = navByRole[user.role];
  // Eigentümer ohne WEG-Objekt sehen keine Beschlüsse/Versammlungen
  const ownsWeg = user.role === "EIGENTUEMER" ? await ownsWegProperty(user.id) : false;
  if (user.role === "EIGENTUEMER" && !ownsWeg) {
    nav = nav.filter((item) => item.href !== "/beschluesse" && item.href !== "/versammlungen");
  }
  // Selbstverwaltung: „Anträge" für den internen Verwalter und für Eigentümer mit
  // WEG-Objekt ergänzen (nur in selbstverwalteten Organisationen).
  if (isSelfManaged(org)) {
    const showMotions = user.role === "VERWALTER" || (user.role === "EIGENTUEMER" && ownsWeg);
    if (showMotions && !nav.some((item) => item.href === "/antraege")) {
      nav = [...nav, { href: "/antraege", label: "Anträge" }];
    }
  }
  // Plattform-Betreiber (B&W): Zugang zum internen Betreiber-Bereich.
  if (isPlatformAdminUser(user)) {
    nav = [...nav, { href: "/plattform", label: "Plattform" }];
  }

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
      <BrandTheme primaryColor={org?.primaryColor ?? null} />
      <NavProgress />
      <PortalHeader
        nav={nav}
        userName={user.name}
        roleLabel={roleLabels[user.role]}
        logoUrl={logoUrl}
        orgName={orgName}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <PageTransition>{children}</PageTransition>
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
    </div>
  );
}
