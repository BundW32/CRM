-- Fernablesbarkeit eines Zählers: löst die Pflicht zur monatlichen unterjährigen
-- Verbrauchsinformation aus (§ 6a HeizkostenV). Rein additiv.
ALTER TABLE "Meter" ADD COLUMN IF NOT EXISTS "remoteReadable" BOOLEAN NOT NULL DEFAULT false;
