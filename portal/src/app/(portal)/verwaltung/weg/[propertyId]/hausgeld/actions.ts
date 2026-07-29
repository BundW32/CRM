"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import {
  offenePostenDerEinheit,
  offenerZahlungsbetrag,
  rueckstandDerEinheit,
} from "@/lib/weg/opos-service";
import { schlageZuordnungVor, type Tilgungszweck } from "@/lib/weg/payment-allocation";
import { loadWegProperty } from "@/lib/weg/scope";
import { basiszinssaetze, verzugJeForderung } from "@/lib/weg/verzug-service";
import { fortgeltenderPlan, synchronisiereSollstellungen } from "@/lib/weg/due-postings";

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

// Aktueller Hausgeld-Rückstand einer Einheit — je Forderung gerechnet, nicht
// als Differenz zweier Summen. Die alte Rechnung ließ die Zahlung einer
// Sonderumlage Hausgeldrückstände tilgen und eine Vorauszahlung einen offenen
// Monat verdecken; siehe `payment-allocation.ts`.
const currentArrears = rueckstandDerEinheit;

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

  // Zinsen und Kosten werden **jetzt** festgeschrieben, nicht bei jeder Anzeige
  // neu gerechnet. Ist das Schreiben raus, muss nachvollziehbar bleiben, was
  // darin stand — eine Mahnung, deren Beträge sich später von selbst ändern,
  // ist als Nachweis wertlos.
  //
  // `interestCents` bleibt `null`, wenn für den Zeitraum kein Basiszinssatz
  // hinterlegt ist. Dann nennt das Schreiben keine Zinsen, statt eine Null
  // auszuweisen, die wie „keine Zinsen entstanden" aussieht.
  const saetze = await basiszinssaetze(verwalter.organizationId);
  const offeneForderungen = await db.duePosting.findMany({
    where: { unitId: unit.id, dueDate: { lte: now } },
    select: { id: true, dueDate: true, amountCents: true, allocations: { select: { amountCents: true } } },
  });
  const zinsen = verzugJeForderung(
    offeneForderungen
      .map((f) => ({
        id: f.id,
        dueDate: f.dueDate,
        offenCents: f.amountCents - f.allocations.reduce((s, a) => s + a.amountCents, 0),
      }))
      .filter((f) => f.offenCents > 0),
    saetze,
    now,
  );
  let interestCents: number | null = 0;
  for (const z of zinsen.values()) {
    if (z.zinsenCents === null) {
      interestCents = null;
      break;
    }
    interestCents += z.zinsenCents;
  }

  const mahnung = await db.hausgeldMahnung.create({
    data: {
      organizationId: verwalter.organizationId,
      propertyId: property.id,
      unitId: unit.id,
      level,
      arrearsCents: arrears,
      interestCents,
      // Erste Mahnung ohne Kosten: Vor der ersten Mahnung war der Schuldner
      // nicht darauf hingewiesen, dass Kosten entstehen. Erst ab der zweiten
      // sind sie ein ersatzfähiger Verzugsschaden.
      feeCents: level > 1 ? property.mahnkostenCents : 0,
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
    meta: { unit: unit.label, level, arrearsCents: arrears, interestCents, feeCents: level > 1 ? property.mahnkostenCents : 0 },
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

// ── Fortgeltung: Sollstellungen fortschreiben ────────────────────────────────
// § 28 Abs. 1 Satz 2 WEG: Der beschlossene Wirtschaftsplan gilt fort, bis ein
// neuer beschlossen ist. Ohne diesen Schritt endeten die Forderungen mit dem
// Wirtschaftsjahr — ab Januar schuldete niemand Hausgeld, es gäbe keine
// Rückstände und nichts zu mahnen, nur weil die Versammlung noch nicht getagt
// hat. Das Geld fehlt der Gemeinschaft trotzdem.
//
// Bewusst ein Knopf und kein stiller Automatismus beim Seitenaufruf: Neue
// Forderungen sollen entstehen, weil jemand sie auslöst, nicht als Nebenwirkung
// des Hinsehens. Der Fahrplan weist darauf hin, sobald Monate fehlen.

export async function schreibeSollstellungenFort(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const plan = await fortgeltenderPlan(property.id);
  if (!plan || !plan.validFrom) back(property.id, "fehler=keinplan");

  const units = await db.unit.findMany({
    where: { propertyId: property.id },
    select: { id: true, mea: true, livingArea: true, personCount: true },
  });
  if (units.length === 0) back(property.id, "fehler=einheiten");

  let ergebnis;
  try {
    ergebnis = await synchronisiereSollstellungen({
      organizationId: verwalter.organizationId,
      property,
      planId: plan.id,
      geltung: { validFrom: plan.validFrom, validUntil: plan.validUntil, year: plan.year },
      items: plan.items.map((i) => ({
        costTypeId: i.costTypeId,
        distributionKey: i.costType.distributionKey,
        amountCents: i.amountCents,
        category: i.costType.category,
      })),
      units,
    });
  } catch {
    // Fehlende Stammdaten (MEA, Fläche) — dieselbe Ursache wie beim Beschluss.
    back(property.id, "fehler=stammdaten");
  }

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_DUE_POSTINGS_EXTENDED,
    targetType: "EconomicPlan",
    targetId: plan.id,
    meta: { ...ergebnis },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/hausgeld`);
  back(property.id, `fortgeschrieben=${ergebnis.angelegt}`);
}

// ── Zahlungen auf Forderungen anrechnen (§§ 366, 367 BGB) ───────────────────
// `Booking.unitId` sagt, von wem das Geld kam. Worauf es angerechnet wurde,
// stand nirgends — der Rückstand war eine Differenz zweier Summen und damit in
// vier Fällen falsch (siehe `payment-allocation.ts`). Diese Aktionen schreiben
// die Anrechnung als eigene Zeilen fest.

/**
 * Übernimmt den gesetzlichen Tilgungsvorschlag für eine Zahlung.
 *
 * Bewusst zweistufig: Die Oberfläche zeigt den Vorschlag, der Verwalter löst
 * ihn aus. § 366 Abs. 1 BGB lässt dem Schuldner das Recht, im Verwendungszweck
 * selbst zu bestimmen, worauf gezahlt wird — das kann nur ein Mensch lesen.
 */
export async function ordneZahlungZu(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const booking = await db.booking.findFirst({
    where: { id: bookingId, propertyId: property.id, kind: "EINNAHME", ...NOT_REVERSED },
    select: { id: true, unitId: true },
  });
  if (!booking) back(property.id, "fehler=buchung");
  if (!booking.unitId) back(property.id, "fehler=ohneeinheit");

  const rest = await offenerZahlungsbetrag(booking.id);
  if (rest <= 0) back(property.id, "fehler=schonzugeordnet");

  // § 366 Abs. 1 BGB: Hat der Zahlende im Verwendungszweck bestimmt, worauf er
  // zahlt, geht das der gesetzlichen Reihenfolge vor. Lesen kann das nur ein
  // Mensch — deshalb gibt der Verwalter den Zweck an, statt dass das Programm
  // im Fließtext rät.
  const zweckRoh = String(formData.get("zweck") ?? "ALLE");
  const zweck: Tilgungszweck =
    zweckRoh === "WIRTSCHAFTSPLAN" || zweckRoh === "SONDERUMLAGE" ? zweckRoh : "ALLE";

  const posten = await offenePostenDerEinheit(booking.unitId);
  const vorschlag = schlageZuordnungVor(rest, posten, new Date(), zweck);
  if (vorschlag.zuordnungen.length === 0) back(property.id, "fehler=keineforderung");

  await db.$transaction(
    vorschlag.zuordnungen.map((z) =>
      db.paymentAllocation.upsert({
        where: { bookingId_duePostingId: { bookingId: booking.id, duePostingId: z.duePostingId } },
        // Addieren ist hier richtig: Der Vorschlag rechnet ausschließlich mit
        // dem, was an Zahlung UND an Forderung noch offen ist — eine bereits
        // vorhandene Zeile ist darin schon abgezogen. Ein zweiter Lauf ohne
        // neue Bewegung schlägt deshalb gar nichts mehr vor.
        update: { amountCents: { increment: z.betragCents } },
        create: {
          organizationId: verwalter.organizationId,
          bookingId: booking.id,
          duePostingId: z.duePostingId,
          amountCents: z.betragCents,
          createdById: verwalter.id,
        },
      }),
    ),
  );

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PAYMENT_ALLOCATED,
    targetType: "Booking",
    targetId: booking.id,
    meta: {
      zuordnungen: vorschlag.zuordnungen.length,
      angerechnetCents: rest - vorschlag.restCents,
      guthabenCents: vorschlag.restCents,
      zweck,
    },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/hausgeld`);
  back(property.id, `angerechnet=${rest - vorschlag.restCents}&guthaben=${vorschlag.restCents}`);
}

/**
 * Hebt alle Anrechnungen einer Zahlung wieder auf.
 *
 * Nötig, weil eine Zuordnung eine Entscheidung ist und Entscheidungen falsch
 * sein können — etwa wenn die Tilgungsbestimmung im Verwendungszweck erst
 * später auffällt. Die Zahlung selbst bleibt unberührt; gelöst wird nur, worauf
 * sie angerechnet war.
 */
export async function loeseZuordnung(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const booking = await db.booking.findFirst({
    where: { id: bookingId, propertyId: property.id },
    select: { id: true },
  });
  if (!booking) back(property.id, "fehler=buchung");

  const { count } = await db.paymentAllocation.deleteMany({ where: { bookingId: booking.id } });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PAYMENT_ALLOCATION_CLEARED,
    targetType: "Booking",
    targetId: booking.id,
    meta: { entfernt: count },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/hausgeld`);
  back(property.id, "anrechnunggeloest=1");
}
