-- Selbstverwalter-Feinschliff: Kontotyp je Organisation
ALTER TABLE "Organization" ADD COLUMN "accountType" TEXT NOT NULL DEFAULT 'verwaltung';
