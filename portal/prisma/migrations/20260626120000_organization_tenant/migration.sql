-- Phase 4.3 – Organisations-/Mandanten-Modell (White-Label)
-- Führt die oberste Mandanten-Einheit Organization ein und hängt alle
-- mandantentragenden Tabellen über organizationId daran. Bestandsdaten werden
-- der Default-Organisation (B&W) zugewiesen, danach wird die Spalte verpflichtend.

-- 1. Organization-Tabelle
CREATE TABLE "Organization" (
  "id"             TEXT NOT NULL,
  "slug"           TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "legalName"      TEXT,
  "logoStoredName" TEXT,
  "primaryColor"   TEXT,
  "email"          TEXT,
  "phone"          TEXT,
  "street"         TEXT,
  "zip"            TEXT,
  "city"           TEXT,
  "active"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- 2. Default-Organisation (B&W) – alle Bestandsdaten gehören dieser Org.
--    slug "bw" stimmt mit prisma/seed.ts überein (idempotenter Upsert).
INSERT INTO "Organization" ("id", "slug", "name", "legalName", "active", "createdAt")
VALUES ('org_bw_default', 'bw', 'B&W Immobilien', 'B&W Immobilien Management UG', true, CURRENT_TIMESTAMP);

-- 3. organizationId auf jede mandantentragende Tabelle:
--    ADD (nullable) -> Backfill auf Default-Org -> NOT NULL -> FK -> Index.

-- User
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
UPDATE "User" SET "organizationId" = 'org_bw_default';
ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- Property
ALTER TABLE "Property" ADD COLUMN "organizationId" TEXT;
UPDATE "Property" SET "organizationId" = 'org_bw_default';
ALTER TABLE "Property" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Property" ADD CONSTRAINT "Property_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Property_organizationId_idx" ON "Property"("organizationId");

-- Craftsman
ALTER TABLE "Craftsman" ADD COLUMN "organizationId" TEXT;
UPDATE "Craftsman" SET "organizationId" = 'org_bw_default';
ALTER TABLE "Craftsman" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Craftsman" ADD CONSTRAINT "Craftsman_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Craftsman_organizationId_idx" ON "Craftsman"("organizationId");

-- Ticket
ALTER TABLE "Ticket" ADD COLUMN "organizationId" TEXT;
UPDATE "Ticket" SET "organizationId" = 'org_bw_default';
ALTER TABLE "Ticket" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Ticket_organizationId_idx" ON "Ticket"("organizationId");

-- Document
ALTER TABLE "Document" ADD COLUMN "organizationId" TEXT;
UPDATE "Document" SET "organizationId" = 'org_bw_default';
ALTER TABLE "Document" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");

-- Announcement
ALTER TABLE "Announcement" ADD COLUMN "organizationId" TEXT;
UPDATE "Announcement" SET "organizationId" = 'org_bw_default';
ALTER TABLE "Announcement" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Announcement_organizationId_idx" ON "Announcement"("organizationId");

-- Note
ALTER TABLE "Note" ADD COLUMN "organizationId" TEXT;
UPDATE "Note" SET "organizationId" = 'org_bw_default';
ALTER TABLE "Note" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Note" ADD CONSTRAINT "Note_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Note_organizationId_idx" ON "Note"("organizationId");

-- MaintenanceTask
ALTER TABLE "MaintenanceTask" ADD COLUMN "organizationId" TEXT;
UPDATE "MaintenanceTask" SET "organizationId" = 'org_bw_default';
ALTER TABLE "MaintenanceTask" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "MaintenanceTask_organizationId_idx" ON "MaintenanceTask"("organizationId");

-- Conversation
ALTER TABLE "Conversation" ADD COLUMN "organizationId" TEXT;
UPDATE "Conversation" SET "organizationId" = 'org_bw_default';
ALTER TABLE "Conversation" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Conversation_organizationId_idx" ON "Conversation"("organizationId");

-- Resolution
ALTER TABLE "Resolution" ADD COLUMN "organizationId" TEXT;
UPDATE "Resolution" SET "organizationId" = 'org_bw_default';
ALTER TABLE "Resolution" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Resolution_organizationId_idx" ON "Resolution"("organizationId");

-- Handover
ALTER TABLE "Handover" ADD COLUMN "organizationId" TEXT;
UPDATE "Handover" SET "organizationId" = 'org_bw_default';
ALTER TABLE "Handover" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Handover_organizationId_idx" ON "Handover"("organizationId");

-- DocumentSourceConfig: Spalte existiert bereits (nullable, Phase 4.1) – nur befüllen,
-- verpflichtend machen, FK + Index ergänzen.
UPDATE "DocumentSourceConfig" SET "organizationId" = 'org_bw_default' WHERE "organizationId" IS NULL;
ALTER TABLE "DocumentSourceConfig" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "DocumentSourceConfig" ADD CONSTRAINT "DocumentSourceConfig_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DocumentSourceConfig_organizationId_idx" ON "DocumentSourceConfig"("organizationId");
