import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import { SignatureSection } from "./SignatureSection";

export const dynamic = "force-dynamic";

const typeLabels = { EINZUG: "Einzug", AUSZUG: "Auszug", ZWISCHENZUSTAND: "Zwischenzustand" };

export default async function UnterschriftenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireVerwalter();
  const { id } = await params;

  const handover = await db.handover.findUnique({
    where: { id },
    include: {
      unit: { include: { property: true } },
      rooms: { include: { _count: { select: { photos: true } } } },
      meters: true,
    },
  });
  if (!handover) notFound();

  const dateFormatted = handover.handoverDate.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="pb-10">
      <StepHeader currentStep={5} title="Unterschriften" backHref={`/uebergabe/${id}/zaehler`} />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-5">
        {/* Zusammenfassung vor den Unterschriften */}
        <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80 space-y-1">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span><strong>Typ:</strong> {typeLabels[handover.type]}</span>
            <span><strong>Datum:</strong> {dateFormatted}</span>
            <span><strong>Einheit:</strong> {handover.unit.property.name} · {handover.unit.label}</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {handover.tenantName && <span><strong>Mieter:</strong> {handover.tenantName}</span>}
            {handover.ownerName && <span><strong>Eigentümer:</strong> {handover.ownerName}</span>}
            <span><strong>Räume:</strong> {handover.rooms.length}</span>
            <span><strong>Zähler:</strong> {handover.meters.length}</span>
          </div>
        </div>

        <SignatureSection
          handoverId={id}
          tenantName={handover.tenantName}
          managerName={handover.managerName}
          initialTenantSig={handover.tenantSignature}
          initialManagerSig={handover.managerSignature}
        />
      </div>
    </div>
  );
}
