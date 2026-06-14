import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/login/actions";
import { BwLogoCompact } from "@/components/logo";
import { NavLink } from "@/components/nav";
import { roleLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";

const navByRole = {
  MIETER: [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/vorgaenge", label: "Meine Vorgänge" },
    { href: "/vorgaenge/neu", label: "Schaden melden" },
    { href: "/dokumente", label: "Dokumente" },
    { href: "/aushaenge", label: "Aushänge" },
    { href: "/konto", label: "Konto" },
  ],
  EIGENTUEMER: [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/vorgaenge", label: "Vorgänge" },
    { href: "/vorgaenge/neu", label: "Anfrage stellen" },
    { href: "/statistiken", label: "Statistiken" },
    { href: "/dokumente", label: "Dokumente" },
    { href: "/aushaenge", label: "Aushänge" },
    { href: "/konto", label: "Konto" },
  ],
  VERWALTER: [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/vorgaenge", label: "Vorgänge" },
    { href: "/dokumente", label: "Dokumente" },
    { href: "/aushaenge", label: "Aushänge" },
    { href: "/statistiken", label: "Statistiken" },
    { href: "/verwaltung/objekte", label: "Objekte" },
    { href: "/verwaltung/nutzer", label: "Nutzer" },
    { href: "/verwaltung/objekte/neu", label: "+ Objekt anlegen" },
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
  const nav = navByRole[user.role];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-2xl border border-white/10 bg-white/95 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur sm:px-4">
          <Link href="/dashboard" className="shrink-0">
            <BwLogoCompact />
          </Link>
          <nav className="min-w-0 flex-1 overflow-x-auto">
            <ul className="flex items-center gap-1">
              {nav.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </ul>
          </nav>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <span className="hidden text-gray-600 md:inline">
              {user.name}
              <span className="ml-2 rounded-full bg-brand-orange-light px-2 py-0.5 text-xs font-medium text-brand-orange-dark">
                {roleLabels[user.role]}
              </span>
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="mt-4 px-4 py-6 text-center text-xs text-gray-400">
        B&amp;W Immobilien Management UG (haftungsbeschränkt) · Goethestraße 42,
        45964 Gladbeck ·{" "}
        <a href="mailto:info@bundwimmobilien.de" className="hover:text-brand-orange">
          info@bundwimmobilien.de
        </a>
      </footer>
    </div>
  );
}
