import { redirect } from "next/navigation";
import { AuditLogView } from "@/components/audit-log-view";
import { AuditAccessError, auditAccessFor, type AuditParams } from "@/lib/audit-query";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditParams> }) {
  const user = await requireUser();
  const access = await auditAccessFor(user).catch((error: unknown) => {
    if (error instanceof AuditAccessError) redirect("/dashboard");
    throw error;
  });
  return <AuditLogView user={user} access={access} sp={await searchParams} base="/verwaltung/audit" />;
}
