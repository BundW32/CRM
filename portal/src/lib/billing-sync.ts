import type Stripe from "stripe";
import { MAX_EINHEITEN } from "@/app/preise/preise-daten";
import { checkoutJeEinheitCents } from "./billing";
import { db } from "./db";
import { stripeOrNull } from "./stripe";

// ── Mengenabgleich: Einheitenzahl ↔ Stripe-Abo ──────────────────────────────
// Die wegportal24-Tarife rechnen je Einheit, aber die Menge stand bisher nur
// EINMAL fest — beim Checkout. Wer danach eine Einheit anlegte (oder ein
// zweites Objekt), zahlte weiter den alten Betrag. Dieser Abgleich zieht die
// Abo-Menge nach und rechnet dabei die Mengenstaffel neu (ab 5 bzw. 9
// Einheiten ändert sich auch der Preis je Einheit).
//
// Aufzurufen NACH jeder Aktion, die Einheiten anlegt oder löscht. Fehler
// brechen die auslösende Aktion nie ab: Eine gescheiterte Stripe-Anfrage darf
// das Anlegen einer Einheit nicht verhindern — der nächste Abgleich holt es
// nach.
export async function aboMengeSynchronisieren(organizationId: string): Promise<void> {
  const stripe = stripeOrNull();
  if (!stripe) return;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, subscriptionStatus: true, stripeSubscriptionId: true },
  });
  if (!org?.stripeSubscriptionId) return;
  if (org.plan !== "basic" && org.plan !== "plus") return;
  // Nur laufende Abos: canceled hat nichts mehr abzugleichen, und für
  // "past_due" gilt Kulanz — die Menge wird trotzdem korrekt gehalten.
  if (org.subscriptionStatus !== "active" && org.subscriptionStatus !== "past_due") return;

  const quantity = await db.unit.count({
    where: { property: { organizationId, managementType: "WEG" } },
  });
  // Außerhalb des Self-Service-Rahmens wird NICHT automatisch geändert: Bei 0
  // Einheiten wäre die stille Folge ein Abo über nichts, oberhalb der Grenze
  // gehört die Gemeinschaft ins Angebotsgespräch (wie beim Checkout).
  if (quantity < 1 || quantity > MAX_EINHEITEN) return;

  try {
    const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    const item = sub.items.data[0];
    if (!item) return;

    const unitAmount = checkoutJeEinheitCents(org.plan, quantity);
    const preisStimmt =
      item.price.billing_scheme === "tiered" || item.price.unit_amount === unitAmount;
    if (item.quantity === quantity && preisStimmt) return;

    await stripe.subscriptions.update(sub.id, {
      items: [aboPosten(item, quantity, unitAmount)],
      // Anteilige Verrechnung mit der nächsten Rechnung — eine neue Einheit
      // mitten im Monat kostet den Restmonat, nicht den vollen.
      proration_behavior: "create_prorations",
    });
  } catch (err) {
    console.error("Stripe-Mengenabgleich fehlgeschlagen", err);
  }
}

// Der aktualisierte Abo-Posten. Liegt am Stripe-Preis eine Volumen-Staffel
// (billing_scheme "tiered", der Weg über STRIPE_PRICE_*), genügt die neue
// Menge — den Preis je Einheit bestimmt die Staffel am Preis selbst. Beim
// Inline-Preis (price_data aus dem Checkout) wird er hier neu gesetzt; das
// Produkt bleibt dasselbe, damit Rechnungen weiter denselben Namen tragen.
function aboPosten(
  item: Stripe.SubscriptionItem,
  quantity: number,
  unitAmount: number,
): Stripe.SubscriptionUpdateParams.Item {
  if (item.price.billing_scheme === "tiered") {
    return { id: item.id, quantity };
  }
  const product =
    typeof item.price.product === "string" ? item.price.product : item.price.product.id;
  return {
    id: item.id,
    quantity,
    price_data: {
      currency: "eur",
      product,
      recurring: { interval: "month" },
      unit_amount: unitAmount,
    },
  };
}
