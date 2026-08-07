-- Idempotenz-Wand fuer Stripe-Webhooks (SaaS-Fundament-Check B-3).
--
-- Stripe liefert Events mehrfach (Retries bei ausbleibender 200-Antwort).
-- Der Handler traegt jede Event-Id VOR der Verarbeitung hier ein; ein zweites
-- Eintreffen scheitert am Primaerschluessel und wird ohne Wirkung beantwortet.
-- Ohne diese Wand wuerde jede Wiederholung erneut verarbeitet -- doppelte
-- Status-Umstellungen waeren folgenlos, doppelte Kunden-E-Mails nicht.
CREATE TABLE "StripeEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- Fuer den taeglichen Aufraeum-Job (lib/retention.ts).
CREATE INDEX "StripeEvent_createdAt_idx" ON "StripeEvent"("createdAt");
