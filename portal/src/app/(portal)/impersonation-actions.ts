"use server";

import { redirect } from "next/navigation";
import { AUDIT, logAudit } from "@/lib/audit";
import { clearImpersonation, getSession } from "@/lib/session";
import { getClientIp } from "@/lib/rate-limit";

// Beendet die Support-Impersonation und kehrt in den Betreiber-Bereich zurück.
export async function stopImpersonation() {
  const { realUser, user, impersonating } = await getSession();
  if (impersonating && realUser) {
    await logAudit({
      actorId: realUser.id,
      action: AUDIT.PLATFORM_IMPERSONATE_STOP,
      targetType: "User",
      targetId: user?.id,
      ip: await getClientIp(),
    });
  }
  await clearImpersonation();
  redirect("/plattform/organisationen");
}
