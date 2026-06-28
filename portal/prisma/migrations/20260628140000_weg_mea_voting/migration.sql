-- WEG Stufe 1: Stimmprinzip am Objekt + Miteigentumsanteil je Eigentümer
CREATE TYPE "VotingPrinciple" AS ENUM ('KOPF', 'MEA');
ALTER TABLE "Property" ADD COLUMN "votingPrinciple" "VotingPrinciple" NOT NULL DEFAULT 'KOPF';
ALTER TABLE "Ownership" ADD COLUMN "mea" INTEGER;
