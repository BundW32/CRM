import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessHandover } from "@/lib/access";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import { StammdatenForm } from "./StammdatenForm";

export const dynamic = "force-dynamic";

function dateInput(d: Date | null): string {
  return d ? d.toISOString().split("T")[0] : "";
}
function numInput(n: number | null): string {
  return n != null ? String(n).replace(".", ",") : "";
}

export default async function StammdatenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { id } = await params;
  if (!(await canVerwalterAccessHandover(verwalter, id))) notFound();

  const handover = await db.handover.findUnique({
    where: { id },
    include: { unit: { include: { property: true } } },
  });
  if (!handover) notFound();

  return (
    <div className="pb-10 animate-page-in">
      <StepHeader currentStep={1} title="Stammdaten" backHref="/uebergabe" handoverId={id} />

      <div className="mx-auto max-w-2xl px-4 pt-6">
        <StammdatenForm
          id={id}
          property={{
            name: handover.unit.property.name,
            street: handover.unit.property.street,
            zip: handover.unit.property.zip,
            city: handover.unit.property.city,
          }}
          unit={{ label: handover.unit.label, floor: handover.unit.floor }}
          initial={{
            type: handover.type,
            handoverDate: dateInput(handover.handoverDate),
            moveDate: dateInput(handover.moveDate),
            livingArea: numInput(handover.livingArea),
            roomCount: numInput(handover.roomCount),
            personCount: handover.personCount != null ? String(handover.personCount) : "",
            tenantName: handover.tenantName ?? "",
            tenantEmail: handover.tenantEmail ?? "",
            tenantPhone: handover.tenantPhone ?? "",
            tenantAddress: handover.tenantAddress ?? "",
            tenantBirthDate: dateInput(handover.tenantBirthDate),
            tenant2Name: handover.tenant2Name ?? "",
            tenant2BirthDate: dateInput(handover.tenant2BirthDate),
            ownerName: handover.ownerName ?? "",
            ownerEmail: handover.ownerEmail ?? "",
            ownerPhone: handover.ownerPhone ?? "",
            managerCompany: handover.managerCompany ?? "B&W Immobilien Management UG",
            managerName: handover.managerName ?? "",
            managerEmail: handover.managerEmail ?? "",
            managerPhone: handover.managerPhone ?? "",
            keysApartment: handover.keysApartment,
            keysMailbox: handover.keysMailbox,
            keysBasement: handover.keysBasement,
            keysGarage: handover.keysGarage,
            keysOther: handover.keysOther,
            parkingSpace: handover.parkingSpace ?? "",
            cellarSpace: handover.cellarSpace ?? "",
          }}
        />
      </div>
    </div>
  );
}
