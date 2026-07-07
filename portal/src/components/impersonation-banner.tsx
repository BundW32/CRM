import { stopImpersonation } from "@/app/(portal)/impersonation-actions";

// Deutlich sichtbares Banner, während ein Betreiber „als Kunde" unterwegs ist.
export function ImpersonationBanner({
  customerName,
  adminName,
}: {
  customerName: string;
  adminName: string;
}) {
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
      <span>
        Support-Modus: Sie sehen das Portal als <strong>{customerName}</strong> ({adminName}).
      </span>
      <form action={stopImpersonation}>
        <button
          type="submit"
          className="rounded bg-amber-950 px-3 py-0.5 text-xs font-semibold text-amber-50 hover:bg-amber-900"
        >
          Support-Modus beenden
        </button>
      </form>
    </div>
  );
}
