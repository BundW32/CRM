"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AUDIT, logAudit } from "@/lib/audit";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  hashRecoveryCode,
  hatMfa,
  neueRecoveryCodes,
  pruefeEmailMfaCode,
} from "@/lib/mfa";
import { loescheEmailMfaCode, sendeEmailMfaCode } from "@/lib/mfa-email";
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

// ── Verfahren A: Authenticator-App (TOTP) ────────────────────────────────────

/**
 * Schritt 1: Entwurfs-Secret erzeugen (oder erneuern) und anzeigen lassen.
 * Scharf wird MFA erst mit der bestätigten Code-Eingabe in Schritt 2 — ein
 * Secret, das nie in einer App gelandet ist, darf niemanden aussperren.
 */
export async function starteMfaEinrichtung() {
  const user = await requireEchtesKonto();
  if (hatMfa(user)) redirect("/mfa-einrichten");
  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: encryptSecret(generateTotpSecret()) },
  });
  redirect("/mfa-einrichten");
}

/** Schritt 2: erster Code aus der App bestätigt Secret und schaltet MFA scharf. */
export async function bestaetigeMfa(formData: FormData) {
  const user = await requireEchtesKonto();
  if (hatMfa(user)) redirect("/mfa-einrichten");
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
    meta: { verfahren: "app" },
    ip: await getClientIp(),
  });
  await merkeRecoveryCodes(codes);
  revalidatePath("/", "layout");
  redirect("/mfa-einrichten?fertig=1");
}

// ── Verfahren B: Code per E-Mail ─────────────────────────────────────────────

/**
 * Schritt 1: Bestätigungscode an die Konto-Adresse schicken. Aktiv wird das
 * Verfahren erst mit der richtigen Eingabe — das beweist, dass das Postfach
 * wirklich erreichbar ist. Sonst sperrte ein Tippfehler im SMTP-Setup oder
 * ein volles Postfach die Person beim nächsten Login aus.
 */
export async function starteEmailMfa() {
  const user = await requireEchtesKonto();
  if (hatMfa(user)) redirect("/mfa-einrichten");
  if (!user.email) redirect("/konto");
  if (!(await checkRateLimit(`mfa-mail:${user.id}`, 3, 900))) {
    redirect("/mfa-einrichten?methode=email&fehler=limit");
  }
  await sendeEmailMfaCode(user);
  redirect("/mfa-einrichten?methode=email");
}

/** Schritt 2: Der zugesandte Code bestätigt das Verfahren. */
export async function bestaetigeEmailMfa(formData: FormData) {
  const user = await requireEchtesKonto();
  if (hatMfa(user)) redirect("/mfa-einrichten");
  if (!(await checkRateLimit(`mfa-setup:${user.id}`, 5, 900, { failClosed: true }))) {
    redirect("/mfa-einrichten?methode=email&fehler=limit");
  }
  const eingabe = String(formData.get("code") ?? "");
  if (!pruefeEmailMfaCode(user, eingabe)) {
    redirect("/mfa-einrichten?methode=email&fehler=code");
  }

  const codes = neueRecoveryCodes();
  await db.user.update({
    where: { id: user.id },
    data: {
      mfaEmailEnabledAt: new Date(),
      mfaEmailCodeHash: null,
      mfaEmailCodeExpiresAt: null,
      mfaRecoveryCodes: codes.map(hashRecoveryCode),
    },
  });
  await logAudit({
    actorId: user.id,
    action: AUDIT.MFA_ENABLED,
    meta: { verfahren: "email" },
    ip: await getClientIp(),
  });
  await merkeRecoveryCodes(codes);
  revalidatePath("/", "layout");
  redirect("/mfa-einrichten?fertig=1");
}

// ── Verwaltung (Konto-Seite) ─────────────────────────────────────────────────

/**
 * E-Mail-Verfahren: frischen Code für die Handgriffe auf der Konto-Seite
 * anfordern (Codes erneuern, Abschalten).
 */
export async function sendeKontoMfaCode() {
  const user = await requireEchtesKonto();
  if (!user.mfaEmailEnabledAt) redirect("/konto");
  if (!(await checkRateLimit(`mfa-mail:${user.id}`, 3, 900))) {
    redirect("/konto?fehler=mfa-limit");
  }
  await sendeEmailMfaCode(user);
  redirect("/konto?flash=gesendet");
}

/**
 * Prüft den zweiten Faktor je nach gewähltem Verfahren — für die Handgriffe,
 * die MFA verändern. Eine offene Sitzung allein genügt bewusst nicht.
 * Verbraucht beim E-Mail-Verfahren den Code.
 */
async function pruefeZweitfaktor(
  user: {
    id: string;
    totpEnabledAt: Date | null;
    totpSecret: string | null;
    mfaEmailEnabledAt: Date | null;
    mfaEmailCodeHash: string | null;
    mfaEmailCodeExpiresAt: Date | null;
  },
  eingabe: string,
): Promise<boolean> {
  if (user.totpEnabledAt && user.totpSecret) {
    return verifyTotp(decryptSecret(user.totpSecret), eingabe);
  }
  if (user.mfaEmailEnabledAt && pruefeEmailMfaCode(user, eingabe)) {
    await loescheEmailMfaCode(user.id);
    return true;
  }
  return false;
}

/**
 * Neue Wiederherstellungscodes — ersetzt den GESAMTEN alten Satz. Verlangt
 * einen frischen Code des gewählten Verfahrens: Wer nur eine offene Sitzung
 * erwischt, soll sich damit keinen dauerhaften Zweitzugang (10 Codes)
 * ausstellen können.
 */
export async function erneuereRecoveryCodes(formData: FormData) {
  const user = await requireEchtesKonto();
  if (!hatMfa(user)) redirect("/konto");
  if (!(await checkRateLimit(`mfa-setup:${user.id}`, 5, 900, { failClosed: true }))) {
    redirect("/konto?fehler=mfa-limit");
  }
  const eingabe = String(formData.get("code") ?? "");
  if (!(await pruefeZweitfaktor(user, eingabe))) {
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

/**
 * Zwei-Faktor-Anmeldung abschalten. MFA ist optional (Entscheidung vom
 * 10.08.2026) — abschalten darf aber nur, wer den zweiten Faktor gerade
 * beweisen kann, nicht jede offene Sitzung.
 */
export async function deaktiviereMfa(formData: FormData) {
  const user = await requireEchtesKonto();
  if (!hatMfa(user)) redirect("/konto");
  if (!(await checkRateLimit(`mfa-setup:${user.id}`, 5, 900, { failClosed: true }))) {
    redirect("/konto?fehler=mfa-limit");
  }
  const eingabe = String(formData.get("code") ?? "");
  if (!(await pruefeZweitfaktor(user, eingabe))) {
    redirect("/konto?fehler=mfa-code");
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      totpSecret: null,
      totpEnabledAt: null,
      mfaEmailEnabledAt: null,
      mfaEmailCodeHash: null,
      mfaEmailCodeExpiresAt: null,
      mfaRecoveryCodes: [],
    },
  });
  await logAudit({ actorId: user.id, action: AUDIT.MFA_DISABLED, ip: await getClientIp() });
  revalidatePath("/konto");
  redirect("/konto?flash=mfa-deaktiviert");
}
