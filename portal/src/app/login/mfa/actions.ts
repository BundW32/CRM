"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AUDIT, logAudit } from "@/lib/audit";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { loeseRecoveryCodeEin } from "@/lib/mfa";
import { checkRateLimit, getClientIp, resetRateLimit } from "@/lib/rate-limit";
import { clearMfaPending, createSession, readMfaPending } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";

// Zweiter Faktor prüfen und erst DANN die Sitzung anlegen. Das Passwort ist zu
// diesem Zeitpunkt bereits geprüft (login/actions.ts) — hier entscheidet sich,
// ob aus dem Zwischenschritt eine Anmeldung wird.
export async function verifyMfa(formData: FormData) {
  const userId = await readMfaPending();
  if (!userId) redirect("/login");

  const ip = await getClientIp();

  // Fail-closed wie die Passwortprüfung: Wer den zweiten Faktor durchprobieren
  // will, hat das Passwort schon — genau dann darf die Zählung nicht offen
  // stehen. Der Schlüssel hängt am Konto, nicht an der IP: Das Konto ist das
  // Angriffsziel.
  const limitKey = `mfa:${userId}`;
  if (!(await checkRateLimit(limitKey, 5, 900, { failClosed: true }))) {
    redirect("/login/mfa?fehler=limit");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { organization: { select: { active: true } } },
  });
  // Zwischenzeitlich deaktiviert oder MFA abgeschaltet → sauber zur Anmeldung.
  if (!user || !user.active || !user.totpEnabledAt || !user.totpSecret) {
    await clearMfaPending();
    redirect("/login");
  }

  const eingabe = String(formData.get("code") ?? "").trim();
  const istTotp = /^\d{6}$/.test(eingabe.replace(/\s/g, ""));

  if (istTotp) {
    if (!verifyTotp(decryptSecret(user.totpSecret), eingabe)) {
      await logAudit({ actorId: user.id, action: AUDIT.MFA_FAILED, ip });
      redirect("/login/mfa?fehler=1");
    }
  } else {
    // Wiederherstellungscode: genau einmal einlösbar, der Rest wird
    // zurückgeschrieben. Das Audit-Log hält den Notfallweg fest — zehnmal
    // „Recovery" statt App ist ein Signal, das der Betreiber sehen soll.
    const rest = loeseRecoveryCodeEin(user.mfaRecoveryCodes, eingabe);
    if (rest === null) {
      await logAudit({ actorId: user.id, action: AUDIT.MFA_FAILED, ip });
      redirect("/login/mfa?fehler=1");
    }
    await db.user.update({ where: { id: user.id }, data: { mfaRecoveryCodes: rest } });
    await logAudit({
      actorId: user.id,
      action: AUDIT.MFA_RECOVERY_USED,
      meta: { verbleibend: rest.length },
      ip,
    });
  }

  await resetRateLimit(limitKey);
  await clearMfaPending();
  await logAudit({ actorId: user.id, action: AUDIT.LOGIN_SUCCESS, ip });
  await createSession(user.id);
  revalidatePath("/", "layout");

  if (user.mustChangePassword) redirect("/passwort-festlegen");
  redirect("/dashboard");
}
