-- Stellvertretende Stimmabgabe durch den Verwalter (Notiz 8): trägt für einen
-- Eigentümer, der die App nicht nutzt, dessen schriftliche Stimme ein – mit
-- optionalem Nachweis (Bild/PDF). userId bleibt der abstimmende Eigentümer,
-- castByUserId ist der eintragende Verwalter. Additiv, nullable.
ALTER TABLE "ResolutionVote" ADD COLUMN IF NOT EXISTS "castByUserId" TEXT;
ALTER TABLE "ResolutionVote" ADD COLUMN IF NOT EXISTS "proofStoredName" TEXT;
ALTER TABLE "ResolutionVote" ADD COLUMN IF NOT EXISTS "proofFileName" TEXT;
ALTER TABLE "ResolutionVote" ADD COLUMN IF NOT EXISTS "proofMimeType" TEXT;

CREATE INDEX IF NOT EXISTS "ResolutionVote_castByUserId_idx" ON "ResolutionVote"("castByUserId");

DO $$ BEGIN
  ALTER TABLE "ResolutionVote" ADD CONSTRAINT "ResolutionVote_castByUserId_fkey"
    FOREIGN KEY ("castByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
