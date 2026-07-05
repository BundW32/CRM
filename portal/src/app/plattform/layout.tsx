import Link from "next/link";
import { AUDIT, logAudit } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/platform";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/plattform", label: "Übersicht" },
  { href: "/plattform/organisationen", label: "Verwaltungen" },
  { href: "/plattform/rechnungen", label: "Rechnungen" },
  { href: "/plattform/statistik", label: "Auswertungen" },
  { href: "/plattform/audit", label: "Audit-Log" },
];

// Eigenes Layout für den Betreiber-Bereich – bewusst OHNE Mandanten-Branding.
// Der Guard steht hier UND in jeder Server-Action (der Proxy gated keine Pfade).
export default async function PlattformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requirePlatformAdmin();
  // Zugriff einmal pro Aufruf protokollieren (Layouts laufen nicht bei jeder
  // Soft-Navigation neu → wenig Rauschen).
  await logAudit({ actorId: admin.id, action: AUDIT.PLATFORM_ACCESS, ip: await getClientIp() });

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 text-gray-900">
      <header className="bg-shell-2 text-white shadow-lg">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-orange">
            <span className="rounded bg-brand-orange px-1.5 py-0.5 text-brand-green-dark">B&amp;W</span>
            Plattform
          </span>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-gray-300 hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="ml-auto text-xs text-gray-400 hover:text-white">
            ← Zurück zum Portal
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="px-4 py-6 text-center text-xs text-gray-400">
        Interner Betreiber-Bereich – vertraulich.
      </footer>
    </div>
  );
}
