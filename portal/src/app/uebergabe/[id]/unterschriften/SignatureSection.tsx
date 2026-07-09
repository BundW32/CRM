"use client";

import { useState } from "react";
import { SignaturePad } from "@/app/uebergabe/_components/SignaturePad";
import { finalizeHandover } from "./actions";

export function SignatureSection({
  handoverId,
  tenantName,
  tenant2Name,
  managerName,
  managerCompany,
  initialTenantSig,
  initialTenant2Sig,
  initialManagerSig,
}: {
  handoverId: string;
  tenantName: string | null;
  tenant2Name: string | null;
  managerName: string | null;
  managerCompany: string | null;
  initialTenantSig?: string | null;
  initialTenant2Sig?: string | null;
  initialManagerSig?: string | null;
}) {
  const [tenantSig, setTenantSig] = useState<string | null>(initialTenantSig ?? null);
  const [tenant2Sig, setTenant2Sig] = useState<string | null>(initialTenant2Sig ?? null);
  const [managerSig, setManagerSig] = useState<string | null>(initialManagerSig ?? null);

  const managerLabel = managerCompany
    ? `Unterschrift Protokollführer (${managerCompany})`
    : "Unterschrift Protokollführer";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-white">Unterschriften</h2>
        <p className="text-sm text-white/60">Bitte unterschreiben Sie mit dem Finger oder der Maus.</p>
      </div>

      <form action={finalizeHandover} className="space-y-5">
        <input type="hidden" name="id" value={handoverId} />
        <input type="hidden" name="tenantSignature" value={tenantSig ?? ""} />
        <input type="hidden" name="tenant2Signature" value={tenant2Sig ?? ""} />
        <input type="hidden" name="managerSignature" value={managerSig ?? ""} />

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <SignaturePad
            label="Unterschrift Mieter"
            signerName={tenantName ?? undefined}
            onChange={setTenantSig}
            initialValue={initialTenantSig}
          />
        </div>

        {tenant2Name && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <SignaturePad
              label="Unterschrift 2. Mieter"
              signerName={tenant2Name}
              onChange={setTenant2Sig}
              initialValue={initialTenant2Sig}
            />
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <SignaturePad
            label={managerLabel}
            signerName={managerName ?? undefined}
            onChange={setManagerSig}
            initialValue={initialManagerSig}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-brand-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-green-dark active:scale-[0.98] active:shadow-none"
          >
            Abschließen und PDF erstellen →
          </button>
        </div>
      </form>
    </div>
  );
}
