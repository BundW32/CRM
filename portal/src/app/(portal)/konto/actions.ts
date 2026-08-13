"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AUDIT, logAudit } from "@/lib/audit";
import { getBrandingForOrg } from "@/lib/branding-server";
import { signOffName } from "@/lib/branding";
import { db } from "@/lib/db";
import {
  EMAIL_WECHSEL_GUELTIG_STUNDEN,
  brichEmailWechselAb,
  leseKontaktdaten,
  speichereEigeneKontaktdaten,
  starteEmailWechsel,
} from "@/lib/eigene-daten";
import { isMailEnabled, portalUrlFromRequest, sendMail } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createSession, requireUser, revokeSessions } from "@/lib/session";
import { IMAGE_TYPES, deleteBlob, saveBuffer } from "@/lib/storage";

/** Rücksprung auf die Kontoseite; der Anker führt zur bearbeiteten Karte. */
function backTo(suffix = ""): string {
  return `/konto${suffix}`;
}

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    redirect(backTo("?fehler=aktuell"));
  }
  if (next.length < 10 || next.length > 200) {
    redirect(backTo("?fehler=laenge"));
  }
  if (next !== repeat) {
    redirect(backTo("?fehler=wiederholung"));
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });
  // Alle anderen Geraete abmelden – das ist der Zweck eines Passwortwechsels.
  // Die eigene Sitzung wird gleich darauf neu ausgestellt und bleibt gueltig.
  await revokeSessions(user.id);
  await createSession(user.id);

  redirect(backTo("?flash=passwort-geaendert"));
}

// ── Eigene Kontaktdaten ─────────────────────────────────────────────────────
// Telefon, Anschrift und bevorzugter Kontaktweg gehören der Person selbst. Der
// Umweg über die Verwaltung war hier reine Reibung: Ein falsch geschriebener
// Straßenname kostet niemanden mehr als eine Korrektur, und die Verwaltung
// weiß ohnehin nicht, unter welcher Nummer jemand erreichbar sein möchte.
//
// Gilt für jede Rolle. Eine Sperre auf Eigentümer wäre willkürlich — auch ein
// Mieter darf seine Telefonnummer nachtragen; geschrieben wird ausschließlich
// am eigenen Datensatz (`speichereEigeneKontaktdaten`).
//
// Kein Audit-Eintrag: Die eigene Telefonnummer zu ändern ist keine
// nachweispflichtige Handlung. Die E-Mail-Adresse unten ist etwas anderes —
// sie ist der Anmeldename.
export async function saveContactData(formData: FormData) {
  const user = await requireUser();
  await speichereEigeneKontaktdaten(
    user.id,
    leseKontaktdaten({
      phone: formData.get("phone"),
      street: formData.get("street"),
      zip: formData.get("zip"),
      city: formData.get("city"),
      preferredContact: formData.get("preferredContact"),
    }),
  );
  revalidatePath("/konto");
  redirect(backTo("?flash=gespeichert#kontaktdaten"));
}

// ── E-Mail-Adresse: Doppel-Opt-in ───────────────────────────────────────────
// Die Adresse ist `@unique` und zugleich der Anmeldename. Zwei Gefahren, die
// beide schon woanders zugeschlagen haben:
//
// - Ein Tippfehler sperrt den Zugang aus. Deshalb wird `email` erst
//   übernommen, wenn im NEUEN Postfach geklickt wurde — bis dahin gilt die
//   bisherige Adresse weiter.
// - Ohne Bestätigung ließe sich eine fremde Adresse eintragen und darüber ein
//   Passwort-Reset auf ein fremdes Postfach umleiten. Deshalb der Token.
//
// Die bisherige Adresse wird benachrichtigt, sobald die Anfrage gestellt ist —
// nicht erst danach: Wer sie erst nach der Übernahme erführe, hätte die
// Nachricht an einem Postfach, das nicht mehr am Konto hängt.

export async function requestEmailChange(formData: FormData) {
  const user = await requireUser();
  const ip = await getClientIp();

  // Ohne SMTP führt der Weg nicht ans Ziel: Der Bestätigungslink käme nie an,
  // und die Vormerkung stünde für immer offen. Die Karte blendet das Formular
  // dann gar nicht erst ein; hier steht die serverseitige Gegenprobe.
  if (!isMailEnabled()) redirect(backTo("?fehler=email-kein-versand#email"));

  // Drei Anfragen je Konto und Stunde. Der Versand geht an eine frei gewählte
  // Adresse — ohne Grenze wäre das ein Versandwerkzeug für fremde Postfächer.
  if (!(await checkRateLimit(`email-wechsel:${user.id}`, 3, 3600))) {
    redirect(backTo("?fehler=email-limit#email"));
  }

  const ergebnis = await starteEmailWechsel(user.id, formData.get("email"));
  if (ergebnis.status === "ungueltig") redirect(backTo("?fehler=email-ungueltig#email"));
  if (ergebnis.status === "unveraendert") redirect(backTo("?fehler=email-unveraendert#email"));
  if (ergebnis.status === "vergeben") redirect(backTo("?fehler=email-vergeben#email"));

  const neueAdresse = ergebnis.neueAdresse;
  const branding = await getBrandingForOrg(user.organizationId);
  const link = await portalUrlFromRequest(`/email-aendern/bestaetigen/${ergebnis.token}`);

  await sendMail(
    neueAdresse,
    "Neue E-Mail-Adresse bestätigen",
    `Guten Tag ${user.name},\n\n` +
      `diese Adresse soll künftig Ihre Anmelde- und Kontaktadresse im Portal sein.\n` +
      `Bitte bestätigen Sie das über diesen Link (gültig ${EMAIL_WECHSEL_GUELTIG_STUNDEN} Stunden):\n` +
      `${link}\n\n` +
      `Bis zur Bestätigung ändert sich nichts — Sie melden sich weiter mit Ihrer\n` +
      `bisherigen Adresse an. Haben Sie das nicht veranlasst, ignorieren Sie diese\n` +
      `E-Mail; ohne Klick auf den Link geschieht nichts.\n\n` +
      `Mit freundlichen Grüßen\n${signOffName(branding)}`,
    undefined,
    branding,
  );

  // Die bisherige Adresse erfährt es sofort — sie ist die einzige Stelle, an
  // der ein unbefugter Wechsel auffallen kann, solange er noch aufzuhalten ist.
  await sendMail(
    user.email,
    "Änderung Ihrer E-Mail-Adresse angefordert",
    `Guten Tag ${user.name},\n\n` +
      `für Ihr Portalkonto wurde die Änderung der E-Mail-Adresse auf ${neueAdresse}\n` +
      `angefordert. Wirksam wird sie erst, wenn der Bestätigungslink im neuen\n` +
      `Postfach angeklickt wird; er gilt ${EMAIL_WECHSEL_GUELTIG_STUNDEN} Stunden.\n\n` +
      `Waren Sie das nicht, ändern Sie bitte umgehend Ihr Passwort und nehmen Sie\n` +
      `die Anfrage unter „Konto" zurück.\n\n` +
      `Mit freundlichen Grüßen\n${signOffName(branding)}`,
    undefined,
    branding,
  );

  await logAudit({
    actorId: user.id,
    action: AUDIT.EMAIL_CHANGE_REQUESTED,
    targetType: "User",
    targetId: user.id,
    meta: { bisher: user.email, neu: neueAdresse },
    ip,
  });

  revalidatePath("/konto");
  redirect(backTo("?flash=email-bestaetigung-gesendet#email"));
}

export async function cancelEmailChange() {
  const user = await requireUser();
  await brichEmailWechselAb(user.id);
  await logAudit({
    actorId: user.id,
    action: AUDIT.EMAIL_CHANGE_ABORTED,
    targetType: "User",
    targetId: user.id,
    ip: await getClientIp(),
  });
  revalidatePath("/konto");
  redirect(backTo("?flash=email-wechsel-abgebrochen#email"));
}

// ── Unterschrift und Vollmacht des Eigentümers ──────────────────────────────
// Beides gehört dem Eigentümer selbst: Er unterschreibt hier eigenhändig und
// entscheidet selbst über die Vollmacht. Der Verwalter kann keines von beidem
// an seiner Stelle erteilen.

/** Nur Eigentümer führen Unterschrift und Vollmacht – sonst zurück zum Konto. */
async function requireEigentuemer() {
  const user = await requireUser();
  if (user.role !== "EIGENTUEMER") redirect(backTo());
  return user;
}

export async function saveOwnSignature(formData: FormData) {
  const user = await requireEigentuemer();
  const dataUrl = String(formData.get("signatureDataUrl") ?? "").trim();
  const PREFIX = "data:image/png;base64,";
  // Leeres Feld heißt „vorhandene behalten" (siehe SignatureCanvas) – kein Fehler.
  if (!dataUrl.startsWith(PREFIX)) redirect(backTo());

  const buffer = Buffer.from(dataUrl.slice(PREFIX.length), "base64");
  if (buffer.byteLength === 0) redirect(backTo());

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
    redirect(backTo("?fehler=signatur"));
  }

  revalidatePath("/konto");
  redirect(backTo("?flash=unterschrift-gespeichert"));
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
  redirect(backTo("?flash=vollmacht-erteilt"));
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
  redirect(backTo("?flash=vollmacht-widerrufen"));
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
  redirect(backTo("?gespeichert=hinweise"));
}
