-- Phase 3: interner Handwerker (Eigenleistung) + Freigabe-Gate für externe Beauftragung.
-- Handwerker können als „intern" markiert werden; externe Handwerker dürfen erst
-- nach einer bewussten Verwalter-Freigabe je Vorgang beauftragt werden.

ALTER TABLE "Craftsman" ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Ticket" ADD COLUMN "externalReleasedAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "externalReleasedById" TEXT;
