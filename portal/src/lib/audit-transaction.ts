import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isPlatformAdminUser } from "@/lib/platform-admin";

export type AuditActor = { id: string; name: string; organizationId: string; email?: string | null; isPlatformAdmin?: boolean };

/** Context is transaction-local: pooled connections cannot leak one customer's actor. */
export async function setAuditContext(tx: Prisma.TransactionClient, actor: AuditActor) {
  // Loaded lazily: session.ts itself uses the ordinary read client.
  const { getSession } = await import("@/lib/session");
  const session = await getSession();
  const real = session.impersonating && session.user?.id === actor.id
    ? session.realUser ?? actor : actor;
  await setAuditDatabaseContext(tx, {
    actorId: real.id, actorName: real.name, organizationId: actor.organizationId,
    effectiveActorId: actor.id,
    actorKind: real.id !== actor.id || isPlatformAdminUser({ ...real, email: real.email ?? null }) ? "SUPPORT" : "USER",
    requestId: randomUUID(),
    securityRetentionDays: Number(process.env.AUDIT_SECURITY_RETENTION_DAYS) || undefined,
  });
}

/** Also used by jobs and database tests; never populated from client form fields. */
export async function setAuditDatabaseContext(tx: Prisma.TransactionClient, context: {
  actorId?: string; actorName?: string; organizationId?: string;
  effectiveActorId?: string; actorKind: "USER" | "SUPPORT" | "SYSTEM" | "CRAFTSMAN";
  requestId?: string;
  securityRetentionDays?: number;
}) {
  const value = JSON.stringify(context);
  await tx.$queryRaw`SELECT set_config('app.audit_context', ${value}, true)`;
}

/** Database triggers write the field changes in this same transaction. */
export async function auditMutation<T>(
  actor: AuditActor | null,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
): Promise<T> {
  return db.$transaction(async (tx) => {
    if (actor) await setAuditContext(tx, actor);
    return write(tx);
  }, options);
}
