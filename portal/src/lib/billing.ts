// Billing-Gerüst (Phase 5). Bewusst Stripe-SDK-frei: das konkrete Preismodell
// und die Stripe-Anbindung (Checkout, Webhooks, Customer-Portal) folgen, sobald
// das Modell entschieden und die Keys hinterlegt sind. Hier nur die fachlichen
// Typen/Konstanten + sichere Helfer, damit der Rest der App schon damit arbeiten
// kann, ohne dass etwas bricht, wenn Stripe (noch) nicht konfiguriert ist.

import {
  BASIC_JE_EINHEIT_EUR,
  PLUS_JE_EINHEIT_EUR,
  jeEinheitNachStaffel,
} from "@/app/preise/preise-daten";

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
    // „Start" — der Zuschnitt steht seit der Preisseite fest (Start-Karte in
    // `app/preise/tarif-bereich.tsx`): WEG vollständig einrichten (Einheiten,
    // Miteigentumsanteile, Konten, Kostenarten, Zugänge) und alle Funktionen
    // ansehen — ohne Zeitlimit. Die Arbeitsfunktionen (Wirtschaftsplan,
    // Abrechnung, Hausgeld, Versammlung …) gehören zu Basic; welche Funktion
    // welchen Tarif braucht, sagt PLAN_FUNKTIONEN weiter unten.
    name: "Start",
    description:
      "Einrichten und Ansehen ohne Zeitlimit: WEG anlegen, Einheiten, " +
      "Anteile und Zugänge — alle Funktionen ansehen, ohne Zahlungsdaten.",
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

/**
 * Preis je Einheit und Monat in Cent für den Stripe-Checkout — nach Mengenstaffel.
 *
 * Der Checkout legt den Preis damit inline an (`price_data`), statt eine vorab
 * im Stripe-Dashboard gepflegte Preis-ID mit Volumen-Staffel zu verlangen:
 * Preise und Staffel stehen in `preise-daten.ts`, der einen Preisquelle — eine
 * zweite Pflege derselben Staffel in Stripe liefe früher oder später auseinander,
 * und ohne die Preis-IDs führte der Buchen-Knopf ins Leere.
 */
export function checkoutJeEinheitCents(tarif: "basic" | "plus", einheiten: number): number {
  const basis = tarif === "basic" ? BASIC_JE_EINHEIT_EUR : PLUS_JE_EINHEIT_EUR;
  return Math.round(jeEinheitNachStaffel(basis, einheiten) * 100);
}

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

// Die Felder der Organisation, aus denen sich der wirksame Tarif ableitet.
// `trialEndsAt` gehört dazu: Ohne das Ablaufdatum liefe eine Testphase ewig
// auf Pro-Niveau weiter — niemand stellt den Status automatisch um.
export type PlanQuelle = {
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
};

/**
 * Ist die Testphase vorbei, ohne dass ein Tarif gebucht wurde?
 *
 * `trialEndsAt === null` heißt: Testphase ohne Frist (die B&W-Tür legt keine
 * fest) — sie läuft dann nicht ab. Der Status bleibt bewusst "trialing", bis
 * gebucht oder gekündigt wird; abgelaufen ist eine **Ableitung**, kein eigener
 * gespeicherter Zustand, den ein Cron pflegen müsste.
 */
export function istTestphaseAbgelaufen(org: {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
}): boolean {
  return (
    org.subscriptionStatus === "trialing" &&
    org.trialEndsAt != null &&
    org.trialEndsAt.getTime() < Date.now()
  );
}

/**
 * Der Tarif, den die Organisation **gerade tatsächlich nutzt**.
 *
 * In der laufenden Testphase ist das immer `pro`: Neukunden bekommen den vollen
 * Funktionsumfang zum Ausprobieren, nicht den Grundtarif. Gespeichert bleibt
 * in `Organization.plan` der Tarif, auf den sie **nach** der Testphase
 * zurückfallen, solange nichts gebucht wurde — das ist eine andere Aussage und
 * gehört deshalb nicht überschrieben.
 *
 * Ist die Testphase **abgelaufen**, gilt der gespeicherte Tarif (in aller Regel
 * `free` = Start). Vorher lieferte diese Funktion für jeden "trialing"-Status
 * Pro — mangels Umstellung also unbegrenzt.
 */
export function aktiverPlan(org: PlanQuelle): PlanId {
  if (org.subscriptionStatus === "trialing" && !istTestphaseAbgelaufen(org)) return "pro";
  return (PLANS[org.plan as PlanId]?.id ?? "free") as PlanId;
}

// ── Funktionsumfang je Tarif ─────────────────────────────────────────────────
// Die EINE Quelle dafür, welche Funktion welchen Tarif voraussetzt. Seiten
// blenden damit aus, Server-Actions sperren damit — beides über hatPlanFunktion,
// nie über einen eigenen Plan-Vergleich in der Seite.
//
//   vollerUmfang    – die Arbeitsfunktionen (Wirtschaftsplan beschließen,
//                     Abrechnung erzeugen, Hausgeld, Versammlung einberufen …).
//                     Start (= free) hat sie nicht: einrichten + ansehen.
//   verwalterTicket – das Ticket-System zum zertifizierten Verwalter
//                     (§ 26a WEG), das Unterscheidungsmerkmal von Verwalter-Plus.
//                     `pro` schließt es ein: Die Testphase verspricht den vollen
//                     Funktionsumfang, und der ist auf wegportal24 Verwalter-Plus.
export const PLAN_FUNKTIONEN = {
  free: { vollerUmfang: false, verwalterTicket: false },
  basic: { vollerUmfang: true, verwalterTicket: false },
  plus: { vollerUmfang: true, verwalterTicket: true },
  pro: { vollerUmfang: true, verwalterTicket: true },
} as const satisfies Record<PlanId, Record<string, boolean>>;

export type PlanFunktion = keyof (typeof PLAN_FUNKTIONEN)["free"];

export function hatPlanFunktion(org: PlanQuelle, funktion: PlanFunktion): boolean {
  return PLAN_FUNKTIONEN[aktiverPlan(org)][funktion];
}

// ── Abo-Hinweis (Banner in der Portal-Shell) ─────────────────────────────────
// Was `past_due` und `canceled` BEDEUTEN, steht hier — nicht verstreut in
// Seiten:
//   past_due  → der volle Umfang bleibt (Stripe mahnt und versucht es erneut;
//               endgültiges Scheitern kommt als `canceled` per Webhook), aber
//               die Verwaltung sieht eine Warnung.
//   canceled  → der Webhook hat `plan` auf free zurückgesetzt; es gilt der
//               Start-Umfang. Der Hinweis sagt das, statt Funktionen stumm zu
//               sperren.
//   Testphase abgelaufen → ebenfalls Start-Umfang (siehe aktiverPlan) + Hinweis.
export type AboHinweis = "testphase-abgelaufen" | "zahlung-ueberfaellig" | "gekuendigt";

export function aboHinweis(org: PlanQuelle): AboHinweis | null {
  if (org.subscriptionStatus === "past_due") return "zahlung-ueberfaellig";
  if (org.subscriptionStatus === "canceled") return "gekuendigt";
  if (istTestphaseAbgelaufen(org)) return "testphase-abgelaufen";
  return null;
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
//
// „gesperrt" heißt seit dem 06.08.2026 NICHT mehr ausgesperrt: Es gilt der
// Start-Umfang der Preisseite („ohne Frist im Nacken") — das AboBanner im
// Portal-Layout weist darauf hin, einzelne Funktionen sperrt hatPlanFunktion.
// Die Buchungsseite /abo nutzt diesen Status weiterhin als Zugangswächter.
// Alles nur in der WEG-SaaS-Variante: Die B&W-Tür rechnet über
// Plattform-Rechnungen ab und wird über Organization.active gesteuert.
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
