import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// Aktions-Konstanten – zentral definiert, um Tippfehler zu vermeiden.
export const AUDIT = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  PASSWORD_RESET_REQUEST: "PASSWORD_RESET_REQUEST",
  USER_ANONYMIZED: "USER_ANONYMIZED",
  TICKET_CLOSED: "TICKET_CLOSED",
  TICKET_REOPENED: "TICKET_REOPENED",
  TICKET_EXTERNAL_RELEASED: "TICKET_EXTERNAL_RELEASED",
  DSGVO_EXPORT: "DSGVO_EXPORT",
} as const;

// Schreibt einen Audit-Log-Eintrag. Wirft nie – ein Logging-Fehler darf den
// Hauptfluss nicht unterbrechen.
export async function logAudit(params: {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        meta: (params.meta ?? undefined) as Prisma.InputJsonObject | undefined,
        ip: params.ip ?? null,
      },
    });
  } catch {
    // intentionally silent
  }
}
