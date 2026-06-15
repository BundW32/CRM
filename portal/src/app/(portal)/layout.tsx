import Link from "next/link";
import { redirect } from "next/navigation";
import { InstallHint } from "@/components/install-hint";
import { PortalHeader } from "@/components/portal-header";
import { ownsWegProperty } from "@/lib/access";
import { roleLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";

const navByRole = {
  MIETER: [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/vorgaenge", label: "Meine Vorgänge" },
    { href: "/nachrichten", label: "Nachrichten" },
    { href: "/dokumente", label: "Dokumente" },
    { href: "/zaehler", label: "Zähler" },
    { href: "/aushaenge", label: "Aushänge" },
    { href: "/konto", label: "Konto" },
  ],
  EIGENTUEMER: [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/vorgaenge", label: "Vorgänge" },
    { href: "/beschluesse", label: "Beschlüsse" },
    { href: "/nachrichten", label: "Nachrichten" },
    { href: "/dokumente", label: "Dokumente" },
    { href: "/zaehler", label: "Zähler" },
    { href: "/aushaenge", label: "Aushänge" },
    { href: "/konto", label: "Konto" },
  ],
  VERWALTER: [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/vorgaenge", label: "Vorgänge" },
    { href: "/nachrichten", label: "Nachrichten" },
    { href: "/dokumente", label: "Dokumente" },
    { href: "/aushaenge", label: "Aushänge" },
    { href: "/zaehler", label: "Zähler" },
    { href: "/beschluesse", label: "Beschlüsse" },
    { href: "/verwaltung", label: "Verwaltung" },
    { href: "/konto", label: "Konto" },
  ],
  HANDWERKER: [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/vorgaenge", label: "Meine Aufträge" },
    { href: "/konto", label: "Konto" },
  ],
} as const;

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/passwort-festlegen");
  let nav: ReadonlyArray<{ href: string; label: string }> = navByRole[user.role];
  // Eigentümer ohne WEG-Objekt sehen keine Beschlüsse
  if (user.role === "EIGENTUEMER" && !(await ownsWegProperty(user.id))) {
    nav = nav.filter((item) => item.href !== "/beschluesse");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PortalHeader nav={nav} userName={user.name} roleLabel={roleLabels[user.role]} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="mt-4 px-4 py-6 text-center text-xs text-gray-400">
        B&amp;W Immobilien Management UG (haftungsbeschränkt) · Goethestraße 42,
        45964 Gladbeck ·{" "}
        <a href="mailto:info@bundwimmobilien.de" className="hover:text-brand-orange">
          info@bundwimmobilien.de
        </a>
        <br />
        <Link href="/impressum" className="hover:text-brand-orange">
          Impressum
        </Link>{" "}
        ·{" "}
        <Link href="/datenschutz" className="hover:text-brand-orange">
          Datenschutz
        </Link>
      </footer>
      <InstallHint />
    </div>
  );
}
