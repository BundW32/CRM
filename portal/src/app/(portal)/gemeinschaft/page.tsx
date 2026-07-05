import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { isSelfManaged } from "@/lib/access";
import { getOrganization, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GemeinschaftPlaceholder() {
  const user = await requireUser();
  if (user.role !== "VERWALTER" && user.role !== "EIGENTUEMER") redirect("/dashboard");
  if (!isSelfManaged(await getOrganization())) redirect("/dashboard");

  return (
    <>
      <PageTitle>Gemeinschaft</PageTitle>
      <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
        Die Transparenz-/Gemeinschaftsansicht wird in Kürze verfügbar.
      </p>
    </>
  );
}
