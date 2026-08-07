// Gemeinsame Checkout-Erzeugung — von der Abrechnungsseite UND der Sperrseite
// (/abo) genutzt. Beide Aufrufer unterscheiden sich nur in den
// Rücksprung-Adressen; Tarifwahl, Einheitenzählung und Session-Aufbau darf es
// nur einmal geben, sonst laufen die beiden Buchungswege auseinander.
//
// Zwei Modelle:
// - `basic` / `plus` (wegportal24): Preis JE EINHEIT — die Menge ist die
//   Einheitenzahl der WEG-Objekte der Organisation, die Mengenstaffel liegt
//   als Volumen-Preisstufen am Stripe-Preis selbst.
// - `pro` (B&W-Variante): pauschal je Organisation, Menge 1.
import { MAX_EINHEITEN } from "@/app/preise/preise-daten";
import type { PlanId } from "@/lib/billing";
import { db } from "@/lib/db";
import {
  stripeOrNull,
  stripePriceBasic,
  stripePricePlus,
  stripePricePro,
} from "@/lib/stripe";

export type CheckoutFehler =
  | "nicht_konfiguriert"
  | "keine_einheiten"
  | "zu_viele_einheiten"
  | "checkout_fehlgeschlagen";
export type CheckoutErgebnis = { url: string } | { fehler: CheckoutFehler };

// Formularwert → Tarif. Unbekanntes fällt auf "pro" zurück — den Alt-Zustand
// vor den Einheiten-Tarifen.
export function parseTarif(raw: unknown): PlanId {
  return raw === "basic" ? "basic" : raw === "plus" ? "plus" : "pro";
}

export async function starteCheckout(
  org: { id: string; stripeCustomerId: string | null },
  tarif: PlanId,
  successUrl: string,
  cancelUrl: string,
): Promise<CheckoutErgebnis> {
  const stripe = stripeOrNull();
  const price =
    tarif === "basic"
      ? stripePriceBasic()
      : tarif === "plus"
        ? stripePricePlus()
        : stripePricePro();
  if (!stripe || !price) {
    // Welche Variable fehlt, gehört in die Logs — auf der Seite steht sonst
    // nur „nicht verfügbar", und die Fehlersuche beginnt beim Raten.
    console.error(
      `Checkout nicht konfiguriert: tarif=${tarif}, key=${Boolean(stripe)}, price=${Boolean(price)}`,
    );
    return { fehler: "nicht_konfiguriert" };
  }
  // Ohne absolute Rücksprung-Adressen lehnt Stripe die success_url ab und die
  // Session-Erstellung wirft — der Klick bliebe ohne jede Rückmeldung stecken.
  if (!successUrl.startsWith("http")) {
    console.error("Checkout nicht konfiguriert: PORTAL_BASE_URL fehlt");
    return { fehler: "nicht_konfiguriert" };
  }

  let quantity = 1;
  if (tarif === "basic" || tarif === "plus") {
    // Die Einheit ist die Abrechnungsgröße: Sie steht in der Teilungserklärung
    // und ändert sich nicht — gezählt wird über alle WEG-Objekte der
    // Organisation (selbstverwaltete WEGs haben in aller Regel genau eines).
    quantity = await db.unit.count({
      where: { property: { organizationId: org.id, managementType: "WEG" } },
    });
    if (quantity < 1) return { fehler: "keine_einheiten" };
    // Oberhalb der Grenze ist Selbstverwaltung kein Self-Service-Fall mehr —
    // dieselbe Grenze wie auf der Preisseite.
    if (quantity > MAX_EINHEITEN) return { fehler: "zu_viele_einheiten" };
  }

  // Scheitert die Session-Erstellung (falsche Preis-ID, Test-Preis mit
  // Live-Schlüssel, Währungs-Konflikt …), soll der Klick eine verständliche
  // Meldung zeigen — nicht in einem unbehandelten Serverfehler enden. Der
  // eigentliche Grund steht in den Vercel-Logs und im Stripe-Dashboard.
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity }],
      client_reference_id: org.id,
      customer: org.stripeCustomerId ?? undefined,
      // Der Webhook liest den gebuchten Tarif aus den Metadaten — die Preis-Id
      // allein verrät ihn nicht, ohne sie erneut gegen die Env zu halten.
      metadata: { tarif },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return session.url ? { url: session.url } : { fehler: "checkout_fehlgeschlagen" };
  } catch (err) {
    console.error(`Stripe-Checkout fehlgeschlagen (tarif=${tarif}, quantity=${quantity})`, err);
    return { fehler: "checkout_fehlgeschlagen" };
  }
}
