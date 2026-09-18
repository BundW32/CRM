import { AuditLogView } from "@/components/audit-log-view";
import { auditAccessFor, type AuditParams } from "@/lib/audit-query";
import { requirePlatformAdmin } from "@/lib/platform";

export const dynamic = "force-dynamic";
export default async function PlatformAuditPage({ searchParams }: { searchParams: Promise<AuditParams> }) {
  const user = await requirePlatformAdmin();
  return <AuditLogView user={user} access={await auditAccessFor(user, true)} sp={await searchParams} base="/plattform/audit" />;
}
