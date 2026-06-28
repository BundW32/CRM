-- Selbstverwaltung: Verwaltungsbeirat-Kennzeichnung am Eigentümer
ALTER TABLE "Ownership" ADD COLUMN "isBoardMember" BOOLEAN NOT NULL DEFAULT false;
