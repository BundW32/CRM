"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { IMAGE_TYPES, deleteBlob, saveBuffer } from "@/lib/storage";

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    redirect("/konto?fehler=aktuell");
  }
  if (next.length < 10 || next.length > 200) {
    redirect("/konto?fehler=laenge");
  }
  if (next !== repeat) {
    redirect("/konto?fehler=wiederholung");
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });

  redirect("/konto?flash=passwort-geaendert");
}

// ── Unterschrift und Vollmacht des Eigentümers ──────────────────────────────
// Beides gehört dem Eigentümer selbst: Er unterschreibt hier eigenhändig und
// entscheidet selbst über die Vollmacht. Der Verwalter kann keines von beidem
// an seiner Stelle erteilen.

/** Nur Eigentümer führen Unterschrift und Vollmacht – sonst zurück zum Konto. */
async function requireEigentuemer() {
  const user = await requireUser();
  if (user.role !== "EIGENTUEMER") redirect("/konto");
  return user;
}

export async function saveOwnSignature(formData: FormData) {
  const user = await requireEigentuemer();
  const dataUrl = String(formData.get("signatureDataUrl") ?? "").trim();
  const PREFIX = "data:image/png;base64,";
  // Leeres Feld heißt „vorhandene behalten" (siehe SignatureCanvas) – kein Fehler.
  if (!dataUrl.startsWith(PREFIX)) redirect("/konto");

  const buffer = Buffer.from(dataUrl.slice(PREFIX.length), "base64");
  if (buffer.byteLength === 0) redirect("/konto");

  try {
    if (user.signatureStoredName) await deleteBlob(user.signatureStoredName);
    const upload = await saveBuffer(buffer, "unterschrift.png", "image/png", IMAGE_TYPES);
    await db.user.update({
      where: { id: user.id },
      data: {
        signatureStoredName: upload.storedName,
        // Eigenhändig: Diese Unterschrift darf unter dem eigenen Namen erscheinen.
        signatureSelfSigned: true,
      },
    });
  } catch {
    redirect("/konto?fehler=signatur");
  }

  revalidatePath("/konto");
  redirect("/konto?flash=unterschrift-gespeichert");
}

export async function grantCertMandate() {
  const user = await requireEigentuemer();
  const now = new Date();
  await db.user.update({
    where: { id: user.id },
    data: {
      certMandateGrantedAt: now,
      // Widerruf zurücksetzen: Wer erneut bevollmächtigt, soll nicht durch
      // einen alten Widerruf blockiert bleiben.
      certMandateRevokedAt: null,
      certMandateSource: "SELBST",
      // Einen früheren Papier-Vermerk ablösen: Ab jetzt gilt die im Portal
      // selbst erteilte Vollmacht, Fundstelle und Vermerkender wären irreführend.
      certMandateNote: null,
      certMandateRecordedById: null,
    },
  });
  await logAudit({
    actorId: user.id,
    action: AUDIT.CERT_MANDATE_GRANTED,
    targetType: "User",
    targetId: user.id,
    meta: { quelle: "SELBST" },
    ip: await getClientIp(),
  });
  revalidatePath("/konto");
  redirect("/konto?flash=vollmacht-erteilt");
}

export async function revokeCertMandate() {
  const user = await requireEigentuemer();
  await db.user.update({
    where: { id: user.id },
    data: { certMandateRevokedAt: new Date() },
  });
  await logAudit({
    actorId: user.id,
    action: AUDIT.CERT_MANDATE_REVOKED,
    targetType: "User",
    targetId: user.id,
    meta: { durch: "EIGENTUEMER" },
    ip: await getClientIp(),
  });
  revalidatePath("/konto");
  redirect("/konto?flash=vollmacht-widerrufen");
}

// ── Erklärende Hinweise ein/aus ─────────────────────────────────────────────
// Eine Vorliebe der Person, nicht der Organisation: Zwei Eigentümer derselben
// WEG dürfen es verschieden wollen. Deshalb am Nutzer und nicht am Mandanten.
//
// Kein Audit-Eintrag: Ob jemand Erklärtexte sieht, ist keine nachweispflichtige
// Handlung — und ein Protokoll darüber wäre eher Überwachung als Nachweis.
export async function saveShowHints(formData: FormData) {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { showHints: formData.get("showHints") === "on" },
  });
  revalidatePath("/", "layout");
  redirect("/konto?gespeichert=hinweise");
}
