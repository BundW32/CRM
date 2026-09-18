import Link from "next/link";
import { BookOpen } from "lucide-react";
import { PageTitle, cardSurfaceClass } from "@/components/ui";
import { isSelfManaged } from "@/lib/access";
import { BEREICHE, kapitelFuer } from "@/lib/hilfe/handbuch";
import { getOrganization, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Das Handbuch: eine Übersicht der Kapitel, gegliedert nach Bereich, gefiltert
// auf das, was die lesende Person im Portal überhaupt sieht. Ein Mieter
// bekommt keine Jahresabrechnung erklärt, die er nie öffnet; ein Verwalter
// einer selbstverwalteten WEG keine Vorgänge, die es in seiner Tür nicht gibt.
export default async function HilfePage() {
  const user = await requireUser();
  const org = await getOrganization();
  const kapitel = kapitelFuer({ role: user.role, selfManaged: isSelfManaged(org) });

  return (
    <>
      <PageTitle>Handbuch</PageTitle>
      <p className="mb-6 max-w-prose text-sm text-white/80">
        Schritt für Schritt erklärt: Was Sie wo finden, in welcher Reihenfolge Sie
        vorgehen und was das Programm dabei prüft. Die Kapitel sind auf Ihre Rolle
        zugeschnitten. Fehlt etwas, melden Sie es über die Hilfe-Lasche am
        Bildschirmrand.
      </p>

      <div className="space-y-8">
        {BEREICHE.map((bereich) => {
          const eigene = kapitel.filter((k) => k.bereich === bereich.key);
          if (eigene.length === 0) return null;
          return (
            <section key={bereich.key}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/60">
                {bereich.titel}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {eigene.map((k) => (
                  <Link
                    key={k.slug}
                    href={`/hilfe/${k.slug}`}
                    className={`group ${cardSurfaceClass} p-5 transition hover:shadow-md`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange-light text-brand-orange-dark">
                        <BookOpen className="h-[18px] w-[18px]" />
                      </span>
                      <h3 className="min-w-0 flex-1 text-base font-semibold text-gray-900">
                        {k.titel}
                      </h3>
                      <span className="text-gray-300 transition group-hover:text-brand-orange">→</span>
                    </div>
                    {k.kurz ? <p className="mt-2 text-sm text-gray-600">{k.kurz}</p> : null}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
