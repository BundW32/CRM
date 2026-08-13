import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessHandover } from "@/lib/access";
import { AblageAlert } from "@/components/ablage-alert";
import { buttonClass, buttonSecondaryClass } from "@/components/ui";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import { ZaehlerClient } from "./ZaehlerClient";

export const dynamic = "force-dynamic";

export default async function ZaehlerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `ablage=fehler&grund=…` kommt von einem fehlgeschlagenen Zählerfoto. */
  searchParams: Promise<{ ablage?: string; grund?: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { id } = await params;
  const { ablage, grund } = await searchParams;
  if (!(await canVerwalterAccessHandover(verwalter, id))) notFound();

  const handover = await db.handover.findUnique({
    where: { id },
    include: { meters: { orderBy: { sortOrder: "asc" } } },
  });
  if (!handover) notFound();

  return (
    <div className="pb-10 animate-page-in">
      <StepHeader currentStep={4} backHref={`/uebergabe/${id}/checkliste`} handoverId={id} />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-5">
        <div>
          <h2 className="font-semibold text-white">Zählerstände erfassen</h2>
          <p className="text-sm text-white/60">Erfassen Sie alle Zählerstände und fotografieren Sie die Zähler.</p>
        </div>

        {ablage === "fehler" ? (
          <AblageAlert titel="Das Zählerfoto wurde nicht gespeichert." grund={grund}>
            Der Zählerstand selbst ist unverändert — bitte das Foto erneut aufnehmen.
          </AblageAlert>
        ) : null}

        <ZaehlerClient handoverId={id} initialMeters={handover.meters} />

        <div className="flex items-center justify-between gap-3 pt-2">
          <Link href="/uebergabe" className={buttonSecondaryClass}>
            Speichern &amp; schließen
          </Link>
          <Link href={`/uebergabe/${id}/unterschriften`} className={buttonClass}>
            Weiter: Unterschriften →
          </Link>
        </div>
      </div>
    </div>
  );
}
