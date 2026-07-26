import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessHandover } from "@/lib/access";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import { GENERAL_CHECKLIST_SECTIONS } from "@/lib/handover-checks";
import { ChecklisteForm } from "./ChecklisteForm";

export const dynamic = "force-dynamic";

export default async function ChecklistePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { id } = await params;
  if (!(await canVerwalterAccessHandover(verwalter, id))) notFound();

  const handover = await db.handover.findUnique({ where: { id } });
  if (!handover) notFound();

  const saved = (handover.checklist ?? {}) as Record<string, string>;

  return (
    <div className="pb-10 animate-page-in">
      <StepHeader currentStep={3} backHref={`/uebergabe/${id}/raeume`} handoverId={id} />
      <ChecklisteForm
        handoverId={id}
        sections={GENERAL_CHECKLIST_SECTIONS}
        saved={saved}
        generalNotes={handover.generalNotes}
        agreements={handover.agreements}
      />
    </div>
  );
}
