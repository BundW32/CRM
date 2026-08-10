// Ingest der Geschäftszahlen: befüllt BusinessDaily (Quelle "stripe" der
// Registry in ingest.ts). Läuft stündlich per Cron und auf Knopfdruck von
// /plattform/analytics/system.
//
// Zwei Sorten von Zahlen, zwei Verfahren:
// - BESTAND (aktive Abos, Trials, Mengen, MRR) ist ein Schnappschuss des
//   Augenblicks. Der stündliche Lauf überschreibt die heutige Zeile — die
//   letzte Fassung des Tages ist der Tagesendstand. Rückwirkend ist ein
//   Bestand nicht rekonstruierbar; fehlende Alt-Tage bleiben leer bzw. 0.
// - EREIGNISSE (Registrierungen, neue/gekündigte Abos) hängen an Zeitstempeln
//   (Organization.createdAt, TrackEvent subscribed/canceled) und werden für
//   die letzten Tage bei jedem Lauf neu ausgezählt — Nachzügler nach dem
//   letzten Lauf eines Tages gehen so nicht verloren.
//
// Stripe-Abgleich (Stripe ist die Wahrheit für Geld): Der Lauf zählt die
// aktiven Abos und deren Beträge auch bei Stripe. Weichen die Werte ab, gilt
// Stripe für den MRR, und die Differenz steht im IngestRun-Protokoll. Preise
// mit Volumen-Staffeln liefern je Posten kein unit_amount — dann bleibt der
// DB-Wert stehen und das Protokoll sagt, dass der Betragsvergleich nicht
// möglich war (der Mengen-/Statusabgleich läuft täglich in billing-abgleich).

import { mrrCentsFuer } from "@/lib/analytics/business";
import type { IngestErgebnis } from "@/lib/analytics/ingest";
import { utcTag } from "@/lib/analytics/zeitraum";
import { zaehleWegMengen } from "@/lib/billing-mengen";
import { db } from "@/lib/db";
import { stripeOrNull } from "@/lib/stripe";

const TAG_MS = 86_400_000;
// So viele zurückliegende Tage werden je Lauf für die Ereignis-Zahlen neu
// ausgezählt. Eine Woche fängt auch einen mehrtägigen Cron-Ausfall auf.
const NACHTRAG_TAGE = 7;

type EreignisZahlen = { signups: number; newSubs: number; canceledSubs: number };

async function ereignisZahlenFuer(tag: Date): Promise<EreignisZahlen> {
  const fenster = { gte: tag, lt: new Date(tag.getTime() + TAG_MS) };
  const [signups, newSubs, canceledSubs] = await Promise.all([
    db.organization.count({ where: { createdAt: fenster } }),
    db.trackEvent.count({ where: { type: "subscribed", ts: fenster } }),
    db.trackEvent.count({ where: { type: "canceled", ts: fenster } }),
  ]);
  return { signups, newSubs, canceledSubs };
}

type StripeVergleich = {
  aktiveSubs: number;
  mrrCents: number | null; // null = mindestens ein Posten ohne unit_amount
  hinweis: string | null;
};

async function stripeZahlen(): Promise<StripeVergleich | null> {
  const stripe = stripeOrNull();
  if (!stripe) return null;
  let aktiveSubs = 0;
  let mrrCents = 0;
  let bezifferbar = true;
  for await (const sub of stripe.subscriptions.list({ status: "active", limit: 100 })) {
    aktiveSubs += 1;
    for (const item of sub.items?.data ?? []) {
      const betrag = item.price?.unit_amount;
      if (betrag == null) {
        // Volumen-Staffelpreis: Stripe nennt je Posten keinen Stückpreis.
        bezifferbar = false;
        continue;
      }
      mrrCents += betrag * (item.quantity ?? 1);
    }
  }
  return {
    aktiveSubs,
    mrrCents: bezifferbar ? mrrCents : null,
    hinweis: bezifferbar
      ? null
      : "Stripe-Beträge nicht vollständig bezifferbar (Staffelpreis ohne unit_amount)",
  };
}

export async function businessIngestRunner(): Promise<IngestErgebnis> {
  const now = new Date();
  const heute = utcTag(now);
  const meldungen: string[] = [];

  // ── Bestand aus der eigenen Datenbank ─────────────────────────────────────
  const orgs = await db.organization.findMany({
    select: { id: true, plan: true, subscriptionStatus: true, trialEndsAt: true },
  });
  const aktive = orgs.filter((o) => o.subscriptionStatus === "active");
  const activeTrials = orgs.filter(
    (o) =>
      o.subscriptionStatus === "trialing" &&
      (!o.trialEndsAt || o.trialEndsAt.getTime() > now.getTime()),
  ).length;

  let billedUnits = 0;
  let billedStellplaetze = 0;
  let mrrCents = 0;
  let proOhnePreis = 0;
  for (const org of aktive) {
    const mengen = await zaehleWegMengen(org.id);
    billedUnits += mengen.einheiten;
    billedStellplaetze += mengen.stellplaetze;
    const beitrag = mrrCentsFuer(org.plan, mengen.einheiten, mengen.stellplaetze);
    mrrCents += beitrag;
    if (beitrag === 0 && org.plan === "pro") proOhnePreis += 1;
  }
  if (proOhnePreis > 0) {
    meldungen.push(`${proOhnePreis} Pro-Abo(s) ohne hinterlegten Preis zählen mit MRR 0`);
  }

  // ── Abgleich gegen Stripe (Stripe gewinnt beim Geld) ──────────────────────
  let partial = false;
  try {
    const stripe = await stripeZahlen();
    if (!stripe) {
      meldungen.push("ohne Stripe-Abgleich (kein STRIPE_SECRET_KEY)");
    } else {
      if (stripe.hinweis) meldungen.push(stripe.hinweis);
      if (stripe.aktiveSubs !== aktive.length) {
        meldungen.push(
          `Abweichung aktive Abos: DB ${aktive.length}, Stripe ${stripe.aktiveSubs} — der tägliche Billing-Abgleich zieht den Status gerade`,
        );
      }
      if (stripe.mrrCents != null && stripe.mrrCents !== mrrCents) {
        meldungen.push(
          `Abweichung MRR: DB ${mrrCents} Cent, Stripe ${stripe.mrrCents} Cent — Stripe übernommen`,
        );
        mrrCents = stripe.mrrCents;
      }
    }
  } catch (err) {
    partial = true;
    meldungen.push(`Stripe-Abgleich fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
  }

  // ── Heutige Zeile schreiben (Bestand + Ereignisse) ────────────────────────
  const heuteEreignisse = await ereignisZahlenFuer(heute);
  const bestand = {
    activeTrials,
    activeSubs: aktive.length,
    billedUnits,
    billedStellplaetze,
    mrrCents,
  };
  await db.businessDaily.upsert({
    where: { date: heute },
    create: { date: heute, ...bestand, ...heuteEreignisse },
    update: { ...bestand, ...heuteEreignisse },
  });
  let rows = 1;

  // ── Ereignis-Zahlen der Vortage nachziehen ────────────────────────────────
  // Nur die Ereignis-Felder: Der gespeicherte Bestand vergangener Tage ist
  // deren Tagesendstand und wird nie überschrieben. Fehlt ein Alt-Tag ganz
  // (Cron-Ausfall), entsteht er mit Bestand 0 — sichtbar als Lücke, nicht als
  // erfundener Wert.
  for (let i = 1; i <= NACHTRAG_TAGE; i++) {
    const tag = new Date(heute.getTime() - i * TAG_MS);
    const ereignisse = await ereignisZahlenFuer(tag);
    await db.businessDaily.upsert({
      where: { date: tag },
      create: {
        date: tag,
        activeTrials: 0,
        activeSubs: 0,
        billedUnits: 0,
        billedStellplaetze: 0,
        mrrCents: 0,
        ...ereignisse,
      },
      update: ereignisse,
    });
    rows += 1;
  }

  return {
    rows,
    partial,
    message: meldungen.length > 0 ? meldungen.join("; ") : `MRR ${mrrCents} Cent (brutto)`,
  };
}
