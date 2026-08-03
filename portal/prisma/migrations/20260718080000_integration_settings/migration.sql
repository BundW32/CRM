-- Integrationen (Phase 3): optionale API-Zugänge je Bereich. Secrets werden
-- anwendungsseitig verschlüsselt (AES-256-GCM) abgelegt. Rein additiv.
CREATE TABLE "IntegrationSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "provider" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "secretEnc" TEXT,
    "configJson" JSONB,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntegrationSetting_organizationId_area_key" ON "IntegrationSetting"("organizationId", "area");
CREATE INDEX "IntegrationSetting_organizationId_idx" ON "IntegrationSetting"("organizationId");
ALTER TABLE "IntegrationSetting" ADD CONSTRAINT "IntegrationSetting_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
