-- Phase 5: Billing-Gerüst (Organisation) + E-Mail-Verifizierung (User)
ALTER TABLE "Organization" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "Organization" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'trialing';
ALTER TABLE "Organization" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerifyToken" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerifyExpiry" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_emailVerifyToken_key" ON "User"("emailVerifyToken");

-- Bestehende Nutzer gelten als verifiziert (Bestandsschutz; nur neue
-- Selbstregistrierungen starten unbestätigt).
UPDATE "User" SET "emailVerifiedAt" = "createdAt";
