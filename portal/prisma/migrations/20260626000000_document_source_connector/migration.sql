-- DocumentSource enum
CREATE TYPE "DocumentSource" AS ENUM ('UPLOAD', 'GDRIVE');

-- Neue Spalten am Document-Modell
ALTER TABLE "Document" ADD COLUMN "source" "DocumentSource" NOT NULL DEFAULT 'UPLOAD';
ALTER TABLE "Document" ADD COLUMN "externalRef" TEXT;
CREATE INDEX "Document_externalRef_idx" ON "Document"("externalRef");

-- Neue Tabelle DocumentSourceConfig
CREATE TABLE "DocumentSourceConfig" (
  "id"             TEXT NOT NULL,
  "label"          TEXT NOT NULL,
  "source"         "DocumentSource" NOT NULL,
  "propertyId"     TEXT,
  "audience"       "Audience" NOT NULL DEFAULT 'ALLE',
  "category"       "DocumentCategory" NOT NULL DEFAULT 'SONSTIGES',
  "config"         JSONB NOT NULL,
  "organizationId" TEXT,
  "lastSyncAt"     TIMESTAMP(3),
  "active"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById"    TEXT NOT NULL,
  CONSTRAINT "DocumentSourceConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentSourceConfig_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DocumentSourceConfig_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "DocumentSourceConfig_propertyId_idx" ON "DocumentSourceConfig"("propertyId");
CREATE INDEX "DocumentSourceConfig_source_active_idx" ON "DocumentSourceConfig"("source", "active");
