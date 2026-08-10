import { NextResponse } from "next/server";
import { runIngest } from "@/lib/analytics/ingest";
import { isWegSaas } from "@/lib/app-mode";
import { isBillingEnabled } from "@/lib/billing";
import { alertBetreiber, mailOrgSuperAdmins } from "@/lib/billing-notify";
import { aboMengeSynchronisieren } from "@/lib/billing-sync";
import { db } from "@/lib/db";
import { mapStripeStatus, planFromPriceId, stripeOrNull } from "@/lib/stripe";
import { portalUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

// Täglicher Billing-Abgleich (Vercel-Cron, Absicherung wie api/cron/cleanup).
//
// Der Webhook ist der schnelle Weg, aber kein verlässlicher: Events können
// verloren gehen (Endpoint down, Reihenfolge vor dem Checkout, Zuordnung
// verloren) — und dann driften lokaler Abo-Status und Stripe still
// auseinander. Dieser Job ist die Wahrheits-Rückkopplung: Er fragt für jede
// Organisation mit Stripe-Abo den echten Zustand ab, korrigiert Abweichungen
// und meldet sie dem Betreiber.
//
// Zusätzlich erinnert er an das Ende der PORTALINTERNEN Testphase (trialEndsAt
// ohne Stripe-Abo) — dafür gibt es kein Stripe-Event, das übernimmt sonst
// niemand.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = stripeOrNull();
  if (!isBillingEnabled() || !stripe) {
    // Der Geschäftszahlen-Ingest läuft auch ohne Stripe (dann nur aus der
    // eigenen DB, mit Vermerk im Protokoll) — er darf am fehlenden Key
    // nicht mit scheitern.
    const ingest = await runIngest("stripe");
    return NextResponse.json({
      ok: true,
      skipped: "Billing nicht konfiguriert",
      businessIngest: ingest?.status ?? "kein Runner",
    });
  }

  const orgs = await db.organization.findMany({
    where: { stripeSubscriptionId: { not: null } },
    select: { id: true, name: true, subscriptionStatus: true, stripeSubscriptionId: true },
  });

  const korrigiert: string[] = [];
  const fehler: string[] = [];

  for (const org of orgs) {
    try {
      const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId!);
      const status = mapStripeStatus(sub.status);
      if (status !== org.subscriptionStatus) {
        // Tarif wie im Webhook aus dem Stripe-Preis ableiten — nie pauschal
        // „pro", das überschriebe einen gebuchten Basic-/Plus-Tarif.
        const tarifMeta = sub.metadata?.tarif;
        // Über ALLE Posten suchen — items[0] kann seit den Stellplätzen auch
        // die Stellplatz-Position sein, deren Preis-Id keinem Tarif entspricht.
        const planAusPreis =
          sub.items?.data?.map((item) => planFromPriceId(item.price?.id)).find(Boolean) ??
          // Inline erzeugte Preise (Checkout/Tarifwechsel ohne Env-Preis-Id)
          // erkennt planFromPriceId nicht — dann trägt das Abo den Tarif als
          // Metadatum, wie im Webhook.
          (tarifMeta === "basic" || tarifMeta === "plus" || tarifMeta === "pro"
            ? tarifMeta
            : null);
        await db.organization.update({
          where: { id: org.id },
          data: {
            subscriptionStatus: status,
            ...(status === "canceled"
              ? { plan: "free" }
              : planAusPreis
                ? { plan: planAusPreis }
                : {}),
          },
        });
        korrigiert.push(`${org.name} (${org.id}): ${org.subscriptionStatus} → ${status}`);
      }
      // Mengen-Rückkopplung: billing-sync verspricht „der nächste Abgleich
      // holt es nach", wenn ein Stripe-Aufruf beim Anlegen/Löschen einer
      // Einheit scheitert — DIESER Lauf ist der Abgleich. Ohne ihn bliebe
      // z. B. eine fehlende Stellplatz-Position dauerhaft fehlend, bis
      // zufällig wieder eine Einheit angefasst wird. Die Funktion prüft
      // Plan/Status selbst und fängt eigene Stripe-Fehler ab.
      await aboMengeSynchronisieren(org.id);
    } catch (err) {
      // Auch eine bei Stripe gelöschte Subscription landet hier — das ist eine
      // Drift, die der Betreiber sehen muss, keine, die still korrigiert wird.
      fehler.push(`${org.name} (${org.id}): ${String(err)}`);
    }
  }

  if (korrigiert.length > 0 || fehler.length > 0) {
    await alertBetreiber(
      "Billing-Abgleich: Abweichungen zwischen Stripe und Portal",
      [
        korrigiert.length > 0 ? `Korrigiert:\n${korrigiert.join("\n")}` : null,
        fehler.length > 0 ? `Nicht abgleichbar:\n${fehler.join("\n")}` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  // Erinnerung an das Ende der portalinternen Testphase. Das Fenster
  // [in 2, in 3 Tagen) sorgt dafür, dass der tägliche Lauf jede Organisation
  // genau EINMAL erinnert — ohne Merkfeld am Datensatz.
  let erinnert = 0;
  if (isWegSaas()) {
    const now = Date.now();
    const inZwei = new Date(now + 2 * 86_400_000);
    const inDrei = new Date(now + 3 * 86_400_000);
    const bald = await db.organization.findMany({
      where: {
        subscriptionStatus: "trialing",
        stripeSubscriptionId: null,
        trialEndsAt: { gte: inZwei, lt: inDrei },
      },
      select: { id: true, name: true },
    });
    for (const org of bald) {
      await mailOrgSuperAdmins(
        org.id,
        "Ihre Testphase endet in wenigen Tagen",
        `die Testphase für ${org.name} endet in wenigen Tagen. Danach ist das ` +
          `Portal bis zur Buchung gesperrt — Ihre Daten bleiben selbstverständlich erhalten.\n\n` +
          `Buchen Sie das Abo unter:\n\n${portalUrl("/verwaltung/abrechnung")}`,
      );
      erinnert++;
    }
  }

  // Geschäftszahlen-Ingest (BusinessDaily) im Anschluss — bewusst NACH dem
  // Abgleich, damit der Tagesschnappschuss die eben korrigierten Abo-Status
  // sieht. Huckepack statt eigenem Cron-Eintrag: Der Vercel-Hobby-Plan
  // erlaubt weder Stundentakt noch weitere Crons. Nach dem Plan-Upgrade den
  // Eintrag {"path": "/api/cron/ingest/business", "schedule": "0 * * * *"}
  // in vercel.json aufnehmen (der Endpoint existiert schon) — dieser Aufruf
  // hier darf dann trotzdem bleiben. Fehler fängt runIngest selbst und
  // protokolliert sie als IngestRun (/plattform/analytics/system).
  const ingest = await runIngest("stripe");

  return NextResponse.json({
    ok: true,
    geprueft: orgs.length,
    korrigiert: korrigiert.length,
    fehler: fehler.length,
    trialErinnerungen: erinnert,
    businessIngest: ingest?.status ?? "kein Runner",
  });
}
