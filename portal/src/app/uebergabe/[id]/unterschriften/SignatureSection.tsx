"use client";

import { useState } from "react";
import { SignaturePad } from "@/app/uebergabe/_components/SignaturePad";
import { finalizeHandover } from "./actions";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";

export function SignatureSection({
  handoverId,
  backHref,
  tenantName,
  managerName,
  initialTenantSig,
  initialManagerSig,
}: {
  handoverId: string;
  backHref: string;
  tenantName: string | null;
  managerName: string | null;
  initialTenantSig?: string | null;
  initialManagerSig?: string | null;
}) {
  const [tenantSig, setTenantSig] = useState<string | null>(initialTenantSig ?? null);
  const [managerSig, setManagerSig] = useState<string | null>(initialManagerSig ?? null);

  return (
    <div className="pb-10">
      <StepHeader currentStep={5} title="Unterschriften" backHref={backHref} />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-5">
        <div>
          <h2 className="font-semibold text-white">Unterschriften</h2>
          <p className="text-sm text-white/60">Bitte unterschreiben Sie mit dem Finger oder der Maus.</p>
        </div>

        <form
          action={finalizeHandover}
          className="space-y-5"
        >
          <input type="hidden" name="id" value={handoverId} />
          <input type="hidden" name="tenantSignature" value={tenantSig ?? ""} />
          <input type="hidden" name="managerSignature" value={managerSig ?? ""} />

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <SignaturePad
              label="Unterschrift Mieter"
              signerName={tenantName ?? undefined}
              onChange={setTenantSig}
              initialValue={initialTenantSig}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <SignaturePad
              label="Unterschrift Verwalter / Eigentümer"
              signerName={managerName ?? undefined}
              onChange={setManagerSig}
              initialValue={initialManagerSig}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-brand-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-green-dark active:scale-95 active:shadow-none"
            >
              Abschließen und PDF erstellen →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
