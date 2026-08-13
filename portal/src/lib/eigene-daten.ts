// Was eine Person an ihrem eigenen Konto selbst pflegen darf.
//
// Bis hierher zeigte „Konto" Name und E-Mail nur an, mit dem Satz „Änderungen
// übernimmt die Verwaltung für Sie". Ein Eigentümer, der über ein
// Zugangsschreiben ohne Adresse angelegt wurde, konnte seine E-Mail-Adresse
// damit nicht einmal nachtragen — obwohl das Datenmodell die Felder längst
// trägt.
//
// Drei Stufen, nach dem Schaden bei einem Fehler getrennt:
//
// 1. **Kontaktdaten** (Telefon, Anschrift, bevorzugter Kontaktweg) — direkt
//    speicherbar. Ein Tippfehler kostet niemanden etwas als eine Korrektur.
// 2. **E-Mail-Adresse** — nur über Doppel-Opt-in. Sie ist `@unique` und
//    zugleich der Anmeldename: Ein Tippfehler sperrt den Zugang aus, und ohne
//    Bestätigung ließe sich eine fremde Adresse eintragen und damit ein
//    Passwort-Reset auf ein fremdes Postfach umleiten.
// 3. **Name** — bleibt bei der Verwaltung. Er hängt an Eigentumsverhältnissen,
//    Beschlüssen und erzeugten Dokumenten; wer ihn ändert, ändert sie mit.
//
// Die Datenbankarbeit steht hier und nicht in den Server-Actions, damit sie
// gegen eine echte Datenbank prüfbar ist (`eigene-daten.dbtest.ts`). Jede
// Funktion schreibt ausschließlich über die übergebene Nutzer-ID — die
// Zugriffsfrage ist damit eine Eigenschaft dieser Datei und nicht der
// Formularseite darüber.

import { randomBytes } from "node:crypto";
import type { ContactMethod } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/token-hash";

/**
 * Wie lange ein Bestätigungslink für die neue Adresse gilt.
 *
 * Kürzer als beim Erst-Onboarding (3 Tage): Hier steht ein bereits nutzbares
 * Konto dahinter, und der Link verschiebt dessen Anmeldenamen. Länger als beim
 * Passwort-Reset (2 Stunden) wäre unnötig streng — die Mail landet im neuen,
 * womöglich selten gelesenen Postfach.
 */
export const EMAIL_WECHSEL_GUELTIG_STUNDEN = 24;

export const CONTACT_METHODS = ["EMAIL", "TELEFON", "MOBIL", "POST"] as const;

// ── Kontaktdaten ─────────────────────────────────────────────────────────────

export type EigeneKontaktdaten = {
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  preferredContact: ContactMethod | null;
};

/** Leerer Text heißt „nicht angegeben" — und das ist `null`, nicht `""`. */
function textOderNull(raw: unknown, maxLaenge: number): string | null {
  const wert = String(raw ?? "").trim();
  if (!wert) return null;
  return wert.slice(0, maxLaenge);
}

/**
 * Formulareingaben in speicherbare Kontaktdaten übersetzen.
 *
 * Ein unbekannter Kontaktweg wird zu `null` statt zu einem Fehler: Das Feld ist
 * ein `<select>` mit fester Liste, ein anderer Wert kann nur von Hand
 * konstruiert sein — und dann ist „keine Angabe" die harmlose Auslegung.
 */
export function leseKontaktdaten(werte: {
  phone?: unknown;
  street?: unknown;
  zip?: unknown;
  city?: unknown;
  preferredContact?: unknown;
}): EigeneKontaktdaten {
  const kontaktweg = String(werte.preferredContact ?? "");
  return {
    phone: textOderNull(werte.phone, 60),
    street: textOderNull(werte.street, 120),
    zip: textOderNull(werte.zip, 20),
    city: textOderNull(werte.city, 120),
    preferredContact: (CONTACT_METHODS as readonly string[]).includes(kontaktweg)
      ? (kontaktweg as ContactMethod)
      : null,
  };
}

/** Speichert die Kontaktdaten — ausschließlich am eigenen Datensatz. */
export async function speichereEigeneKontaktdaten(
  userId: string,
  daten: EigeneKontaktdaten,
): Promise<void> {
  await db.user.update({ where: { id: userId }, data: daten });
}

// ── E-Mail-Wechsel (Doppel-Opt-in) ───────────────────────────────────────────

/**
 * Prüft und normalisiert eine eingegebene Adresse.
 *
 * Bewusst genügsam: Die eigentliche Prüfung ist die Bestätigungsmail — was
 * nicht zustellbar ist, wird nie bestätigt und übernimmt deshalb auch nichts.
 * Eine strenge Mustererkennung würde hier nur gültige Sonderfälle abweisen.
 */
export function normalisiereEmail(raw: unknown): string | null {
  const wert = String(raw ?? "").trim().toLowerCase();
  if (wert.length < 5 || wert.length > 254) return null;
  if (/\s/.test(wert)) return null;
  const teile = wert.split("@");
  if (teile.length !== 2) return null;
  const [lokal, domain] = teile;
  if (!lokal || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return null;
  }
  return wert;
}

export type WechselAnstossErgebnis =
  | { status: "ok"; token: string; gueltigBis: Date; neueAdresse: string }
  | { status: "unveraendert" }
  | { status: "ungueltig" }
  | { status: "vergeben" };

/**
 * Stößt den Wechsel an: Token erzeugen, neue Adresse als Vormerkung ablegen.
 *
 * Die bisherige Adresse bleibt bis zur Bestätigung unangetastet — bis dahin
 * meldet man sich weiter mit ihr an. Der Rohwert des Tokens wird
 * zurückgegeben und nur verschickt; in der Datenbank steht allein sein Hash.
 *
 * „Vergeben" wird ehrlich gemeldet, obwohl es preisgibt, dass zu dieser Adresse
 * ein Konto existiert. Die Alternative — schweigen und so tun, als sei die Mail
 * unterwegs — ließe die Person auf eine Bestätigung warten, die nie kommt, und
 * sie hätte keine Möglichkeit, den Grund zu erfahren. Der Preis ist klein: Wer
 * hier fragt, ist bereits angemeldet.
 */
export async function starteEmailWechsel(
  userId: string,
  neueAdresseRoh: unknown,
  now: Date = new Date(),
): Promise<WechselAnstossErgebnis> {
  const neueAdresse = normalisiereEmail(neueAdresseRoh);
  if (!neueAdresse) return { status: "ungueltig" };

  const person = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!person) return { status: "ungueltig" };
  if (person.email && person.email.toLowerCase() === neueAdresse) {
    return { status: "unveraendert" };
  }

  const belegt = await db.user.findUnique({ where: { email: neueAdresse }, select: { id: true } });
  if (belegt) return { status: "vergeben" };

  const token = randomBytes(32).toString("hex");
  const gueltigBis = new Date(now.getTime() + EMAIL_WECHSEL_GUELTIG_STUNDEN * 3600_000);
  await db.user.update({
    where: { id: userId },
    data: {
      pendingEmail: neueAdresse,
      emailChangeToken: hashToken(token),
      emailChangeExpiry: gueltigBis,
    },
  });
  return { status: "ok", token, gueltigBis, neueAdresse };
}

/** Nimmt eine offene Anfrage zurück (falsch getippt, Meinung geändert). */
export async function brichEmailWechselAb(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { pendingEmail: null, emailChangeToken: null, emailChangeExpiry: null },
  });
}

export type WechselUebernahme =
  | { status: "ok"; userId: string; organizationId: string; name: string; alteEmail: string | null; neueEmail: string }
  | { status: "abgelaufen" }
  | { status: "vergeben" }
  | { status: "ungueltig" };

/**
 * Löst den Bestätigungslink ein und übernimmt die vorgemerkte Adresse.
 *
 * Der Token wird über seinen Hash gesucht — der in der Datenbank stehende Wert
 * selbst ist damit kein einlösbarer Link (siehe `token-hash.dbtest.ts`). Er ist
 * genau einmal einlösbar: Die Übernahme räumt Vormerkung, Token und Ablauf im
 * selben Schreibvorgang ab.
 *
 * `emailVerifiedAt` wird mitgesetzt — genau das hat der Klick belegt.
 */
export async function uebernehmeEmailWechsel(
  rohToken: string,
  now: Date = new Date(),
): Promise<WechselUebernahme> {
  const treffer = await db.user.findFirst({
    where: { emailChangeToken: hashToken(rohToken) },
    select: {
      id: true,
      organizationId: true,
      name: true,
      email: true,
      pendingEmail: true,
      emailChangeExpiry: true,
    },
  });
  if (!treffer || !treffer.pendingEmail) return { status: "ungueltig" };
  if (!treffer.emailChangeExpiry || treffer.emailChangeExpiry.getTime() < now.getTime()) {
    return { status: "abgelaufen" };
  }

  const neueEmail = treffer.pendingEmail;
  try {
    await db.user.update({
      where: { id: treffer.id },
      data: {
        email: neueEmail,
        emailVerifiedAt: now,
        pendingEmail: null,
        emailChangeToken: null,
        emailChangeExpiry: null,
      },
    });
  } catch {
    // Zwischen Anfrage und Klick kann jemand anderes dieselbe Adresse belegt
    // haben — dann greift die @unique-Sperre auf `email`. Die Vormerkung bleibt
    // bewusst stehen: Sie ist nicht falsch, nur (noch) nicht einlösbar.
    return { status: "vergeben" };
  }

  return {
    status: "ok",
    userId: treffer.id,
    organizationId: treffer.organizationId,
    name: treffer.name,
    alteEmail: treffer.email,
    neueEmail,
  };
}
