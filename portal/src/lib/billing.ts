// Billing-Gerüst (Phase 5). Bewusst Stripe-SDK-frei: das konkrete Preismodell
// und die Stripe-Anbindung (Checkout, Webhooks, Customer-Portal) folgen, sobald
// das Modell entschieden und die Keys hinterlegt sind. Hier nur die fachlichen
// Typen/Konstanten + sichere Helfer, damit der Rest der App schon damit arbeiten
// kann, ohne dass etwas bricht, wenn Stripe (noch) nicht konfiguriert ist.

export type PlanId = "free" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  description: string;
  // Preis bewusst offen (null = noch nicht festgelegt). Cent/Monat, sobald geklärt.
  monthlyPriceCents: number | null;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    // Nicht mehr „zum Ausprobieren": Ausprobiert wird Pro — die Testphase
    // liefert den vollen Funktionsumfang. Free ist der Tarif DANACH, und sein
    // Zuschnitt steht noch nicht fest; das gehört hier hin und nicht in eine
    // Beschreibung, die einen fertigen Grundtarif behauptet.
    description: "Grundfunktionen nach der Testphase. Der Umfang wird noch festgelegt.",
    monthlyPriceCents: 0,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Voller Funktionsumfang für aktive Hausverwaltungen.",
    monthlyPriceCents: null, // Preis folgt
  },
};

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "canceled",
];

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Testphase",
  active: "Aktiv",
  past_due: "Zahlung überfällig",
  canceled: "Gekündigt",
};

export function planLabel(plan: string): string {
  return PLANS[plan as PlanId]?.name ?? plan;
}

/**
 * Der Tarif, den die Organisation **gerade tatsächlich nutzt**.
 *
 * In der Testphase ist das immer `pro`: Neukunden bekommen den vollen
 * Funktionsumfang zum Ausprobieren, nicht den Grundtarif. Gespeichert bleibt
 * in `Organization.plan` der Tarif, auf den sie **nach** der Testphase
 * zurückfallen, solange nichts gebucht wurde — das ist eine andere Aussage und
 * gehört deshalb nicht überschrieben.
 *
 * Vorher zeigte die Abrechnungsseite den gespeicherten Wert und meldete
 * „Aktueller Tarif: Free / Status: Testphase". Beides zusammen ergibt keinen
 * Sinn — wer in der Testphase ist, testet etwas, und zwar Pro.
 */
export function aktiverPlan(org: { plan: string; subscriptionStatus: string }): PlanId {
  if (org.subscriptionStatus === "trialing") return "pro";
  return (PLANS[org.plan as PlanId]?.id ?? "free") as PlanId;
}

export function subscriptionStatusLabel(status: string): string {
  return STATUS_LABELS[status as SubscriptionStatus] ?? status;
}

// Ist die Stripe-Anbindung scharf geschaltet? (Wie beim Mailer: ohne Key ein
// kontrollierter No-Op, damit lokale/Preview-Umgebungen funktionieren.)
export function isBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
