"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AUDIT, logAudit } from "@/lib/audit";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { hashRecoveryCode, neueRecoveryCodes } from "@/lib/mfa";
import { merkeRecoveryCodes } from "@/lib/mfa-anzeige";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { generateTotpSecret, verifyTotp } from "@/lib/totp";

// Die Einrichtung schreibt an das EIGENE Konto — niemals an ein fremdes.
// Während einer Impersonation ist `user` der Kunde: Eine Einrichtung dort
// würde das Secret des Betreibers auf dem Kundenkonto hinterlegen und den
// Kunden beim nächsten Login aussperren. Deshalb der harte Riegel.
async function requireEchtesKonto() {
  const session = await getSession();
  if (!session.user) redirect("/login");
  if (session.impersonating) redirect("/dashboard?flash=keine-berechtigung");
  return session.user;
}

/**
 * Schritt 1: Entwurfs-Secret erzeugen (oder erneuern) und anzeigen lassen.
 * Scharf wird MFA erst mit der bestätigten Code-Eingabe in Schritt 2 — ein
 * Secret, das nie in einer App gelandet ist, darf niemanden aussperren.
 */
export async function starteMfaEinrichtung() {
  const user = await requireEchtesKonto();
  if (user.totpEnabledAt) redirect("/mfa-einrichten");
  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: encryptSecret(generateTotpSecret()) },
  });
  redirect("/mfa-einrichten");
}

/** Schritt 2: erster Code aus der App bestätigt Secret und schaltet MFA scharf. */
export async function bestaetigeMfa(formData: FormData) {
  const user = await requireEchtesKonto();
  if (user.totpEnabledAt) redirect("/mfa-einrichten");
  if (!user.totpSecret) redirect("/mfa-einrichten?fehler=kein-entwurf");

  // Dieselbe Bremse wie beim Login: Der Bestätigungsschritt darf kein Orakel
  // zum Durchprobieren von Codes sein.
  if (!(await checkRateLimit(`mfa-setup:${user.id}`, 5, 900, { failClosed: true }))) {
    redirect("/mfa-einrichten?fehler=limit");
  }

  const eingabe = String(formData.get("code") ?? "");
  if (!verifyTotp(decryptSecret(user.totpSecret), eingabe)) {
    redirect("/mfa-einrichten?fehler=code");
  }

  const codes = neueRecoveryCodes();
  await db.user.update({
    where: { id: user.id },
    data: {
      totpEnabledAt: new Date(),
      mfaRecoveryCodes: codes.map(hashRecoveryCode),
    },
  });
  await logAudit({
    actorId: user.id,
    action: AUDIT.MFA_ENABLED,
    ip: await getClientIp(),
  });
  await merkeRecoveryCodes(codes);
  revalidatePath("/", "layout");
  redirect("/mfa-einrichten?fertig=1");
}

/**
 * Neue Wiederherstellungscodes — ersetzt den GESAMTEN alten Satz. Verlangt
 * einen frischen App-Code: Wer nur eine offene Sitzung erwischt, soll sich
 * damit keinen dauerhaften Zweitzugang (10 Codes) ausstellen können.
 */
export async function erneuereRecoveryCodes(formData: FormData) {
  const user = await requireEchtesKonto();
  if (!user.totpEnabledAt || !user.totpSecret) redirect("/konto");
  if (!(await checkRateLimit(`mfa-setup:${user.id}`, 5, 900, { failClosed: true }))) {
    redirect("/konto?fehler=mfa-limit");
  }
  const eingabe = String(formData.get("code") ?? "");
  if (!verifyTotp(decryptSecret(user.totpSecret), eingabe)) {
    redirect("/konto?fehler=mfa-code");
  }
  const codes = neueRecoveryCodes();
  await db.user.update({
    where: { id: user.id },
    data: { mfaRecoveryCodes: codes.map(hashRecoveryCode) },
  });
  await logAudit({
    actorId: user.id,
    action: AUDIT.MFA_ENABLED,
    meta: { grund: "recovery-codes-erneuert" },
    ip: await getClientIp(),
  });
  await merkeRecoveryCodes(codes);
  redirect("/mfa-einrichten?fertig=1");
}
