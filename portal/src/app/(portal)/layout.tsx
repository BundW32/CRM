import Link from "next/link";
import { logout } from "@/app/login/actions";
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
  const nav = navByRole[user.role];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-bold text-blue-900">
            B&amp;W Kundenportal
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">
              {user.name}
              <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                {roleLabels[user.role]}
              </span>
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-1 pb-2">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
        B&amp;W Immobilien Management UG (haftungsbeschränkt) · Goethestraße 42,
        45964 Gladbeck · info@bundwimmobilien.de
      </footer>
    </div>
  );
}
