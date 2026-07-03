import { PageTitle } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function OrganisationenPlaceholder() {
  await requirePlatformAdmin();
  return (
    <>
      <PageTitle>Verwaltungen</PageTitle>
      <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
        Wird in Kürze verfügbar.
      </p>
    </>
  );
}
