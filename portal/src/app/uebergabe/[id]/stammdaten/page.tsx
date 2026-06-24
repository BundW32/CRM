import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { inputClass, buttonClass } from "@/components/ui";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import { saveStammdaten } from "./actions";
import { KeysSection } from "./KeysSection";

export const dynamic = "force-dynamic";

const typeLabels = { EINZUG: "Einzug", AUSZUG: "Auszug", ZWISCHENZUSTAND: "Zwischenzustand" };

export default async function StammdatenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireVerwalter();
  const { id } = await params;

  const handover = await db.handover.findUnique({
    where: { id },
    include: { unit: { include: { property: true } } },
  });
  if (!handover) notFound();

  const dateStr = handover.handoverDate.toISOString().split("T")[0];

  return (
    <div className="pb-10 animate-page-in">
      <StepHeader currentStep={1} title="Stammdaten" backHref="/verwaltung" />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-5">
        <div className="rounded-xl bg-brand-green-dark/10 border border-brand-green/20 px-4 py-3 text-sm text-gray-700">
          <span className="font-medium">{handover.unit.property.name}</span> · {handover.unit.label}
        </div>

        <form action={saveStammdaten} className="space-y-5">
          <input type="hidden" name="id" value={id} />

          {/* Übergabeart + Datum */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Übergabe</h2>
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">Art</span>
              <div className="flex flex-wrap gap-4">
                {(["EINZUG", "AUSZUG", "ZWISCHENZUSTAND"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      defaultChecked={handover.type === t}
                      className="accent-brand-orange"
                    />
                    <span className="text-sm text-gray-700">{typeLabels[t]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
              <input type="date" name="handoverDate" defaultValue={dateStr} className={inputClass} />
            </div>
          </div>

          {/* Mieterdaten */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Mieter</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" name="tenantName" defaultValue={handover.tenantName ?? ""} className={inputClass} placeholder="Vor- und Nachname" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input type="email" name="tenantEmail" defaultValue={handover.tenantEmail ?? ""} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input type="tel" name="tenantPhone" defaultValue={handover.tenantPhone ?? ""} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Neue Adresse</label>
                <input type="text" name="tenantAddress" defaultValue={handover.tenantAddress ?? ""} className={inputClass} placeholder="Straße, PLZ Ort" />
              </div>
            </div>
          </div>

          {/* Eigentümerdaten */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Eigentümer</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" name="ownerName" defaultValue={handover.ownerName ?? ""} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input type="email" name="ownerEmail" defaultValue={handover.ownerEmail ?? ""} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input type="tel" name="ownerPhone" defaultValue={handover.ownerPhone ?? ""} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Verwalter */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Verwalter / Protokollführer</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" name="managerName" defaultValue={handover.managerName ?? ""} required className={inputClass} placeholder="Protokollführer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input type="email" name="managerEmail" defaultValue={handover.managerEmail ?? ""} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input type="tel" name="managerPhone" defaultValue={handover.managerPhone ?? ""} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Schlüssel */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Schlüssel &amp; Stellplatz</h2>
            <KeysSection
              initial={{
                keysApartment: handover.keysApartment,
                keysMailbox: handover.keysMailbox,
                keysBasement: handover.keysBasement,
                keysGarage: handover.keysGarage,
                keysOther: handover.keysOther,
              }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stellplatz Nr.</label>
                <input type="text" name="parkingSpace" defaultValue={handover.parkingSpace ?? ""} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kellerabteil Nr.</label>
                <input type="text" name="cellarSpace" defaultValue={handover.cellarSpace ?? ""} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className={buttonClass}>
              Weiter: Räume →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
