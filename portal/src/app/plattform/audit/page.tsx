import { PageTitle } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function AuditPlaceholder() {
  await requirePlatformAdmin();
  return (
    <>
      <PageTitle>Audit-Log</PageTitle>
      <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
        Wird in Kürze verfügbar.
      </p>
    </>
  );
}
