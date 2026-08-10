import type Stripe from "stripe";
import { MAX_EINHEITEN } from "@/app/preise/preise-daten";
import { STELLPLATZ_CENTS, checkoutJeEinheitCents } from "./billing";
import { zaehleWegMengen } from "./billing-mengen";
import { db } from "./db";
import {
  STELLPLATZ_PRODUKT_METADATUM,
  istStellplatzPosten,
  planFromPriceId,
  stripeOrNull,
  stripePriceStellplatz,
} from "./stripe";

// ── Mengenabgleich: Einheiten & Stellplätze ↔ Stripe-Abo ────────────────────
// Die wegportal24-Tarife rechnen je Einheit, aber die Menge stand bisher nur
// EINMAL fest — beim Checkout. Wer danach eine Einheit anlegte (oder ein
// zweites Objekt), zahlte weiter den alten Betrag. Dieser Abgleich zieht die
// Abo-Menge nach und rechnet dabei die Mengenstaffel neu (ab 5 bzw. 9
// Einheiten ändert sich auch der Preis je Einheit).
//
// Das Abo trägt bis zu ZWEI Posten: den Tarif je Einheit (Wohn-/Gewerbe-
// einheiten, Staffelpreis) und die Stellplätze (Einheiten vom Typ STELLPLATZ,
// flach 1 € je Stellplatz, ohne Staffel). Beide Mengen werden hier getrennt
// nachgezogen; der Stellplatz-Posten entsteht und verschwindet mit dem
// Bestand. Unterschieden werden die Posten über die Preis-Id bzw. das
// Produkt-Metadatum (istStellplatzPosten) — deshalb die Produkt-Expansion.
//
// Aufzurufen NACH jeder Aktion, die Einheiten anlegt, löscht oder ihren Typ
// ändert. Fehler brechen die auslösende Aktion nie ab: Eine gescheiterte
// Stripe-Anfrage darf das Anlegen einer Einheit nicht verhindern — der
// nächste Abgleich holt es nach.
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

  const { einheiten, stellplaetze } = await zaehleWegMengen(organizationId);
  // Außerhalb des Self-Service-Rahmens wird der TARIF-Posten nicht automatisch
  // geändert: Bei 0 Einheiten wäre die stille Folge ein Abo über nichts,
  // oberhalb der Grenze gehört die Gemeinschaft ins Angebotsgespräch (wie beim
  // Checkout). Die Grenzen zählen nur die Einheiten — Stellplätze sind keine.
  // Der STELLPLATZ-Posten wird trotzdem nachgezogen: Wer alle Wohnungen
  // löscht, aber Stellplätze behält, soll nicht weiter für gelöschte
  // Stellplatz-Mengen (oder einen verwaisten Posten) zahlen.
  const einheitenImRahmen = einheiten >= 1 && einheiten <= MAX_EINHEITEN;

  try {
    const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId, {
      expand: ["items.data.price.product"],
    });
    const stellplatzItem = sub.items.data.find((item) => istStellplatzPosten(item));
    // Den Tarif-Posten bevorzugt über die Tarif-Preis-Id erkennen. Der Umweg
    // über „alles außer Stellplatz" bleibt als Rückfall (inline erzeugte
    // Preise haben keine Env-Id) — aber wenn eine Preis-Id eindeutig zum
    // gebuchten Tarif gehört, gewinnt sie. Sonst könnte eine verstellte
    // STRIPE_PRICE_STELLPLATZ-Variable den Stellplatz-Posten zum Tarif-Posten
    // erklären, und der bekäme Einheitenmenge und Einheitenpreis geschrieben.
    const tarifItem =
      sub.items.data.find((item) => planFromPriceId(item.price.id) === org.plan) ??
      sub.items.data.find((item) => !istStellplatzPosten(item));

    const updates: Stripe.SubscriptionUpdateParams.Item[] = [];
    if (tarifItem && einheitenImRahmen) {
      const unitAmount = checkoutJeEinheitCents(org.plan, einheiten);
      const preisStimmt =
        tarifItem.price.billing_scheme === "tiered" || tarifItem.price.unit_amount === unitAmount;
      if (tarifItem.quantity !== einheiten || !preisStimmt) {
        updates.push(aboPosten(tarifItem, einheiten, unitAmount));
      }
    }
    if (stellplatzItem) {
      // Preisprüfung symmetrisch zum Tarif-Posten: Ändert sich der
      // Stellplatzpreis in preise-daten.ts, ziehen Bestandsabos mit
      // Inline-Preis nach. Der Env-Preis (Dashboard) bleibt maßgeblich.
      const preisStimmt =
        stellplatzItem.price.id === stripePriceStellplatz() ||
        stellplatzItem.price.unit_amount === STELLPLATZ_CENTS;
      if (stellplaetze === 0) {
        // Kein Stellplatz mehr im Bestand — der Posten verschwindet, statt mit
        // Menge 0 als toter Eintrag auf jeder Rechnung zu stehen.
        updates.push({ id: stellplatzItem.id, deleted: true });
      } else if (stellplatzItem.quantity !== stellplaetze || !preisStimmt) {
        updates.push(stellplatzPosten(stellplatzItem, stellplaetze, preisStimmt));
      }
    } else if (stellplaetze > 0) {
      updates.push(await neuerStellplatzPosten(stripe, stellplaetze));
    }
    if (updates.length === 0) return;

    await stripe.subscriptions.update(sub.id, {
      items: updates,
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

// Der aktualisierte Stellplatz-Posten. Stimmt nur die Menge nicht, genügt sie;
// weicht der Inline-Preis vom aktuellen Stellplatzpreis ab, wird er wie beim
// Tarif-Posten neu gesetzt (Produkt bleibt — Rechnungen tragen weiter
// denselben Namen und das Kennzeichen-Metadatum bleibt am Produkt).
function stellplatzPosten(
  item: Stripe.SubscriptionItem,
  quantity: number,
  preisStimmt: boolean,
): Stripe.SubscriptionUpdateParams.Item {
  if (preisStimmt) return { id: item.id, quantity };
  const product =
    typeof item.price.product === "string" ? item.price.product : item.price.product.id;
  return {
    id: item.id,
    quantity,
    price_data: {
      currency: "eur",
      product,
      recurring: { interval: "month" },
      unit_amount: STELLPLATZ_CENTS,
    },
  };
}

// Ein NEUER Stellplatz-Posten am laufenden Abo — nötig, wenn die Gemeinschaft
// beim Checkout noch keine Stellplätze hatte und später welche anlegt. Ohne
// gepflegte Env-Preis-Id braucht `price_data` am Abo eine Produkt-Id; das
// Produkt wird dann mit dem Kennzeichen-Metadatum angelegt, damit der nächste
// Abgleich den Posten wiedererkennt.
async function neuerStellplatzPosten(
  stripe: Stripe,
  quantity: number,
): Promise<Stripe.SubscriptionUpdateParams.Item> {
  const envId = stripePriceStellplatz();
  if (envId) return { price: envId, quantity };
  const product = await stripe.products.create({
    name: "wegportal24 Stellplatz/Garage",
    metadata: { ...STELLPLATZ_PRODUKT_METADATUM },
  });
  return {
    quantity,
    price_data: {
      currency: "eur",
      product: product.id,
      recurring: { interval: "month" },
      unit_amount: STELLPLATZ_CENTS,
    },
  };
}
