import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { HandbuchInhalt } from "@/components/handbuch";
import { Card, PageTitle } from "@/components/ui";
import { isSelfManaged } from "@/lib/access";
import { BEREICHE, kapitelFuer, kapitelInhalt, kapitelNachSlug } from "@/lib/hilfe/handbuch";
import { getOrganization, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Ein Kapitel des Handbuchs. Ein direkter Link führt immer hin, auch wenn das
// Kapitel für die Rolle der lesenden Person nicht in der Übersicht steht —
// das Handbuch enthält keine Geheimnisse. Vor und Zurück laufen dagegen nur
// durch die eigenen Kapitel, sonst blätterte ein Mieter in die Buchhaltung.
export default async function HilfeKapitelPage({
  params,
}: {
  params: Promise<{ kapitel: string }>;
}) {
  const user = await requireUser();
  const { kapitel: slug } = await params;
  const kapitel = kapitelNachSlug(slug);
  if (!kapitel) notFound();

  const org = await getOrganization();
  const eigene = kapitelFuer({ role: user.role, selfManaged: isSelfManaged(org) });
  const pos = eigene.findIndex((k) => k.slug === kapitel.slug);
  const zurueck = pos > 0 ? eigene[pos - 1] : null;
  const weiter = pos >= 0 && pos < eigene.length - 1 ? eigene[pos + 1] : null;
  const bereich = BEREICHE.find((b) => b.key === kapitel.bereich);
  const { bloecke, gliederung } = kapitelInhalt(kapitel);

  return (
    <>
      <PageTitle back={{ href: "/hilfe", label: "Handbuch" }}>{kapitel.titel}</PageTitle>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <Card>
          {bereich ? (
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {bereich.titel}
            </p>
          ) : null}
          {kapitel.kurz ? <p className="mb-5 text-base text-gray-600">{kapitel.kurz}</p> : null}
          <HandbuchInhalt bloecke={bloecke} />

          <nav className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-sm">
            {zurueck ? (
              <Link href={`/hilfe/${zurueck.slug}`} className="inline-flex items-center gap-1.5 text-brand-green hover:underline">
                <ArrowLeft className="h-4 w-4" /> {zurueck.titel}
              </Link>
            ) : (
              <span />
            )}
            {weiter ? (
              <Link href={`/hilfe/${weiter.slug}`} className="inline-flex items-center gap-1.5 text-brand-green hover:underline">
                {weiter.titel} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </nav>
        </Card>

        {gliederung.length > 1 ? (
          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                In diesem Kapitel
              </p>
              <ul className="space-y-1.5">
                {gliederung.map((g) => (
                  <li key={g.id} className={g.ebene === 3 ? "pl-3" : ""}>
                    <a href={`#${g.id}`} className="text-white/85 hover:text-white hover:underline">
                      {g.titel}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}
