import { NextResponse } from "next/server";
import { isBillingEnabled } from "@/lib/billing";

export const dynamic = "force-dynamic";

// Platzhalter für den Stripe-Webhook (Phase 5 – Gerüst).
// Sobald die Stripe-Anbindung steht, werden hier die Events verifiziert
// (Signaturprüfung mit STRIPE_WEBHOOK_SECRET) und auf die Organisation
// gemappt (subscriptionStatus/plan/stripe*-Felder aktualisieren).
export async function POST() {
  if (!isBillingEnabled()) {
    // Ohne konfiguriertes Stripe ist der Endpoint bewusst inaktiv.
    return NextResponse.json({ error: "Billing nicht konfiguriert" }, { status: 501 });
  }
  // TODO(Phase 5): Stripe-Event verifizieren und verarbeiten.
  return NextResponse.json({ received: true });
}
