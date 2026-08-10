import { Suspense } from "react";
import { ToastHost } from "@/components/toast-host";
import { BackLink } from "@/components/ui";
import { AUDIT, logAudit } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/platform";
import { getClientIp } from "@/lib/rate-limit";
import { PlattformNav } from "./plattform-nav";

export const dynamic = "force-dynamic";

// Eigenes Layout für den Betreiber-Bereich. Grob am Portal-Look (warmer Shell,
// schwebende Header-Leiste, weiße Karten), aber mit eigenem, nüchternem Admin-
// Akzent (grün + „Betreiber"-Tag) statt Mandanten-Branding. Der Guard steht hier
// UND in jeder Server-Action (der Proxy gated keine Pfade).
export default async function PlattformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requirePlatformAdmin();
  // Zugriff einmal pro Aufruf protokollieren (Layouts laufen nicht bei jeder
  // Soft-Navigation neu → wenig Rauschen).
  await logAudit({ actorId: admin.id, action: AUDIT.PLATFORM_ACCESS, ip: await getClientIp() });

  return (
    <div className="flex min-h-screen flex-col">
      {/* Kurzmeldungen nach Server-Actions (`?flash=…`) — wie in der Portal-
          Shell. Liest die URL-Parameter und braucht deshalb eine Suspense-
          Grenze. Ohne den Host verpuffte jede Flash-Rückmeldung im
          Betreiber-Bereich stumm. */}
      <Suspense fallback={null}>
        <ToastHost />
      </Suspense>
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/95 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur sm:px-4">
            <span className="flex shrink-0 items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-green">
              <span className="rounded-md bg-brand-orange px-1.5 py-0.5 text-brand-green-dark">
                B&amp;W
              </span>
              <span className="hidden sm:inline">Plattform</span>
              <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-green">
                Betreiber
              </span>
            </span>

            <PlattformNav />

            <div className="shrink-0">
              <BackLink href="/dashboard" tone="onLight">
                <span className="hidden sm:inline">Zum Portal</span>
              </BackLink>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-4 sm:py-8">{children}</main>
      <footer className="px-4 py-6 text-center text-xs text-gray-400">
        Interner Betreiber-Bereich – vertraulich.
      </footer>
    </div>
  );
}
