-- Verwaltungsbeirat (Notiz 5): eigener Beirats-Bereich mit Aufgaben/Notizen.
-- Additiv. Das Kennzeichen Ownership.isBoardMember existiert bereits.
CREATE TABLE IF NOT EXISTS "BeiratTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BeiratTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BeiratTask_propertyId_idx" ON "BeiratTask"("propertyId");
CREATE INDEX IF NOT EXISTS "BeiratTask_organizationId_idx" ON "BeiratTask"("organizationId");

DO $$ BEGIN
  ALTER TABLE "BeiratTask" ADD CONSTRAINT "BeiratTask_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "BeiratTask" ADD CONSTRAINT "BeiratTask_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "BeiratTask" ADD CONSTRAINT "BeiratTask_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
