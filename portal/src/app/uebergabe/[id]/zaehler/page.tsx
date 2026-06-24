import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { buttonClass, buttonSecondaryClass } from "@/components/ui";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import { ZaehlerClient } from "./ZaehlerClient";

export const dynamic = "force-dynamic";

export default async function ZaehlerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireVerwalter();
  const { id } = await params;

  const handover = await db.handover.findUnique({
    where: { id },
    include: { meters: { orderBy: { sortOrder: "asc" } } },
  });
  if (!handover) notFound();

  return (
    <div className="pb-10 animate-page-in">
      <StepHeader currentStep={4} title="Zählerstände" backHref={`/uebergabe/${id}/checkliste`} />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-5">
        <div>
          <h2 className="font-semibold text-white">Zählerstände erfassen</h2>
          <p className="text-sm text-white/60">Erfassen Sie alle Zählerstände und fotografieren Sie die Zähler.</p>
        </div>

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
