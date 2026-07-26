"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import { loadWegProperty } from "@/lib/weg/scope";

function back(propertyId: string, param?: string): never {
  redirect(`/verwaltung/weg/${propertyId}/hausgeld${param ? `?${param}` : ""}`);
}

// Ordnet einen Zahlungseingang (EINNAHME-Buchung) einer Einheit zu — oder hebt
// die Zuordnung auf (unitId leer). Grundlage der Offene-Posten-Rechnung.
export async function assignPayment(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const booking = await db.booking.findFirst({
    where: { id: bookingId, propertyId: property.id, kind: "EINNAHME" },
    select: { id: true },
  });
  if (!booking) back(property.id, "fehler=buchung");

  if (unitId) {
    const unit = await db.unit.findFirst({
      where: { id: unitId, propertyId: property.id },
      select: { id: true },
    });
    if (!unit) back(property.id, "fehler=einheit");
  }

  await db.booking.update({
    where: { id: booking.id },
    data: { unitId: unitId || null },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PAYMENT_ASSIGNED,
    targetType: "Booking",
    targetId: booking.id,
    meta: { unitId: unitId || null },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/hausgeld`);
  back(property.id, unitId ? "zugeordnet=1" : "geloest=1");
}

// ── Mahnwesen (Zahlungserinnerung → Mahnung) ─────────────────────────────────

const PAYMENT_DEADLINE_DAYS = 14;

// Aktueller Hausgeld-Rückstand einer Einheit (Σ fällige Sollstellungen −
// Σ zugeordnete Zahlungseingänge). Positiv = Rückstand.
async function currentArrears(unitId: string): Promise<number> {
  const [due, paid] = await Promise.all([
    db.duePosting.aggregate({
      where: { unitId, dueDate: { lte: new Date() } },
      _sum: { amountCents: true },
    }),
    db.booking.aggregate({
      where: { unitId, kind: "EINNAHME", ...NOT_REVERSED },
      _sum: { amountCents: true },
    }),
  ]);
  return (due._sum.amountCents ?? 0) - (paid._sum.amountCents ?? 0);
}

// Erstellt die nächste Mahnstufe für eine Einheit. Stufenlogik wie im
// Plattform-Mahnwesen: Es eskaliert nur, was auch versendet wurde — unversendete
// Entwürfe erhöhen die Stufe nicht. Rückstand und Empfänger werden eingefroren.
export async function createMahnung(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const unit = await db.unit.findFirst({
    where: { id: unitId, propertyId: property.id },
    select: { id: true, label: true },
  });
  if (!unit) back(property.id, "fehler=einheit");

  const arrears = await currentArrears(unit.id);
  if (arrears <= 0) back(property.id, "fehler=keinrueckstand");

  // Nächste Stufe: höchste VERSENDETE Stufe + 1 (max. 3). Existiert bereits ein
  // unversendeter Entwurf, nicht doppelt anlegen.
  const [maxSent, openDraft] = await Promise.all([
    db.hausgeldMahnung.aggregate({
      where: { unitId: unit.id, sentAt: { not: null } },
      _max: { level: true },
    }),
    db.hausgeldMahnung.findFirst({
      where: { unitId: unit.id, sentAt: null },
      select: { id: true },
    }),
  ]);
  if (openDraft) back(property.id, "fehler=entwurfoffen");
  const level = Math.min((maxSent._max.level ?? 0) + 1, 3);

  // Empfänger: aktuelle Eigentümer der Einheit (UnitOwnership, laufend)
  const now = new Date();
  const owners = await db.unitOwnership.findMany({
    where: { unitId: unit.id, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
    include: { user: { select: { name: true, street: true, zip: true, city: true } } },
    orderBy: { validFrom: "asc" },
  });
  if (owners.length === 0) back(property.id, "fehler=keineigentuemer");
  const recipientName = owners.map((o) => o.user.name).join(", ");
  const first = owners[0].user;
  const recipientAddress =
    first.street && first.zip && first.city ? `${first.street}\n${first.zip} ${first.city}` : null;

  const mahnung = await db.hausgeldMahnung.create({
    data: {
      organizationId: verwalter.organizationId,
      propertyId: property.id,
      unitId: unit.id,
      level,
      arrearsCents: arrears,
      paymentDeadline: new Date(Date.now() + PAYMENT_DEADLINE_DAYS * 24 * 60 * 60 * 1000),
      recipientName,
      recipientAddress,
      createdById: verwalter.id,
    },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_MAHNUNG_CREATED,
    targetType: "HausgeldMahnung",
    targetId: mahnung.id,
    meta: { unit: unit.label, level, arrearsCents: arrears },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/hausgeld`);
  back(property.id, "gespeichert=mahnung");
}

// Lädt eine Mahnung mit Scope-Prüfung.
async function loadMahnung(orgId: string, propertyId: string, mahnungId: string) {
  return db.hausgeldMahnung.findFirst({
    where: { id: mahnungId, propertyId, organizationId: orgId },
  });
}

// "Als versendet markieren" — setzt das Versanddatum (Fristen-Nachweis im
// Zero-Key-Modus: Brief selbst gedruckt/versendet).
export async function markMahnungSent(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const mahnungId = String(formData.get("mahnungId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const mahnung = await loadMahnung(verwalter.organizationId, property.id, mahnungId);
  if (!mahnung) back(property.id, "fehler=mahnung");
  if (!mahnung.sentAt) {
    await db.hausgeldMahnung.update({ where: { id: mahnung.id }, data: { sentAt: new Date() } });
    await logAudit({
      actorId: verwalter.id,
      action: AUDIT.WEG_MAHNUNG_SENT,
      targetType: "HausgeldMahnung",
      targetId: mahnung.id,
      meta: { level: mahnung.level },
    });
  }
  revalidatePath(`/verwaltung/weg/${property.id}/hausgeld`);
  back(property.id, "gespeichert=versendet");
}

// Unversendete Mahnung (Entwurf) löschen — versendete bleiben als Nachweis.
export async function deleteMahnung(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const mahnungId = String(formData.get("mahnungId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const mahnung = await loadMahnung(verwalter.organizationId, property.id, mahnungId);
  if (!mahnung) back(property.id, "fehler=mahnung");
  if (mahnung.sentAt) back(property.id, "fehler=versendet");

  await db.hausgeldMahnung.delete({ where: { id: mahnung.id } });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_MAHNUNG_DELETED,
    targetType: "HausgeldMahnung",
    targetId: mahnung.id,
    meta: { level: mahnung.level },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/hausgeld`);
  back(property.id, "gespeichert=geloescht");
}

/**
 * Übernimmt den Hausgeld-Stand je Einheit aus der bisherigen Verwaltung.
 *
 * Der Moment, in dem eine Selbstverwaltung beginnt, ist die Aktenübergabe. Die
 * Kontostände landen als Anfangsbestand am Konto — was fehlte, waren die
 * **offenen Posten je Einheit**. Schuldete eine Einheit dem alten Verwalter
 * noch 800 €, wusste unser System davon nichts: Die Rückstandsliste startete
 * bei null, das Mahnwesen ebenso, und die Forderung war faktisch verschwunden.
 *
 * Bewusst kein neues Datenmodell: Ein Rückstand ist eine fällige Sollstellung,
 * und genau das ist `DuePosting`. Mit `source = "UEBERNAHME"` fließt er ohne
 * Weiteres in Rückstandsliste, offene Posten und Mahnwesen ein — alles, was
 * daran hängt, funktioniert unverändert.
 *
 * Sollstellungen berühren **keine Kontostände**: Sie sind Forderungen, kein
 * Geld. Deshalb ist das hier auch der richtige Ort für ein Guthaben (negativer
 * Betrag) — eine Buchung würde stattdessen den Kontostand verfälschen, denn
 * das Geld liegt längst im übernommenen Anfangsbestand.
 */
export async function saveUebernahme(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const stichtagRoh = String(formData.get("stichtag") ?? "").trim();
  const stichtag = new Date(stichtagRoh);
  if (!stichtagRoh || Number.isNaN(stichtag.getTime())) {
    redirect(`/verwaltung/weg/${property.id}/hausgeld?fehler=stichtag#uebernahme`);
  }

  const units = await db.unit.findMany({
    where: { propertyId: property.id },
    select: { id: true },
  });

  const postings = units.flatMap((u) => {
    const roh = String(formData.get(`betrag_${u.id}`) ?? "").trim();
    if (!roh) return [];
    // Guthaben als negativer Betrag: `parseEuroToCents` lässt kein Minus zu,
    // deshalb das Vorzeichen abtrennen und danach wieder anlegen.
    const negativ = roh.startsWith("-") || roh.startsWith("−");
    const cents = parseEuroToCents(negativ ? roh.slice(1) : roh);
    if (cents === null || cents === 0) return [];
    return [
      {
        organizationId: verwalter.organizationId,
        propertyId: property.id,
        unitId: u.id,
        dueDate: stichtag,
        periodYear: stichtag.getFullYear(),
        periodMonth: stichtag.getMonth() + 1,
        amountCents: negativ ? -cents : cents,
        source: "UEBERNAHME",
      },
    ];
  });

  // Ersetzen statt ergänzen: Die Übernahme ist ein einmaliger Stand, kein
  // Zugang. Zweimaliges Speichern darf ihn nicht verdoppeln.
  await db.$transaction([
    db.duePosting.deleteMany({ where: { propertyId: property.id, source: "UEBERNAHME" } }),
    ...(postings.length > 0 ? [db.duePosting.createMany({ data: postings })] : []),
  ]);

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_BOOKING_CREATED,
    targetType: "Property",
    targetId: property.id,
    meta: {
      kind: "uebernahme-offene-posten",
      stichtag: stichtagRoh,
      einheiten: postings.length,
      summeCents: postings.reduce((s, p) => s + p.amountCents, 0),
    },
  });

  revalidatePath(`/verwaltung/weg/${property.id}/hausgeld`);
  redirect(`/verwaltung/weg/${property.id}/hausgeld?flash=gespeichert#uebernahme`);
}
