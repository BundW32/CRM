// Billing-Gerüst (Phase 5). Bewusst Stripe-SDK-frei: das konkrete Preismodell
// und die Stripe-Anbindung (Checkout, Webhooks, Customer-Portal) folgen, sobald
// das Modell entschieden und die Keys hinterlegt sind. Hier nur die fachlichen
// Typen/Konstanten + sichere Helfer, damit der Rest der App schon damit arbeiten
// kann, ohne dass etwas bricht, wenn Stripe (noch) nicht konfiguriert ist.

import { BASIC_JE_EINHEIT_EUR, PLUS_JE_EINHEIT_EUR } from "@/app/preise/preise-daten";

export type PlanId = "free" | "pro" | "basic" | "plus";

export type Plan = {
  id: PlanId;
  name: string;
  description: string;
  // Preis bewusst offen (null = noch nicht festgelegt). Cent/Monat, sobald geklärt.
  monthlyPriceCents: number | null;
  /**
   * Preis je Einheit und Monat in Cent — das Modell der wegportal24-Tarife
   * (Quelle: `app/preise/preise-daten.ts`, die eine Preisquelle). Tarife mit
   * diesem Feld werden im Checkout mit Menge = Einheitenzahl gebucht; die
   * Mengenstaffel liegt als Volumen-Preisstufen am Stripe-Preis selbst.
   */
  perUnitCents?: number;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    // Nicht mehr „zum Ausprobieren": Ausprobiert wird der volle Umfang — die
    // Testphase liefert ihn komplett. Free ist der Tarif DANACH, und sein
    // Zuschnitt steht noch nicht fest; das gehört hier hin und nicht in eine
    // Beschreibung, die einen fertigen Grundtarif behauptet.
    description: "Grundfunktionen nach der Testphase. Der Umfang wird noch festgelegt.",
    monthlyPriceCents: 0,
  },
  // Die pauschale Pro-Stufe der B&W-Variante (professionelle Verwaltungen).
  pro: {
    id: "pro",
    name: "Pro",
    description: "Voller Funktionsumfang für aktive Hausverwaltungen.",
    monthlyPriceCents: null, // Preis folgt
  },
  // Die beiden wegportal24-Tarife: je Einheit und Monat, alle Zugänge inklusive.
  basic: {
    id: "basic",
    name: "Basic",
    description:
      "Die komplette Selbstverwaltung. Alle Zugänge inklusive — Eigentümer, " +
      "Beirat und Mieter zählen nicht extra.",
    monthlyPriceCents: null,
    perUnitCents: Math.round(BASIC_JE_EINHEIT_EUR * 100),
  },
  plus: {
    id: "plus",
    name: "Verwalter-Plus",
    description:
      "Alles aus Basic — plus ein Ticket-System zu einem zertifizierten " +
      "Verwalter (§ 26a WEG) für die Fragen Ihrer Gemeinschaft.",
    monthlyPriceCents: null,
    perUnitCents: Math.round(PLUS_JE_EINHEIT_EUR * 100),
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

// ── Abo-Durchsetzung ────────────────────────────────────────────────────────
//
// DIE eine Stelle, die aus dem Abo-Zustand ableitet, was die Organisation
// gerade darf. Verstreute Einzelabfragen („ist der Status active?") an
// Seiten oder Actions sind verboten — sie machen jede Änderung der
// Kulanzregeln zum Suchspiel über die Codebasis.
//
//   voll     – arbeiten wie immer (aktives Abo oder laufende Testphase)
//   kulanz   – Zahlung überfällig, Stripe wiederholt sie noch (Smart
//              Retries). Zugriff bleibt, die Oberfläche mahnt. Scheitert
//              auch der letzte Versuch, setzt der Webhook „canceled".
//   gesperrt – Testphase abgelaufen ohne Buchung oder Abo gekündigt.
//              Das Portal leitet auf die Sperrseite /abo um.
//
// Durchgesetzt wird das im Portal-Layout (src/app/(portal)/layout.tsx) und
// NUR in der WEG-SaaS-Variante: Die B&W-Tür rechnet über Plattform-Rechnungen
// ab und wird über Organization.active gesteuert.
export type ZugriffsStatus = "voll" | "kulanz" | "gesperrt";

export function zugriffsStatus(
  org: { subscriptionStatus: string; trialEndsAt: Date | null },
  now: Date = new Date(),
): ZugriffsStatus {
  switch (org.subscriptionStatus as SubscriptionStatus) {
    case "active":
      return "voll";
    case "trialing":
      // Ohne Enddatum (etwa von der Plattform angelegte Organisationen) läuft
      // die Testphase unbefristet — gesperrt wird nur ein ABGELAUFENES Datum.
      return !org.trialEndsAt || org.trialEndsAt.getTime() > now.getTime()
        ? "voll"
        : "gesperrt";
    case "past_due":
      return "kulanz";
    case "canceled":
      return "gesperrt";
    default:
      // Unbekannter Status sperrt niemanden aus: Er kann nur durch Drift oder
      // Handeingriff entstehen, und dafür gibt es den täglichen Abgleich
      // (api/cron/billing-abgleich) — nicht die Aussperrung des Kunden.
      return "voll";
  }
}
