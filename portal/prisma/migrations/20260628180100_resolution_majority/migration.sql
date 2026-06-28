-- Mehrheitsart je Beschluss + Stimmenzahl beim Objektprinzip
CREATE TYPE "MajorityType" AS ENUM ('EINFACH', 'DREIVIERTEL', 'DOPPELT_QUALIFIZIERT', 'ALLSTIMMIG');
ALTER TABLE "Resolution" ADD COLUMN "majority" "MajorityType" NOT NULL DEFAULT 'EINFACH';
ALTER TABLE "Ownership" ADD COLUMN "voteUnits" INTEGER;
