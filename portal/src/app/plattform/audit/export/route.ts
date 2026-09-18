import { getUser } from "@/lib/session";
import { auditExport } from "@/lib/audit-export";
import { AuditAccessError } from "@/lib/audit-query";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return new Response("Anmeldung erforderlich.", { status: 401 });
  try { return await auditExport(user, request, true); }
  catch (error) {
    if (error instanceof AuditAccessError) return new Response(error.message, { status: 403 });
    throw error;
  }
}
