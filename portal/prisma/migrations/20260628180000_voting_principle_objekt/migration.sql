-- Objektprinzip als drittes Stimmprinzip (eigene Migration, da ADD VALUE)
ALTER TYPE "VotingPrinciple" ADD VALUE IF NOT EXISTS 'OBJEKT';
