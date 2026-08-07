import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InstallHint } from "@/components/install-hint";
import { NavProgress } from "@/components/nav-progress";
import { NumericAutoselect } from "@/components/numeric-autoselect";
import { HashScroll } from "@/components/hash-scroll";
import { TourHost } from "@/components/tour-host";
import { PageTransition } from "@/components/page-transition";
import { ToastHost } from "@/components/toast-host";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui";
import { AssistantWidget } from "@/components/assistant-widget";
import { BrandTheme } from "@/components/brand-theme";
import { CommandPalette, type PaletteNavItem } from "@/components/command-palette";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { SetupBanner } from "@/components/setup-banner";
import {
  isBoardMember,
  isSelfManaged,
  ownsWegProperty,
  propertyWhereForVerwalter,
} from "@/lib/access";
import { isWegSaas } from "@/lib/app-mode";
import { zugriffsStatus } from "@/lib/billing";
import { canSeeSettings, navFor, settingsItems, usesCounts } from "@/lib/app-nav";
import { canUseAssistant, isAssistantEnabled } from "@/lib/assistant";
import { db } from "@/lib/db";
import { loadNavCounts } from "@/lib/nav-counts";
import { isPlatformAdminUser } from "@/lib/platform";
import { orgLogoUrl } from "@/lib/branding";
import { roleLabels } from "@/lib/labels";
import { getOrganization, getSession, requireUser } from "@/lib/session";
import { loadSetupStatus, loadSetupStatusAlle } from "@/lib/weg/setup-status";

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

  // Abo-Durchsetzung (nur WEG-SaaS): Ohne aktives Abo oder laufende Testphase
  // endet jede Portalseite auf der Sperrseite /abo — sie liegt außerhalb
  // dieser Layout-Gruppe, sonst träfe die Umleitung sie selbst. Die B&W-Tür
  // rechnet über Plattform-Rechnungen ab und wird über `Organization.active`
  // gesteuert. Ausgenommen bleiben Plattform-Betreiber und ihre Impersonation:
  // Ein gesperrter Kunde muss für den Support erreichbar bleiben.
  const abo = org && isWegSaas() ? zugriffsStatus(org) : "voll";
  if (abo === "gesperrt" && !isPlatformAdmin && !session.impersonating) {
    redirect("/abo");
  }

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

  // Einrichtungs-Band: nur für die verwaltende Person einer selbstverwalteten
  // WEG und nur, solange die Einrichtung läuft. Das Band selbst blendet sich
  // auf der Übersicht aus – dort steht der Assistent.
  //
  // Gezeigt wird das erste **offene** Objekt, nicht das erste beliebige: Ein
  // `findFirst` ohne Sortierung lieferte irgendeines, und war das fertig, blieb
  // das Band für ein zweites, gerade angelegtes Objekt stumm.
  //
  // Bewusst auf Selbstverwaltungen begrenzt und auf zehn Objekte gedeckelt:
  // Jeder Stand kostet sieben Abfragen, und dieses Layout läuft bei **jeder**
  // Seitenauslieferung. Professionelle Verwaltungen finden den Assistenten im
  // Arbeitsbereich des Objekts, das sie gerade ansehen.
  const setup = await (async () => {
    if (!selfManaged || user.role !== "VERWALTER") return null;
    const props = await db.property.findMany({
      where: { ...(await propertyWhereForVerwalter(user)), managementType: "WEG" },
      orderBy: { name: "asc" },
      take: 10,
      select: { id: true },
    });
    if (props.length === 0) return loadSetupStatus(null);
    const staende = await loadSetupStatusAlle(props.map((p) => p.id));
    return staende.find((s) => !s.fertig) ?? null;
  })();

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
      {/* Kurzmeldungen nach Server-Actions (`?flash=…`). Liest die URL-Parameter
          und braucht deshalb eine Suspense-Grenze. */}
      <Suspense fallback={null}>
        <ToastHost />
      </Suspense>
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
          {abo === "kulanz" && user.role === "VERWALTER" ? (
            // Zahlung überfällig: Stripe wiederholt sie noch, der Zugang bleibt.
            // Der Hinweis richtet sich an die, die es beheben können — schlägt
            // auch der letzte Versuch fehl, setzt der Webhook „canceled" und
            // die Sperrseite übernimmt.
            <Alert
              variant="warning"
              className="mb-4"
              action={
                <Link href="/verwaltung/abrechnung" className="font-semibold underline">
                  Zur Abrechnung
                </Link>
              }
            >
              Die letzte Abo-Zahlung ist fehlgeschlagen. Bitte aktualisieren Sie Ihre
              Zahlungsmethode, sonst wird der Zugang gesperrt.
            </Alert>
          ) : null}
          {setup && !setup.fertig ? (
            <SetupBanner
              erledigt={setup.erledigt}
              gesamt={setup.gesamt}
              titel={setup.naechster?.title ?? null}
            />
          ) : null}
          {/* Holt den Ankersprung nach, den der Browser beim gestreamten
              Erstaufruf verpasst — sonst führen Fehlermeldungen zwar auf die
              richtige Seite, aber nicht an die Stelle. */}
          <HashScroll />
          {/* Geführte Einrichtung — lädt nur, solange sie noch nicht gelaufen ist. */}
          <TourHost />
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
        {/* Nur wegportal24 – auf der B&W-Tür ist der Kunde Unternehmer und die
            Seite gibt es nicht. */}
        {isWegSaas() ? (
          <>
            <Link href="/widerruf" className="hover:text-brand-orange">
              Widerruf
            </Link>{" "}
            ·{" "}
            {/* § 312k Abs. 2 BGB: auch aus dem angemeldeten Bereich erreichbar.
                Die Seite selbst verlangt keine Anmeldung — eine Kündigung, die
                am Passwort hängt, ist nicht „leicht zugänglich“. */}
            <Link href="/kuendigen" className="hover:text-brand-orange">
              Verträge hier kündigen
            </Link>{" "}
            ·{" "}
          </>
        ) : null}
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
